// Display metadata: English labels, resistance-band colors, status tones.
export const EVENTS = {
  PRODUCT_CREATED: { label: "Passport created", band: "var(--band-created)" },
  STOLEN_REPORTED: { label: "Device reported stolen", band: "var(--band-eol)" },
  INSPECTION_REQUESTED: { label: "Technical inspection requested", band: "var(--band-maintenance)" },
  PURCHASED: { label: "Purchase", band: "var(--band-purchased)" },
  TRANSFERRED: { label: "Transfer", band: "var(--band-resale)" },
  RESALE: { label: "Resale", band: "var(--band-resale)" },
  REPAIR: { label: "Repair", band: "var(--band-repair)" },
  REPAIR_CLAIM_SUBMITTED: { label: "Repair claim submitted", band: "var(--band-repair)" },
  REPAIR_CLAIM_REJECTED: { label: "Repair claim rejected", band: "var(--band-eol)" },
  REPAIR_PROFESSIONALLY_ATTESTED: { label: "Repair professionally attested", band: "var(--band-repair)" },
  REPAIR_OWNER_CONFIRMED: { label: "Repair confirmed by owner", band: "var(--band-repair)" },
  REPAIR_OWNER_DISPUTED: { label: "Repair disputed by owner", band: "var(--band-eol)" },
  REPAIR_OWNER_REJECTED: { label: "Repair rejected by owner", band: "var(--band-eol)" },
  INSTITUTION_VERIFIED: { label: "Demo verification", band: "var(--band-created)" },
  INSTITUTION_REJECTED: { label: "Institution rejected", band: "var(--band-eol)" },
  EVENT_DISPUTED: { label: "Event disputed", band: "var(--band-eol)" },
  EVENT_CORRECTED: { label: "Event corrected", band: "var(--band-maintenance)" },
  EVENT_REVOKED: { label: "Event revoked", band: "var(--band-eol)" },
  MAINTENANCE: { label: "Maintenance", band: "var(--band-maintenance)" },
  END_OF_LIFE: { label: "Device marked end of life", band: "var(--band-eol)" },
  LISTED_FOR_PARTS: { label: "Listed for parts", band: "var(--band-listed)" },
  SOLD_FOR_PARTS: { label: "Sold for parts", band: "var(--band-parts)" },
  RECYCLED: { label: "Recycled", band: "var(--band-recycled)" },
  DECOMMISSIONED: { label: "Taken out of service", band: "var(--band-decom)" }
};

export const STATUS = {
  ACTIVE: { label: "In service", tone: "ok" },
  MAINTENANCE: { label: "In maintenance", tone: "info" },
  END_OF_LIFE: { label: "End of life · Parts only", tone: "fail" },
  LISTED_FOR_PARTS: { label: "End of life · Parts only", tone: "warn" },
  SOLD_FOR_PARTS: { label: "Sold for parts", tone: "violet" },
  RECYCLED: { label: "Recycled", tone: "grey" },
  DECOMMISSIONED: { label: "Out of service", tone: "grey" }
};

export const PARTS_ONLY_STATUSES = ["END_OF_LIFE", "LISTED_FOR_PARTS", "SOLD_FOR_PARTS"];
export const isPartsOnlyStatus = (status) => PARTS_ONLY_STATUSES.includes(status);
export const statusLabel = (status) => isPartsOnlyStatus(status) ? "End of life · Parts only" : STATUS[status]?.label || status;

export const ROLES = {
  OWNER: { label: "Owner", help: "You own devices and track their history." },
  REPAIRER: { label: "Repairer", help: "You repair devices, perform technical inspections, and determine when a device can no longer reasonably be repaired." },
  BUYER: { label: "Buyer", help: "You buy used devices or devices sold for parts." },
  ADMIN: { label: "Administrator", help: "" }
};

export const CATEGORIES = ["Laptop", "Smartphone", "Tablet", "Television", "Game console", "Appliance", "Printer", "Other"];
export const isPhoneCategory = (category) => category === "Smartphone";

export const DOCUMENT_CATEGORIES = [
  ["PURCHASE_INVOICE", "Purchase invoice or receipt"],
  ["REPAIR_INVOICE", "Repair invoice"],
  ["REPAIR_DIAGNOSTIC_REPORT", "Repair diagnostic report"],
  ["WARRANTY_DOCUMENT", "Warranty document"],
  ["ORDER_CONFIRMATION", "Order confirmation"],
  ["REPLACEMENT_PART_DOCUMENT", "Replacement part document"],
  ["OTHER_SUPPORTING_DOCUMENT", "Other supporting document"]
];
