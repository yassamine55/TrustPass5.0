const fs = require("fs");
const crypto = require("crypto");

const baseUrl = "http://localhost:5000/api";
const runId = Date.now().toString(36);
const password = `E2e-${runId}-password`;
const results = [];
const state = { users: {}, product: null, events: [], document: null, repairs: [] };

function pass(name, detail = "") {
  results.push({ name, status: "PASS", detail });
  console.log(`PASS | ${name}${detail ? ` | ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, status: "FAIL", detail });
  console.log(`FAIL | ${name} | ${detail}`);
}

async function request(name, method, path, options = {}, expected = []) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.headers || {}) },
      body: options.body instanceof FormData ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (expected.includes(response.status)) return { response, body };
    fail(name, `${response.status} ${JSON.stringify(body)}`);
    return { response, body };
  } catch (error) {
    fail(name, error.message);
    return { response: null, body: null };
  }
}

async function expect(name, method, path, options, status, check) {
  const result = await request(name, method, path, options, [status]);
  if (!result.response || result.response.status !== status) return result;
  try {
    if (check) check(result.body);
    pass(name, `${status}`);
  } catch (error) {
    fail(name, error.message);
  }
  return result;
}

function requireValue(value, label) {
  if (!value) throw new Error(`${label} missing`);
  return value;
}

async function registerAndLogin(role, label) {
  const email = `e2e-${label.toLowerCase()}-${runId}@example.test`;
  const registration = await expect(`register ${role}`, "POST", "/auth/register", {
    body: { firstName: "E2E", lastName: label, email, password, role },
  }, 201, body => {
    requireValue(body.user?._id, `${role} user id`);
    requireValue(body.token, `${role} registration token`);
  });
  if (!registration.body) return;
  const login = await expect(`login ${role}`, "POST", "/auth/login", {
    body: { email, password },
  }, 200, body => requireValue(body.token, `${role} login token`));
  state.users[role] = {
    id: registration.body.user._id,
    token: login.body.token,
    email,
    hederaAccountId: registration.body.user.hederaAccountId,
  };
}

