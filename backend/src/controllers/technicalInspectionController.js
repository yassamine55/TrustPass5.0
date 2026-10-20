const Product = require("../models/Product");
const Document = require("../models/Document");
const LifecycleEvent = require("../models/LifecycleEvent");
const User = require("../models/User");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { createProvenance } = require("../domain/provenance");
const { deriveInspectionClaims } = require("../domain/structuredClaims");
const { INSPECTION_ITEMS, INSPECTION_ITEM_IDS, INSPECTION_ITEM_STATUSES, getInspectionChecklistForCategory, validateInspectionChecklist, assertInspectionAssignedRepairer, assertInspectionRequestDecision, assertInspectionReviewAction, summarizeInspectionState } = require("../domain/technicalInspection");
const { createInformationDiscrepancy } = require("../services/informationDiscrepancyService");
const { assertLifecycleTransition, assertLifecycleAuthorization } = require("../services/lifecycleState");
const { anchorPassportRevisionSafely } = require("../services/passportProofService");

function forbidden(message) { const error = new Error(message); error.statusCode = 403; return error; }
function conflict(message) { const error = new Error(message); error.statusCode = 409; return error; }
function invalidRequest(message) { const error = new Error(message); error.statusCode = 422; error.code = "VALIDATION_ERROR"; return error; }

function inspectionView(product) {
  const value = product.toObject ? product.toObject() : product;
  if (value.technicalInspection?.signature) delete value.technicalInspection.signature.value;
  return value;
}

async function loadProduct(req, id) {
  const product = await Product.findById(id)
    .populate("owner", "firstName lastName email role isVerified")
    .populate("technicalInspection.requestedBy", "firstName lastName email role")
    .populate("technicalInspection.assignedRepairer", "firstName lastName email role isVerified hederaAccountId")
    .populate("technicalInspection.performedBy", "firstName lastName email role isVerified hederaAccountId")
    .populate("technicalInspection.reviewedBy", "firstName lastName email role");
  if (!product) { const error = new Error("Product not found"); error.statusCode = 404; throw error; }
  return product;
}

function assertRepairer(user) {
  if (user.role !== "REPAIRER" || !user.isVerified) throw forbidden("Only a verified repairer can perform a technical inspection");
}

function validateChecklist(checklist, category) {
  try {
    validateInspectionChecklist(checklist, category || "Other");
  } catch (error) {
    throw invalidRequest(error.message);
  }
  const template = getInspectionChecklistForCategory(category || "Other");
  const byId = new Map(checklist.map((item) => [item.itemId, item]));
  return template.map(({ id, category: itemCategory, label }) => {
    const item = byId.get(id);
    if (!item) {
      throw invalidRequest(`Missing required inspection item for ${category}: ${id}`);
    }
    if (!INSPECTION_ITEM_STATUSES.includes(item.status)) throw invalidRequest(`Invalid inspection status for ${id}`);
    return {
      itemId: id,
      category: itemCategory,
      label,
      status: item.status,
      notes: typeof item.notes === "string" ? item.notes.trim() : null,
      evidenceReferences: Array.isArray(item.evidenceReferences) ? item.evidenceReferences.filter((ref) => typeof ref === "string").slice(0, 20) : []
    };
  });
}

function inspectionContradictions(product) {
  const declaration = product.currentCondition || "";
  if (!declaration) return [];
  const contradictions = [];
  const screen = product.technicalInspection?.checklist?.find((item) => item.itemId === "screen");
  if (screen && /screen/i.test(declaration) && /(never|no|not).*(replac|changed)|original/i.test(declaration) && /(replac|changed|aftermarket|non[- ]original)/i.test(screen.notes || "")) {
    contradictions.push({
      sourceRef: `${product.passportId}:DISCREPANCY:SCREEN-REPLACEMENT`,
      description: `Owner declaration: ${declaration}\nTechnical inspection: ${screen.notes}`
    });
  }
  return contradictions;
}

