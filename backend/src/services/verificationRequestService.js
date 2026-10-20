const Company = require("../models/Company");
const Document = require("../models/Document");
const LifecycleEvent = require("../models/LifecycleEvent");
const Product = require("../models/Product");
const Repair = require("../models/Repair");
const VerificationRequest = require("../models/VerificationRequest");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("./hederaLifecyclePublisher");
const {
  createProvenance,
  PROVENANCE_LEVELS,
  PROVENANCE_SOURCES,
  EVIDENCE_INTEGRITY_STATUSES
} = require("../domain/provenance");
const {
  VERIFICATION_REQUEST_STATUSES,
  assertCanRequestVerification,
  assertCanRespondToVerification
} = require("../domain/verificationRequest");
const { assertInstitutionCanReview, getInstitutionVerificationScope } = require("../domain/institutionVerificationPolicy");

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function safeProvenance(provenance) {
  if (!provenance) return null;
  return {
    claimType: provenance.claimType || null,
    source: provenance.source ? { type: provenance.source.type, role: provenance.source.role || null } : null,
    verificationStatus: provenance.verificationStatus || "OWNER_DECLARED",
    verificationLevel: provenance.verificationLevel,
    verificationSource: provenance.verificationSource || (provenance.externalSystemConnected ? "EXTERNAL_VERIFICATION" : "DEMO_TEST"),
    externalSystemConnected: Boolean(provenance.externalSystemConnected),
    institutionType: provenance.institutionType,
    evidence: provenance.evidence ? {
      available: provenance.evidence.available,
      documentId: provenance.evidence.documentId || null,
      references: provenance.evidence.references || [],
      hash: provenance.evidence.hash || null,
      integrityStatus: provenance.evidence.integrityStatus
    } : null,
    verifier: provenance.verifier || null,
    signature: provenance.signature || null,
    recordingStatus: provenance.recordingStatus || "NOT_RECORDED",
    blockchain: provenance.blockchain || null,
    dispute: provenance.dispute || null,
    verifiedAt: provenance.verifiedAt
  };
}

function safeRequest(request, reviewContext) {
  const value = request.toObject ? request.toObject() : { ...request };
  if (value.requester && value.requester._id) {
    value.requester = {
      _id: value.requester._id,
      firstName: value.requester.firstName,
      lastName: value.requester.lastName,
      role: value.requester.role
    };
  }
  if (value.targetInstitution && value.targetInstitution._id) {
    value.targetInstitution = {
      _id: value.targetInstitution._id,
      name: value.targetInstitution.name,
      type: value.targetInstitution.type,
      status: value.targetInstitution.status,
      isActive: value.targetInstitution.isActive
    };
  }
  if (value.lifecycleEvent && value.lifecycleEvent._id) {
    value.lifecycleEvent = {
      _id: value.lifecycleEvent._id,
      eventId: value.lifecycleEvent.eventId,
      type: value.lifecycleEvent.type,
      provenance: safeProvenance(value.lifecycleEvent.provenance),
      hederaStatus: value.lifecycleEvent.hederaStatus
    };
  }
  value.verificationMode = value.verificationMode || "DEMO_TEST";
  value.verificationSource = value.verificationMode;
  value.externalSystemConnected = value.verificationMode === "EXTERNAL_VERIFICATION";
  if (reviewContext) value.reviewContext = reviewContext;
  return value;
}