async function main() {
  await expect("health", "GET", "/health", {}, 200, body => {
    if (body.status !== "OK") throw new Error("unexpected health response");
  });

  await registerAndLogin("OWNER", "Owner");
  await registerAndLogin("REPAIRER", "Repairer");
  await registerAndLogin("BUYER", "Buyer");

  const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const adminLogin = await expect("admin login", "POST", "/auth/login", {
    body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
  }, 200, body => requireValue(body.token, "admin token"));
  const adminToken = adminLogin.body?.token;

  await expect("repairer verification", "PATCH", `/admin/users/${state.users.REPAIRER.id}/verify`, {
    token: adminToken,
  }, 200, body => {
    if (!body.user?.isVerified) throw new Error("repairer is not verified");
  });
  await expect("buyer verification", "PATCH", `/admin/users/${state.users.BUYER.id}/verify`, {
    token: adminToken,
  }, 200);

  const product = await expect("OWNER creates product/passport and real NFT", "POST", "/passports", {
    token: state.users.OWNER.token,
    body: {
      brand: "E2E Brand", model: `E2E-${runId}`, serialNumberHash: crypto.createHash("sha256").update(runId).digest("hex"),
      manufacturer: "E2E Manufacturer", category: "PHONE", description: "isolated application E2E device",
    },
  }, 201, body => {
    requireValue(body.product?._id, "product id");
    requireValue(body.product?.passportId, "passport id");
    if (body.product.hederaStatus !== "CONFIRMED") throw new Error(`NFT status ${body.product.hederaStatus}`);
    requireValue(body.product.hederaTokenId, "NFT token id");
    requireValue(body.product.hederaSerialNumber, "NFT serial");
  });
  state.product = product.body?.product;

  await expect("PRODUCT_CREATED HCS", "GET", `/products/${state.product?._id}/events`, { token: state.users.OWNER.token }, 200, body => {
    const event = body.find(item => item.type === "PRODUCT_CREATED");
    if (!event || event.hederaStatus !== "CONFIRMED") throw new Error("confirmed PRODUCT_CREATED event missing");
    state.events.push(event);
  });

  await expect("direct end-of-life endpoint removed", "POST", `/passports/${state.product?._id}/end-of-life`, { token: state.users.OWNER.token, body: {} }, 404);
  await expect("invalid transition", "POST", `/products/${state.product?._id}/events`, { token: state.users.OWNER.token, body: { type: "LISTED_FOR_PARTS", description: "invalid before EOL" } }, 409);
  await expect("dedicated workflow enforcement", "POST", `/products/${state.product?._id}/events`, { token: state.users.OWNER.token, body: { type: "REPAIR", description: "must use repair endpoint" } }, 409);

  const form = new FormData();
  form.append("file", new Blob([`repair evidence ${runId}`], { type: "text/plain" }), "repair-evidence.txt");
  const upload = await expect("repair evidence upload and SHA-256", "POST", "/documents", { token: state.users.REPAIRER.token, body: form }, 201, body => requireValue(body.document?._id, "document id"));
  state.document = upload.body?.document;

  const repairBody = { product: state.product?._id, description: "Replaced display assembly", changedParts: ["display"], price: 125, date: new Date().toISOString(), documentId: state.document?._id };
  const repair = await expect("REPAIR and REPAIR HCS", "POST", "/repairs", { token: state.users.REPAIRER.token, body: repairBody }, 201, body => {
    if (body.repair?.hederaStatus !== "CONFIRMED") throw new Error("repair HCS not confirmed");
    if (body.repair?.evidenceHash !== state.document?.sha256) throw new Error("repair evidence hash mismatch");
  });
  state.repairs.push(repair.body?.repair);

  await expect("repairer verification/signature contract", "POST", "/repairs", { token: state.users.REPAIRER.token, body: { ...repairBody, description: "Signature contract probe", signature: Buffer.from("invalid").toString("base64") } }, 400, body => {
    if (!body?.message) throw new Error("missing signature validation response");
  });
  await expect("protected document access", "GET", `/documents/${state.document?._id}/verify`, { token: state.users.BUYER.token }, 403);
  await expect("repair evidence API verification", "GET", `/verify/evidence/${state.document?._id}`, {}, 200, body => {
    if (!body.valid || body.expectedHash !== state.document.sha256 || body.actualHash !== state.document.sha256) throw new Error("evidence verification mismatch");
  });

  const repairAgain = await expect("second repair if allowed", "POST", "/repairs", { token: state.users.REPAIRER.token, body: { ...repairBody, description: "Second repair", documentId: undefined } }, 201, body => {
    if (body.repair?.hederaStatus !== "CONFIRMED") throw new Error("second repair HCS not confirmed");
  });
  state.repairs.push(repairAgain.body?.repair);

  const transfer = await expect("RESALE request", "POST", "/transfers", { token: state.users.OWNER.token, body: { product: state.product?._id, toOwner: state.users.BUYER.id } }, 201, body => requireValue(body.transfer?._id, "transfer id"));
  const transferId = transfer.body?.transfer?._id;
  await expect("BUYER normal second-hand purchase / ownership transfer / NFT transfer", "POST", `/transfers/${transferId}/accept`, { token: state.users.BUYER.token }, 200, body => {
    if (body.transfer?.hederaStatus !== "CONFIRMED") throw new Error("NFT transfer not confirmed");
  });

  await expect("duplicate transfer acceptance prevention", "POST", `/transfers/${transferId}/accept`, { token: state.users.BUYER.token }, 400);
  await expect("direct repairer end-of-life endpoint removed", "POST", `/passports/${state.product?._id}/end-of-life`, { token: state.users.REPAIRER.token, body: {} }, 404);
  await expect("completed normal transfer cannot be reused as a parts purchase", "POST", `/transfers/${transferId}/accept`, { token: state.users.BUYER.token }, 400);

  await expect("NFT verification endpoint", "GET", `/verify/nft/${state.product?.hederaTokenId}/${state.product?.hederaSerialNumber}`, {}, 200, body => { if (!body.valid) throw new Error("NFT invalid"); });
  const events = await expect("collect real lifecycle IDs", "GET", `/products/${state.product?._id}/events`, { token: state.users.OWNER.token }, 200, body => { if (!body.length) throw new Error("no events"); });
  const firstHederaEvent = events.body.find(event => event.hederaStatus === "CONFIRMED" && event.hederaSequenceNumber);
  await expect("lifecycle verification endpoint", "GET", `/verify/lifecycle/${firstHederaEvent?.hederaTopicId}/${firstHederaEvent?.hederaSequenceNumber}?eventId=${encodeURIComponent(firstHederaEvent?.eventId || "")}`, {}, 200, body => { if (!body.valid) throw new Error("lifecycle invalid"); });
  await expect("transaction verification endpoint", "GET", `/verify/transaction/${firstHederaEvent?.hederaTransactionId}`, {}, 200, body => { if (!body.valid) throw new Error("transaction invalid"); });
  await expect("history verification endpoint", "GET", `/verify/history/${state.product?.passportId}`, {}, 200, body => { if (!body.localEvents?.length || !body.mirrorEvents?.length) throw new Error("history incomplete"); });
  await expect("safe public passport response", "GET", `/public/passport/${state.product?.passportId}`, {}, 200, body => {
    const text = JSON.stringify(body);
    for (const secret of ["operatorKey", "HEDERA_OPERATOR_KEY", "privateKey", "JWT_SECRET"]) if (text.includes(secret)) throw new Error(`sensitive field ${secret} leaked`);
  });
  console.log(`SUMMARY | ${results.filter(result => result.status === "PASS").length} PASS | ${results.filter(result => result.status === "FAIL").length} FAIL`);
  if (results.some(result => result.status === "FAIL")) process.exitCode = 1;
}

main().catch(error => { console.error(`FATAL | ${error.stack || error}`); process.exitCode = 1; });