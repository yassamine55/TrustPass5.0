const { getHederaModule } = require("../services/hederaModule");

function getModuleOrFail() {
  const hedera = getHederaModule();
  if (!hedera) {
    const error = new Error("Hedera integration is disabled");
    error.statusCode = 503;
    throw error;
  }
  return hedera;
}

async function createTopic(req, res, next) {
  try {
    const result = await getModuleOrFail().lifecycleEvents.createTopic({ memo: req.body.memo });
    res.status(201).json({
      topicId: result.topicId,
      transactionId: result.transactionId,
      status: result.receiptStatus?.toString()
    });
  } catch (error) {
    next(error);
  }
}

async function createDeviceToken(req, res, next) {
  try {
    const result = await getModuleOrFail().deviceNft.createDeviceToken({
      name: req.body.name,
      symbol: req.body.symbol,
      memo: req.body.memo
    });
    res.status(201).json({
      tokenId: result.tokenId.toString(),
      transactionId: result.transactionId,
      status: result.receiptStatus?.toString()
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createTopic, createDeviceToken };