const Repair = require("../models/Repair");
const RepairVerificationRequest = require("../models/RepairVerificationRequest");
const LifecycleEvent = require("../models/LifecycleEvent");
const Product = require("../models/Product");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { createProvenance, EVIDENCE_INTEGRITY_STATUSES } = require("../domain/provenance");
const { assertRepairVerificationAssignedToUser } = require("../domain/repairVerification");
const { generateId } = require("../utils/generateId");

function repairRequestView(request) {
  const value = request.toObject ? request.toObject() : { ...request };
  if (value.repair?.signature) delete value.repair.signature;
  return value;
}

async function list(req, res, next) {
  try {
    if (req.user.role !== "REPAIRER" || !req.user.isVerified) return res.status(403).json({ message: "Only a verified repairer can review repair claims" });
    const requests = await RepairVerificationRequest.find({ status: "PENDING", targetRepairerId: req.user._id })
      .populate({ path: "repair", populate: [{ path: "product" }, { path: "claimant", select: "firstName lastName email role" }, { path: "evidenceDocument", select: "originalName category sha256 analysisStatus advisoryAnalysis verificationStatus" }] })
      .populate("requester", "firstName lastName email role")
      .populate("targetRepairerId", "firstName lastName email role isVerified hederaAccountId")
      .sort({ createdAt: 1 });
    res.json(requests.map(repairRequestView));
  } catch (error) { next(error); }
}

async function respond(req, res, next) {
  try {
    if (req.user.role !== "REPAIRER" || !req.user.isVerified) return res.status(403).json({ message: "Only a verified repairer can respond" });
    const accepted = req.body.action === "ACCEPT";
    if (!accepted && req.body.action !== "REJECT") return res.status(400).json({ message: "Action must be ACCEPT or REJECT" });
    const request = await RepairVerificationRequest.findById(req.params.id)
      .populate("repair")
      .populate("targetRepairerId", "firstName lastName email role isVerified hederaAccountId");
    if (!request) return res.status(404).json({ message: "Repair verification request not found" });
    assertRepairVerificationAssignedToUser({ request, user: req.user });
    if (request.status !== "PENDING") return res.status(409).json({ message: "This request has already been resolved" });
    const repair = await Repair.findById(request.repair._id).populate("product");
    if (!repair) return res.status(404).json({ message: "Repair claim not found" });
    const note = typeof req.body.note === "string" ? req.body.note.trim() : "";
    const signature = typeof req.body.signature === "string" ? req.body.signature.trim() : "";
    if (accepted && !signature) return res.status(400).json({ message: "La signature est obligatoire" });
    if (!accepted && !note) return res.status(400).json({ message: "Une note de refus est obligatoire" });
    const respondedAt = new Date();

    const eventType = accepted ? "REPAIR_PROFESSIONALLY_ATTESTED" : "REPAIR_CLAIM_REJECTED";
    const event = await LifecycleEvent.create({
      eventId: generateId("EVT"), product: repair.product._id, type: eventType, actor: req.user._id,
      description: note || (accepted ? "Certified repairer accepted the repair claim" : "Certified repairer rejected the repair claim"),
      document: repair.evidenceDocument || null, hash: repair.evidenceHash || null, relatedEvent: repair.lifecycleEvent,
      sourceRef: `${repair.repairId}:${eventType}:${Date.now()}`,
      provenance: createProvenance({
        actor: req.user,
        claimType: "REPAIR",
        verificationLevel: accepted ? "REPAIRER_VERIFIED" : "OWNER_REPORTED",
        verificationStatus: accepted ? "PROFESSIONALLY_ATTESTED" : (repair.evidenceDocument ? "EVIDENCE_SUBMITTED" : "OWNER_DECLARED"),
        documentId: repair.evidenceDocument || null,
        evidenceReferences: repair.evidenceDocument ? [String(repair.evidenceDocument)] : [],
        evidenceHash: repair.evidenceHash || null,
        verifier: accepted ? req.user : null,
        integrityStatus: repair.evidenceDocument ? EVIDENCE_INTEGRITY_STATUSES.UNVERIFIED : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN,
        verifiedAt: accepted ? respondedAt : null
      })
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: repair.product, lifecycleEvent: event, actor: req.user });
    request.status = accepted ? "ACCEPTED" : "REJECTED";
    request.responseNote = note || null;
    request.respondedBy = req.user._id;
    request.respondedAt = respondedAt;
    request.responseEvent = event._id;
    repair.verificationDecision = accepted ? "PROFESSIONALLY_ATTESTED" : "REJECTED";
    if (accepted) {
      repair.repairer = req.user._id;
      repair.signature = signature;
      repair.signatureSignedAt = respondedAt;
      repair.signatureSigner = req.user._id;
      repair.signatureValid = null;
      repair.provenance.verificationStatus = "PROFESSIONALLY_ATTESTED";
      repair.provenance.verificationLevel = "REPAIRER_VERIFIED";
      repair.provenance.verifier = { actorId: req.user._id, role: req.user.role, verifiedAt: respondedAt };
      repair.provenance.verifiedAt = respondedAt;
      if (blockchain.status === "CONFIRMED") {
        repair.provenance.recordingStatus = "BLOCKCHAIN_RECORDED";
        repair.provenance.blockchain = {
          topicId: blockchain.topicId,
          sequenceNumber: blockchain.sequenceNumber,
          transactionId: blockchain.transactionId,
          consensusTimestamp: blockchain.consensusTimestamp
        };
      }
    }
    await request.save();
    await repair.save();
    res.status(201).json({ message: accepted ? "Repair professionally attested" : "Repair claim rejected and preserved", request: repairRequestView(request), event, hederaStatus: blockchain.status, signatureValid: null });
  } catch (error) { next(error); }
}

module.exports = { list, respond };