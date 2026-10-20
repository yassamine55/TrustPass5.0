# ReLoop Passport Backend

Backend MVP for **ReLoop Passport**, aligned with the project brief:

- no `INSPECTOR` role
- only one `ADMIN` account created by the bootstrap script
- Hedera-backed device identity and lifecycle evidence
- core application data stays in MongoDB

## Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT
- bcryptjs
- Multer
- Helmet
- CORS
- Rate limiting

## Roles

- `ADMIN` — single seeded administrator
- `OWNER`
- `REPAIRER`
- `BUYER`

There is no `INSPECTOR` role in this version.

Public registration cannot create an `ADMIN`.

## 1. Install

```bash
npm install
```

## 2. Create `.env`

Copy `.env.example` to `.env`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set at least:

```env
MONGO_URI=mongodb://localhost:27017/reloop
JWT_SECRET=replace_with_at_least_32_random_characters
ADMIN_EMAIL=admin@reloop.local
ADMIN_PASSWORD=your_admin_password
HEDERA_ENABLED=false
```

Ensure MongoDB is running.

## 3. Create the single admin

```bash
npm run seed:admin
```

Or directly from the root:

```bash
node seedAdmin.js
```

The script is idempotent: if an admin already exists, it does nothing.

## 4. Seed the public demo passport

The public landing page example uses passport `RLP-2026-F39BC90`. To create or resume it in MongoDB with a real Hedera NFT and HCS lifecycle history, configure `HEDERA_ENABLED=true`, valid `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY`, an existing `HEDERA_DEVICE_TOKEN_ID`, an existing `HEDERA_TOPIC_ID`, and a reachable `HEDERA_MIRROR_NODE_URL`, then run:

```bash
npm run seed:demo
```

The seed is idempotent and verifies the four demo events through Mirror Node. It stops before writing data when the real Hedera prerequisites are missing; it never creates fake blockchain references.

## 5. Start the backend

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

API base URL:

```text
http://localhost:5000/api
```

Health check:

```http
GET /api/health
```

## Main API

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Passports / products

- `POST /api/passports`
- `GET /api/passports`
- `GET /api/passports/:id`

### Repairs

- `POST /api/repairs`
- `GET /api/repairs`
- `GET /api/repairs/:id`

Only a verified `REPAIRER` can create a repair.

### Maintenance

- `POST /api/maintenance`
- `GET /api/maintenance`

### Transfers

- `POST /api/transfers`
- `POST /api/transfers/:id/accept`
- `GET /api/transfers/mine`

### Buyer and recycling

- `POST /api/recycling`
- `GET /api/recycling`

Only a verified `BUYER` can create physical recycling events after a parts purchase. Buyers purchase end-of-life devices only through the parts transfer workflow; they cannot purchase them as normal second-hand devices.

### Lifecycle events

- `POST /api/products/:productId/events`
- `GET /api/products/:productId/events`
- `GET /api/technical-inspections/available` (verified repairer)
- `POST /api/technical-inspections/:id/accept` (verified repairer)
- `POST /api/technical-inspections/:id/complete` (assigned verified repairer diagnosis)

Lifecycle transitions are enforced server-side:

`ACTIVE/MAINTENANCE -> END_OF_LIFE -> LISTED_FOR_PARTS -> SOLD_FOR_PARTS -> RECYCLED or DECOMMISSIONED`

`END_OF_LIFE` is created only by a signed, request-associated diagnosis from an authorized repairer. `RECYCLED` records completed physical recycling after a parts purchase; it is not an alternative end-of-life diagnosis.

Repairs and maintenance use their dedicated endpoints. Purchases, resale, and parts sales use the transfer workflow. Direct lifecycle requests cannot bypass those workflows.

### Documents

- `POST /api/documents` with multipart field `file`
- `GET /api/documents/:id/download` (authorized uploader/admin)
- `GET /api/documents/:id/verify`

Uploaded files receive a SHA-256 hash for integrity verification.

### Public passport

- `GET /api/public/passport/:passportId`

The response includes safe NFT identifiers, publication status, and a verification URL. It never includes operator credentials or private keys.

### Verification

- `GET /api/verify/nft/:tokenId/:serialNumber`
- `GET /api/verify/lifecycle/:topicId/:sequenceNumber`
- `GET /api/verify/evidence/:documentId`
- `GET /api/verify/transaction/:transactionId`
- `GET /api/verify/history/:passportId`

Verification endpoints expose only public blockchain/evidence results. Mirror Node failures are returned as safe errors.

### Optional institution verification

Institution verification is an opt-in independent review of an existing lifecycle claim; it is not part of every repair.

The implementation is explicit about the verification source:

- `DEMO_TEST` means the application is simulating an institution review without any real external verifier connected.
- `EXTERNAL_VERIFICATION` means the workflow is running through a real external institution verification system.

At present, the default mode is `DEMO_TEST`. When that mode is active, the UI and API must label the result as `DEMO VERIFICATION` and never present it as a real external verification.

- `POST /api/verification-requests` — create a verification request for a lifecycle event.
- `GET /api/verification-requests` — list verification requests visible to the requester or institution.
- `GET /api/verification-requests/:id` — inspect a request and the review context.
- `POST /api/verification-requests/:id/verify` — verified user of the target institution only.
- `POST /api/verification-requests/:id/reject` — reject a verification request.

Responses create new `INSTITUTION_VERIFIED` or `INSTITUTION_REJECTED` lifecycle events linked to the original claim. The original event is never overwritten. The backend includes `verificationSource` and `externalSystemConnected` in review context and event payloads, so the UI can show `DEMO VERIFICATION` or `EXTERNAL VERIFICATION` without ambiguity.

For judges and reviewers: this institution workflow is simulated by design in demo mode. It does not verify against a real manufacturer, service-center database, or recycling registry. Any result shown as `DEMO VERIFICATION` is informational only and is not an external certification.

### Admin

- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/verify`
- `PATCH /api/admin/users/:id/status`
- `POST /api/admin/companies`
- `GET /api/admin/companies`
- `PATCH /api/admin/companies/:id/verify`
- `GET /api/admin/stats`
- `POST /api/admin/hedera/topic`
- `POST /api/admin/hedera/device-token`

## Authorization

Protected requests use:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## Hedera integration

Set `HEDERA_ENABLED=true` with valid operator credentials, topic ID, and device token ID to enable NFT minting and HCS lifecycle publication. MongoDB remains the application database and stores Hedera transaction references and publication status.

Product creation mints the device NFT and publishes `PRODUCT_CREATED`. Repairs, maintenance, purchases, resale, end-of-life, parts, recycling, and decommissioning publish HCS lifecycle evidence. NFT transfers require Hedera account IDs for both owners when Hedera is enabled.

Every blockchain operation is represented in MongoDB as `PENDING`, `CONFIRMED`, or `FAILED`. Failed operations retain an internal error for reconciliation and are never reported as confirmed.

### Role permissions

- `ADMIN`: user/company administration and Hedera setup.
- `OWNER`: create passports, maintain owned devices, request sales/transfers, list owned end-of-life devices for parts.
- `REPAIRER`: verified repairs and verified end-of-life decisions.
- `BUYER`: purchase normal devices while eligible, purchase listed end-of-life devices only for parts, and record physical recycling or decommissioning after a parts purchase.

### Build and test

```bash
npm install
npm run build
npm test
npm start
```

`npm start` and `npm run dev` compile the TypeScript Hedera module before starting the CommonJS Express backend.

Uploaded documents are not publicly served. Access requires authentication and ownership/admin authorization; SHA-256 evidence can be verified through the verification endpoint.