async function available(req, res, next) {
  try {
    assertRepairer(req.user);
    const products = await Product.find({
      "technicalInspection.status": "REQUESTED",
      "technicalInspection.assignedRepairer": req.user._id
    }).populate("owner", "firstName lastName email role").sort({ "technicalInspection.requestedAt": 1 });
    res.json(products.map(inspectionView));
  } catch (error) { next(error); }
}

async function acceptInspection(req, res, next) {
  try {
    assertRepairer(req.user);
    const product = await Product.findOneAndUpdate({
      _id: req.params.id,
      "technicalInspection.status": "REQUESTED",
      "technicalInspection.assignedRepairer": req.user._id
    }, {
      $set: { "technicalInspection.status": "IN_PROGRESS" }
    }, { new: true });
    if (!product) throw conflict("This inspection was not assigned to you or is no longer available");
    res.json({ message: "Inspection accepted", product: inspectionView(product) });
  } catch (error) { next(error); }
}

async function getInspection(req, res, next) {
  try {
    const product = await loadProduct(req, req.params.id);
    const isOwner = product.owner._id.toString() === req.user._id.toString();
    const isAssignedRepairer = product.technicalInspection.assignedRepairer?._id?.toString() === req.user._id.toString();
    if (req.user.role !== "ADMIN" && !isOwner && !isAssignedRepairer) throw forbidden("Access denied");
    const checklistTemplate = getInspectionChecklistForCategory(product.category || "Other");
    res.json({ product: inspectionView(product), checklistTemplate });
  } catch (error) { next(error); }
}

async function completeInspection(req, res, next) {
  try {
    assertRepairer(req.user);
    const product = await loadProduct(req, req.params.id);
    const inspection = product.technicalInspection;
    if (inspection.status !== "IN_PROGRESS") throw conflict("Accept your assigned inspection before completing it");
    if (!inspection.assignedRepairer) throw forbidden("Accept this inspection before completing it");
    assertInspectionAssignedRepairer({ inspection, user: req.user });

    const checklist = validateChecklist(req.body.checklist, product.category || "Other");
    const summary = typeof req.body.summary === "string" ? req.body.summary.trim() : "";
    if (summary.length < 3) throw invalidRequest("An inspection summary of at least 3 characters is required");
    const decision = req.body.decision;
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (!["REPAIRABLE", "NOT_REPAIRABLE"].includes(decision)) throw invalidRequest("A valid repairability decision is required");
    if (decision === "NOT_REPAIRABLE" && reason.length < 3) throw invalidRequest("A reason is required when a device is not repairable");
    const evidenceDocuments = Array.isArray(req.body.evidenceDocuments) ? req.body.evidenceDocuments : [];
    if (evidenceDocuments.length) {
      const documents = await Document.find({ _id: { $in: evidenceDocuments }, product: product._id });
      if (documents.length !== evidenceDocuments.length) throw invalidRequest("Inspection evidence must belong to this device");
    }

    const performedAt = new Date();
    inspection.status = "COMPLETED";
    inspection.reviewStatus = "PENDING_REVIEW";
    inspection.assignedRepairer = req.user._id;
    inspection.performedBy = req.user._id;
    inspection.performedAt = performedAt;
    inspection.inspectedAt = performedAt;
    inspection.inspector = req.user._id;
    inspection.inspectedState = summarizeInspectionState(checklist);
    inspection.validity = {
      status: "CURRENT",
      reason: `Inspection valid for the recorded state as of ${performedAt.toISOString()}. Later relevant repairs or disputes may affect its status.`,
      affectedBy: [],
      lastRelevantEventAt: null
    };
    inspection.checklist = checklist;
    const claims = deriveInspectionClaims({
      checklist,
      summary,
      decision,
      reason,
      inspectorId: req.user._id ? String(req.user._id) : null,
      evidenceDocuments,
      timestamp: performedAt.toISOString()
    });

    inspection.report = { summary, evidenceDocuments, evidenceHash: req.body.evidenceHash || null };
    inspection.attestation = {
      verified: true,
      method: "TRUSTPASS_AUTHENTICATED_SESSION",
      actor: req.user._id,
      attestedAt: performedAt
    };
    inspection.diagnosis = {
      decision,
      reason: reason || null,
      repairer: req.user._id,
      diagnosedAt: performedAt,
      requestEvent: inspection.requestEvent,
      evidenceDocuments,
      evidenceHash: req.body.evidenceHash || null,
      signatureValid: null,
      attestationVerified: true,
      claims
    };

    if (decision === "NOT_REPAIRABLE") {
      assertLifecycleAuthorization({ eventType: "END_OF_LIFE", user: req.user, product, repairRequest: inspection.requestEvent });
      assertLifecycleTransition(product.status, "END_OF_LIFE");
      inspection.previousLifecycleStatus = product.status;
      inspection.pendingLifecycleState = {
        type: "END_OF_LIFE",
        requestedBy: req.user._id,
        requestedAt: performedAt,
        reason,
        reviewRequired: true
      };
    }
    await product.save();
    await anchorPassportRevisionSafely(product, "Technical inspection completed");
    res.status(201).json({ message: "Inspection submitted for admin review", product: inspectionView(product) });
  } catch (error) { next(error); }
}