async function getReviewContext(request) {
  const [product, claim] = await Promise.all([
    Product.findById(request.product).select("passportId brand model category manufacturer status createdAt"),
    LifecycleEvent.findById(request.lifecycleEvent)
      .populate("actor", "firstName lastName role")
      .select("eventId type description actor document hash provenance createdAt hederaStatus")
  ]);
  const repair = claim?.type === "REPAIR"
    ? await Repair.findOne({ lifecycleEvent: claim._id }).populate("repairer", "firstName lastName role")
    : null;
  const previousHistory = product
    ? await LifecycleEvent.find({ product: product._id, _id: { $ne: claim?._id } })
      .select("eventId type description provenance createdAt hederaStatus")
      .sort({ createdAt: -1 })
      .limit(20)
    : [];
  const targetInstitution = request.targetInstitution?._id
    ? request.targetInstitution
    : await Company.findById(request.targetInstitution).select("name type status isActive");
  const scope = getInstitutionVerificationScope(targetInstitution?.type, claim?.type);
  const evidenceAvailable = Boolean(
    request.evidence?.length || claim?.document || repair?.evidenceDocument
  );

  const verificationSource = request.verificationMode || "DEMO_TEST";
  return {
    verificationMode: verificationSource,
    verificationSource,
    externalSystemConnected: verificationSource === "EXTERNAL_VERIFICATION",
    scope,
    device: product ? {
      reloopId: product.passportId,
      brand: product.brand,
      model: product.model,
      category: product.category,
      manufacturer: product.manufacturer || null,
      status: product.status
    } : null,
    claim: claim ? {
      eventId: claim.eventId,
      type: claim.type,
      description: claim.description,
      occurredAt: claim.createdAt,
      provenance: safeProvenance(claim.provenance),
      hederaStatus: claim.hederaStatus
    } : null,
    repair: repair ? {
      date: repair.date,
      type: claim.type,
      description: repair.description,
      changedParts: repair.changedParts,
      repairer: repair.repairer ? {
        name: `${repair.repairer.firstName} ${repair.repairer.lastName}`,
        role: repair.repairer.role
      } : null,
      evidenceAvailable,
      documentIntegrityStatus: repair.provenance?.evidence?.integrityStatus || "UNKNOWN"
    } : null,
    previousHistory: previousHistory.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      description: event.description,
      occurredAt: event.createdAt,
      provenance: safeProvenance(event.provenance),
      hederaStatus: event.hederaStatus
    })),
    requestReason: request.reason
  };
}

function safeEvent(event) {
  const value = event.toObject ? event.toObject() : { ...event };
  return {
    _id: value._id,
    eventId: value.eventId,
    product: value.product,
    type: value.type,
    description: value.description,
    relatedEvent: value.relatedEvent,
    verificationRequest: value.verificationRequest,
    verificationSource: value.provenance?.verificationSource || (value.externalSystemConnected ? "EXTERNAL_VERIFICATION" : "DEMO_TEST"),
    provenance: safeProvenance(value.provenance),
    hederaStatus: value.hederaStatus,
    hederaTopicId: value.hederaTopicId,
    hederaSequenceNumber: value.hederaSequenceNumber,
    hederaTransactionId: value.hederaTransactionId,
    hederaConsensusTimestamp: value.hederaConsensusTimestamp
  };
}

async function createVerificationRequest({ user, productId, lifecycleEventId, targetInstitutionId, reason, evidence = [] }) {
  const lifecycleEvent = await LifecycleEvent.findById(lifecycleEventId);
  if (!lifecycleEvent) throw notFound("Lifecycle claim not found");
  const product = await Product.findById(productId);
  if (!product) throw notFound("Product not found");
  assertCanRequestVerification({ user, product, lifecycleEvent });

  const institution = await Company.findById(targetInstitutionId);
  if (!institution) throw notFound("Target institution not found");
  if (institution.status !== "VERIFIED" || institution.isActive !== true) {
    throw conflict("Target institution is not verified and active");
  }
  assertInstitutionCanReview({ institution, claimType: lifecycleEvent.type });
  if (typeof reason !== "string" || reason.trim().length < 3) {
    const error = new Error("A verification reason is required");
    error.statusCode = 400;
    throw error;
  }

  const existing = await VerificationRequest.findOne({
    lifecycleEvent: lifecycleEvent._id,
    targetInstitution: institution._id,
    status: VERIFICATION_REQUEST_STATUSES.PENDING
  });
  if (existing) throw conflict("A verification request is already pending for this institution");

  const evidenceIds = Array.isArray(evidence)
    ? evidence.map((item) => typeof item === "string" ? { documentId: item } : item).filter(Boolean)
    : [];
  const documents = evidenceIds.length
    ? await Document.find({ _id: { $in: evidenceIds.map((item) => item.documentId).filter(Boolean) } })
    : [];
  if (documents.length !== evidenceIds.filter((item) => item.documentId).length) {
    throw notFound("Verification evidence document not found");
  }
  if (documents.some((document) => document.uploadedBy.toString() !== user._id.toString())) {
    const error = new Error("Verification evidence access denied");
    error.statusCode = 403;
    throw error;
  }

  const request = await VerificationRequest.create({
    product: product._id,
    lifecycleEvent: lifecycleEvent._id,
    requester: user._id,
    targetInstitution: institution._id,
    reason: reason.trim(),
    evidence: evidenceIds
  });
  return VerificationRequest.findById(request._id)
    .populate("requester", "firstName lastName role")
    .populate("targetInstitution", "name type status isActive")
    .populate("lifecycleEvent", "eventId type provenance hederaStatus")
    .populate("product", "passportId brand model category manufacturer status");
}

