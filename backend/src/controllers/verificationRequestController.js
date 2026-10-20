const {
  safeRequest,
  safeEvent,
  getReviewContext,
  createVerificationRequest,
  listVerificationRequests,
  getVerificationRequest,
  respondToVerificationRequest
} = require("../services/verificationRequestService");

async function create(req, res, next) {
  try {
    const error = new Error("Institution verification requests are disabled; submit a repair claim for certified repairer review");
    error.statusCode = 409;
    next(error);
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const requests = await listVerificationRequests({ user: req.user });
    const responses = await Promise.all(requests.map(async (request) => safeRequest(request, await getReviewContext(request))));
    res.json(responses);
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const request = await getVerificationRequest({ user: req.user, id: req.params.id });
    res.json({ request: safeRequest(request, await getReviewContext(request)) });
  } catch (error) {
    next(error);
  }
}

async function verify(req, res, next) {
  try {
    const result = await respondToVerificationRequest({
      user: req.user,
      institution: req.institution,
      id: req.params.id,
      verified: true,
      reason: req.body.reason
    });
    res.status(201).json({ message: "Claim institutionally verified", request: safeRequest(result.request, await getReviewContext(result.request)), event: safeEvent(result.event), hederaStatus: result.blockchain.status });
  } catch (error) {
    next(error);
  }
}

async function reject(req, res, next) {
  try {
    const result = await respondToVerificationRequest({
      user: req.user,
      institution: req.institution,
      id: req.params.id,
      verified: false,
      reason: req.body.reason
    });
    res.status(201).json({ message: "Claim rejected by institution", request: safeRequest(result.request, await getReviewContext(result.request)), event: safeEvent(result.event), hederaStatus: result.blockchain.status });
  } catch (error) {
    next(error);
  }
}

module.exports = { create, list, getOne, verify, reject };