async function adminList(req, res, next) {
  try {
    const products = await Product.find({
      $or: [
        { "technicalInspection.status": { $in: ["REQUESTED", "IN_PROGRESS"] } },
        { "technicalInspection.reviewStatus": { $in: ["PENDING_REVIEW", "ADDITIONAL_EVIDENCE_REQUIRED"] } }
      ]
    })
      .populate("owner", "firstName lastName email")
      .populate("technicalInspection.requestedBy", "firstName lastName email")
      .populate("technicalInspection.assignedRepairer", "firstName lastName email role isVerified")
      .populate("technicalInspection.performedBy", "firstName lastName email role isVerified")
      .populate("technicalInspection.report.evidenceDocuments", "originalName category sha256")
      .sort({ "technicalInspection.requestedAt": 1, "technicalInspection.performedAt": 1 });
    res.json(products.map(inspectionView));
  } catch (error) { next(error); }
}

async function adminDecideRequest(req, res, next) {
  try {
    const product = await loadProduct(req, req.params.id);
    const inspection = product.technicalInspection;
    const { action, repairerId } = req.body;
    const note = typeof req.body.note === "string" ? req.body.note.trim() : "";
    assertInspectionRequestDecision({ inspection, action, user: req.user });

    if (action === "ASSIGN") {
      if (!repairerId) throw new Error("A verified repairer must be selected");
      const repairer = await User.findOne({
        _id: repairerId,
        role: "REPAIRER",
        isVerified: true,
        isActive: true
      });
      if (!repairer) throw Object.assign(new Error("Select an active repairer verified by an administrator"), { statusCode: 400 });
      const reviewedAt = new Date();
      const updated = await Product.findOneAndUpdate({
        _id: product._id,
        "technicalInspection.status": "REQUESTED",
        "technicalInspection.assignedRepairer": null
      }, {
        $set: {
          "technicalInspection.assignedRepairer": repairer._id,
          "technicalInspection.requestDecision": { action: "ASSIGN", reviewer: req.user._id, reviewedAt, note: note || null }
        }
      }, { new: true }).populate("owner", "firstName lastName email")
        .populate("technicalInspection.requestedBy", "firstName lastName email")
        .populate("technicalInspection.assignedRepairer", "firstName lastName email role isVerified");
      if (!updated) throw conflict("This inspection request was already assigned or is no longer available");
      return res.json({ message: "Inspection assigned to verified repairer", product: inspectionView(updated) });
    } else {
      if (note.length < 3) throw new Error("A reason of at least 3 characters is required to reject an inspection request");
      const reviewedAt = new Date();
      const updated = await Product.findOneAndUpdate({
        _id: product._id,
        "technicalInspection.status": "REQUESTED"
      }, {
        $set: {
          "technicalInspection.status": "REJECTED",
          "technicalInspection.reviewStatus": "REJECTED",
          "technicalInspection.assignedRepairer": null,
          "technicalInspection.requestDecision": { action: "REJECT", reviewer: req.user._id, reviewedAt, note }
        }
      }, { new: true });
      if (!updated) throw conflict("This inspection request is no longer available");
      let event;
      try {
        const eventId = generateId("EVT");
        event = await LifecycleEvent.create({
          eventId,
          product: product._id,
          type: "TECHNICAL_INSPECTION_REJECTED",
          actor: req.user._id,
          description: note,
          relatedEvent: inspection.requestEvent,
          sourceRef: `${product.passportId}:INSPECTION_REQUEST_REJECTED:${eventId}`,
          provenance: createProvenance({ actor: req.user, claimType: "TECHNICAL_INSPECTION_REQUEST" })
        });
      } catch (error) {
        await Product.updateOne(
          { _id: product._id, "technicalInspection.requestDecision.reviewedAt": reviewedAt },
          {
            $set: {
              "technicalInspection.status": "REQUESTED",
              "technicalInspection.reviewStatus": "NOT_SUBMITTED",
              "technicalInspection.requestDecision": { action: null, reviewer: null, reviewedAt: null, note: null }
            }
          }
        );
        throw error;
      }
      updated.technicalInspection.requestEvent = inspection.requestEvent;
      await publishAndPersistLifecycleEvent({ product: updated, lifecycleEvent: event, actor: req.user });
      return res.json({ message: "Inspection request rejected", product: inspectionView(updated), event });
    }
  } catch (error) {
    next(error);
  }
}