async function listVerificationRequests({ user }) {
  const filters = [{ requester: user._id }];
  if (user.company) {
    const institutionId = user.company._id || user.company;
    filters.push({ targetInstitution: institutionId });
  }
  const filter = user.role === "ADMIN" ? {} : { $or: filters };
  return VerificationRequest.find(filter)
    .populate("requester", "firstName lastName role")
    .populate("targetInstitution", "name type status isActive")
    .populate("lifecycleEvent", "eventId type provenance hederaStatus")
    .populate("product", "passportId brand model category manufacturer status")
    .sort({ createdAt: -1 });
}

async function getVerificationRequest({ user, id }) {
  const request = await VerificationRequest.findById(id)
    .populate("requester", "firstName lastName role")
    .populate("targetInstitution", "name type status isActive")
    .populate("lifecycleEvent", "eventId type provenance hederaStatus")
    .populate("product", "passportId brand model category manufacturer status");
  if (!request) throw notFound("Verification request not found");

  const institutionId = user.company?._id || user.company;
  const visible = user.role === "ADMIN" ||
    request.requester._id.toString() === user._id.toString() ||
    (institutionId && request.targetInstitution._id.toString() === institutionId.toString());
  if (!visible) {
    const error = new Error("Access denied");
    error.statusCode = 403;
    throw error;
  }
  return request;
}

async function respondToVerificationRequest({ user, institution, id, verified, reason }) {
  const request = await VerificationRequest.findById(id);
  if (!request) throw notFound("Verification request not found");
  assertCanRespondToVerification({ user, institution, request });
  assertInstitutionCanReview({ institution, claimType: (await LifecycleEvent.findById(request.lifecycleEvent).select("type")).type });

  const responseAt = new Date();
  const eventType = verified ? "INSTITUTION_VERIFIED" : "INSTITUTION_REJECTED";
  const evidenceDocumentId = request.evidence[0]?.documentId || null;
  const verificationSource = request.verificationMode || "DEMO_TEST";
  const event = await LifecycleEvent.create({
    eventId: generateId("EVT"),
    product: request.product,
    type: eventType,
    actor: user._id,
    description: `${verificationSource === "EXTERNAL_VERIFICATION" ? "EXTERNAL" : "DEMO/TEST"} institution workflow: ${reason || (verified ? "Institution independently verified the claim" : "Institution rejected the verification claim")}`,
    document: evidenceDocumentId,
    relatedEvent: request.lifecycleEvent,
    verificationRequest: request._id,
    sourceRef: `VERIFICATION_REQUEST:${request._id}:${eventType}`,
    provenance: createProvenance({
      actor: { ...user, verificationSource },
      sourceType: PROVENANCE_SOURCES.INSTITUTION,
      verificationLevel: verified ? PROVENANCE_LEVELS.INSTITUTION_VERIFIED : PROVENANCE_LEVELS.OWNER_REPORTED,
      institutionType: verified ? institution.type : null,
      documentId: evidenceDocumentId,
      integrityStatus: evidenceDocumentId ? EVIDENCE_INTEGRITY_STATUSES.UNVERIFIED : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN,
      verifiedAt: verified ? responseAt : null
    })
  });
  event.provenance.verificationSource = verificationSource;
  event.provenance.externalSystemConnected = verificationSource === "EXTERNAL_VERIFICATION";
  await event.save();

  const product = await Product.findById(request.product);
  const blockchain = await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor: user });
  request.status = verified ? VERIFICATION_REQUEST_STATUSES.VERIFIED : VERIFICATION_REQUEST_STATUSES.REJECTED;
  request.respondedAt = responseAt;
  request.response = verified ? "VERIFIED" : "REJECTED";
  request.responseReason = reason || null;
  request.responseEvent = event._id;
  await request.save();

  const responseRequest = await VerificationRequest.findById(request._id)
    .populate("requester", "firstName lastName role")
    .populate("targetInstitution", "name type status isActive")
    .populate("lifecycleEvent", "eventId type provenance hederaStatus")
    .populate("product", "passportId brand model category manufacturer status");

  return { request: responseRequest, event, blockchain };
}

module.exports = {
  safeRequest,
  safeEvent,
  getReviewContext,
  createVerificationRequest,
  listVerificationRequests,
  getVerificationRequest,
  respondToVerificationRequest
};
