function blockchainSummary(product) {
  return {
    status: product.hederaStatus,
    tokenId: product.hederaTokenId,
    serialNumber: product.hederaSerialNumber,
    mintTransactionId: product.hederaMintTransactionId,
    verification: product.hederaTokenId && product.hederaSerialNumber
      ? `/api/verify/nft/${product.hederaTokenId}/${product.hederaSerialNumber}`
      : null
  };
}

module.exports = { blockchainSummary };