async function adminReview(req, res, next) {
  try {
    const product = await loadProduct(req, req.params.id);
    const inspection = product.technicalInspection;
    const action = req.body.action;
    const note = typeof req.body.note === "string" ? req.body.note.trim() : null;
    assertInspectionReviewAction({ product, inspection, action, user: req.user });
    if (action !== "APPROVE" && (!note || note.length < 3)) throw new Error("A review note is required");
    const performedBy = await User.findById(inspection.performedBy).select("role isVerified hederaAccountId");
    const hasValidRepairerSignature = inspection.signature?.valid === true &&
      inspection.signature.signer?.toString() === performedBy?._id?.toString();
    const hasValidAccountAttestation = inspection.attestation?.verified === true &&
      inspection.attestation.method === "TRUSTPASS_AUTHENTICATED_SESSION" &&
      inspection.attestation.actor?.toString() === performedBy?._id?.toString();
    if (!performedBy || performedBy.role !== "REPAIRER" || !performedBy.isVerified ||
      (!hasValidRepairerSignature && !hasValidAccountAttestation)) {
      throw conflict("Only an inspection attested by its verified repairer can be reviewed");
    }

    const verifiedAt = new Date();
    const eventType = action === "APPROVE" ? "TECHNICAL_INSPECTION_APPROVED" : action === "REJECT" ? "TECHNICAL_INSPECTION_REJECTED" : "TECHNICAL_INSPECTION_EVIDENCE_REQUESTED";
    const event = await LifecycleEvent.create({
      eventId: generateId("EVT"), product: product._id, type: eventType, actor: req.user._id,
      description: note || "Admin reviewed a signed technical inspection",
      relatedEvent: inspection.requestEvent,
      sourceRef: `${product.passportId}:${eventType}:${Date.now()}`,
      provenance: createProvenance({
        actor: action === "APPROVE" ? performedBy : req.user,
        claimType: "TECHNICAL_INSPECTION",
        verificationLevel: action === "APPROVE" ? "REPAIRER_VERIFIED" : "OWNER_REPORTED",
        verificationStatus: action === "APPROVE" ? "TECHNICALLY_VERIFIED" : "OWNER_DECLARED",
        verifier: action === "APPROVE" ? { ...req.user.toObject(), verifiedAt } : null,
        signature: hasValidRepairerSignature ? { valid: true, signerId: performedBy.hederaAccountId || null } : null,
        evidenceReferences: inspection.report?.evidenceDocuments?.map(String) || [],
        evidenceHash: inspection.report?.evidenceHash || null,
        verifiedAt: action === "APPROVE" ? verifiedAt : null
      })
    });

    if (action === "APPROVE") {
      await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor: req.user });
      inspection.status = "TECHNICALLY_VERIFIED";
      inspection.reviewStatus = "APPROVED";
      inspection.approvalEvent = event._id;
      inspection.inspectedAt = inspection.inspectedAt || inspection.performedAt || new Date();
      inspection.inspector = inspection.inspector || inspection.performedBy || req.user._id;
      inspection.inspectedState = inspection.inspectedState || summarizeInspectionState(inspection.checklist || []);
      inspection.validity = {
        status: "CURRENT",
        reason: `Inspection valid for the recorded state as of ${new Date(inspection.inspectedAt).toISOString()}. Later relevant repairs or disputes may affect this record.`,
        affectedBy: [],
        lastRelevantEventAt: null
      };

      if (inspection.diagnosis?.decision === "NOT_REPAIRABLE") {
        const priorStatus = inspection.previousLifecycleStatus || product.status;
        assertLifecycleTransition(priorStatus, "END_OF_LIFE");
        const endOfLifeEvent = await LifecycleEvent.create({
          eventId: generateId("EVT"),
          product: product._id,
          type: "END_OF_LIFE",
          actor: req.user._id,
          description: inspection.diagnosis?.reason || "Technical inspection approved a not-repairable decision",
          document: inspection.report?.evidenceDocuments?.[0] || null,
          hash: inspection.report?.evidenceHash || null,
          relatedEvent: inspection.requestEvent,
          sourceRef: `${product.passportId}:END_OF_LIFE:${inspection.requestEvent?.toString?.() || Date.now()}`,
          provenance: createProvenance({
            actor: performedBy,
            claimType: "END_OF_LIFE_DIAGNOSIS",
            verificationLevel: "REPAIRER_VERIFIED",
            verificationStatus: "PROFESSIONALLY_ATTESTED",
            documentId: inspection.report?.evidenceDocuments?.[0] || null,
            evidenceReferences: inspection.report?.evidenceDocuments?.map(String) || [],
            evidenceHash: inspection.report?.evidenceHash || null,
            verifier: { ...req.user.toObject(), verifiedAt },
            signature: { valid: true, signerId: performedBy.hederaAccountId || null },
            verifiedAt
          })
        });
        inspection.diagnosis.lifecycleEvent = endOfLifeEvent._id;
        inspection.pendingLifecycleState = null;
        product.status = "END_OF_LIFE";
        await publishAndPersistLifecycleEvent({ product, lifecycleEvent: endOfLifeEvent, actor: req.user });
      }
    } else {
      inspection.status = action === "REJECT" ? "REJECTED" : "REQUESTED";
      inspection.reviewStatus = action === "REJECT" ? "REJECTED" : "ADDITIONAL_EVIDENCE_REQUIRED";
      inspection.pendingLifecycleState = null;
      if (action === "REJECT" && inspection.previousLifecycleStatus && product.status === "END_OF_LIFE") {
        product.status = inspection.previousLifecycleStatus;
      }
    }

    inspection.reviewDecision = {
      action,
      reviewer: req.user._id,
      reviewedAt: new Date(),
      note
    };
    inspection.reviewedBy = req.user._id;
    inspection.reviewedAt = new Date();
    inspection.reviewNote = note;
    await product.save();
    if (action === "APPROVE") {
      await anchorPassportRevisionSafely(product, "Technical inspection approved");
      for (const contradiction of inspectionContradictions(product)) {
        await createInformationDiscrepancy({
          product,
          actor: req.user,
          description: contradiction.description,
          relatedEvent: event._id,
          sourceRef: contradiction.sourceRef
        });
      }
    }
    res.json({ message: action === "APPROVE" ? "Inspection approved" : action === "REJECT" ? "Inspection rejected" : "Additional evidence requested", product: inspectionView(product), event });
  } catch (error) { next(error); }
}

module.exports = { available, getInspection, acceptInspection, completeInspection, adminList, adminDecideRequest, adminReview };