const INSPECTION_ITEM_STATUSES = Object.freeze(["PASS", "WARNING", "FAIL", "NOT_TESTED"]);
const DEVICE_CATEGORIES = Object.freeze([
  "Laptop",
  "Smartphone",
  "Tablet",
  "Television",
  "Game console",
  "Appliance",
  "Printer",
  "Other"
]);

const INSPECTION_ITEMS = Object.freeze([
  ["model", "Identity", "Model"],
  ["serialNumber", "Identity", "Serial number"],
  ["imei", "Identity", "IMEI"],
  ["screen", "Display", "Screen"],
  ["battery", "Power", "Battery"],
  ["camera", "Camera", "Camera"],
  ["microphone", "Audio", "Microphone"],
  ["speaker", "Audio", "Speaker"],
  ["chargingPort", "Power", "Charging port"],
  ["buttons", "Controls", "Buttons"],
  ["biometrics", "Security", "Fingerprint / Face ID"],
  ["wifi", "Connectivity", "Wi-Fi"],
  ["bluetooth", "Connectivity", "Bluetooth"],
  ["scratches", "Physical", "Scratches"],
  ["cracks", "Physical", "Cracks"],
  ["waterDamage", "Physical", "Water damage"],
  ["bodyCondition", "Physical", "Body condition"],
  ["boots", "Software", "Boots"],
  ["operatingSystem", "Software", "Operating system status"],
  ["diagnosticErrors", "Software", "Diagnostic errors"],
  ["powerSupply", "Power", "Power supply"],
  ["remoteControl", "Controls", "Remote control"],
  ["audioOutput", "Audio", "Audio output"],
  ["displayPanel", "Display", "Display panel"],
  ["inputPorts", "Connectivity", "Inputs / ports"],
  ["motor", "Mechanical", "Motor"],
  ["compressor", "Mechanical", "Compressor"],
  ["drainage", "Mechanical", "Drainage / water removal"],
  ["doorSeal", "Mechanical", "Door seal"],
  ["keyboard", "Input", "Keyboard"],
  ["trackpad", "Input", "Trackpad"],
  ["storage", "Storage", "Storage"],
  ["ports", "Connectivity", "Ports"],
  ["fan", "Cooling", "Cooling fan"],
  ["paperPath", "Mechanical", "Paper path"],
  ["carrier", "Mechanical", "Carrier / print head path"]
]);

const CATEGORY_INSPECTION_IDS = Object.freeze({
  Smartphone: ["model", "serialNumber", "imei", "screen", "battery", "camera", "microphone", "speaker", "chargingPort", "buttons", "biometrics", "wifi", "bluetooth", "scratches", "cracks", "waterDamage", "bodyCondition", "boots", "operatingSystem", "diagnosticErrors"],
  Laptop: ["model", "serialNumber", "screen", "battery", "chargingPort", "keyboard", "trackpad", "storage", "ports", "bodyCondition", "boots", "operatingSystem", "diagnosticErrors"],
  Tablet: ["model", "serialNumber", "screen", "battery", "camera", "microphone", "speaker", "chargingPort", "wifi", "bluetooth", "bodyCondition", "boots", "operatingSystem", "diagnosticErrors"],
  Television: ["model", "serialNumber", "screen", "displayPanel", "powerSupply", "remoteControl", "audioOutput", "inputPorts", "bodyCondition", "boots"],
  "Game console": ["model", "serialNumber", "screen", "powerSupply", "ports", "bodyCondition", "boots", "storage", "diagnosticErrors"],
  Appliance: ["model", "serialNumber", "powerSupply", "motor", "compressor", "drainage", "doorSeal", "bodyCondition", "fan", "boots"],
  Printer: ["model", "serialNumber", "powerSupply", "ports", "bodyCondition", "paperPath", "carrier", "boots"],
  Other: ["model", "serialNumber", "bodyCondition", "boots"]
});

const INSPECTION_ITEM_IDS = Object.freeze(INSPECTION_ITEMS.map(([id]) => id));
const RELEVANT_INSPECTION_EVENTS = new Set([
  "REPAIR",
  "MAINTENANCE",
  "EVENT_DISPUTED",
  "EVENT_CORRECTED",
  "EVENT_REVOKED",
  "END_OF_LIFE",
  "LISTED_FOR_PARTS",
  "SOLD_FOR_PARTS",
  "RECYCLED",
  "DECOMMISSIONED",
  "REPAIR_OWNER_CONFIRMED",
  "REPAIR_OWNER_DISPUTED"
]);

function getInspectionChecklistForCategory(category) {
  const normalized = DEVICE_CATEGORIES.includes(category) ? category : "Other";
  const requiredIds = CATEGORY_INSPECTION_IDS[normalized] || CATEGORY_INSPECTION_IDS.Other;
  const itemsById = new Map(INSPECTION_ITEMS.map(([id, group, label]) => [id, { id, category: group, label }]));
  return requiredIds.map((id) => itemsById.get(id)).filter(Boolean);
}

function validateInspectionChecklist(checklist, category) {
  if (!Array.isArray(checklist)) {
    throw new Error("A complete inspection checklist is required");
  }
  const expected = new Set((getInspectionChecklistForCategory(category || "Other")).map((item) => item.id));
  const provided = new Set(checklist.map((item) => item.itemId));

  const missing = [...expected].filter((id) => !provided.has(id));
  const unexpected = [...provided].filter((id) => !expected.has(id));
  if (missing.length || unexpected.length) {
    const details = [];
    if (missing.length) details.push(`missing required fields: ${missing.join(", ")}`);
    if (unexpected.length) details.push(`unexpected fields for ${category || "Other"}: ${unexpected.join(", ")}`);
    throw new Error(details.join("; "));
  }

  for (const item of checklist) {
    if (!item || typeof item.itemId !== "string") {
      throw new Error("Each inspection checklist item must include an itemId");
    }
    if (!INSPECTION_ITEM_STATUSES.includes(item.status)) {
      throw new Error(`Invalid inspection status for ${item.itemId}`);
    }
  }
  return true;
}

function assertInspectionAssignedRepairer({ inspection, user }) {
  const assignedRepairer = inspection?.assignedRepairer?._id || inspection?.assignedRepairer;
  if (!assignedRepairer || assignedRepairer.toString() !== user?._id?.toString()) {
    const error = new Error("Only the assigned repairer can modify this inspection");
    error.statusCode = 403;
    error.code = "TECHNICAL_INSPECTION_ASSIGNMENT_FORBIDDEN";
    throw error;
  }
}

function assertInspectionRequestDecision({ inspection, action, user }) {
  if (!user || user.role !== "ADMIN") {
    const error = new Error("Only admins can assign or reject inspection requests");
    error.statusCode = 403;
    throw error;
  }
  if (!["ASSIGN", "REJECT"].includes(action)) {
    throw new Error("Request action must be ASSIGN or REJECT");
  }
  if (inspection?.status !== "REQUESTED") {
    const error = new Error("This inspection request is no longer awaiting an admin decision");
    error.statusCode = 409;
    throw error;
  }
  if ((inspection?.reviewStatus || "NOT_SUBMITTED") !== "NOT_SUBMITTED") {
    const error = new Error("This is not a new inspection request");
    error.statusCode = 409;
    throw error;
  }
  if (action === "ASSIGN" && inspection.assignedRepairer) {
    const error = new Error("This inspection request is already assigned");
    error.statusCode = 409;
    throw error;
  }
  return action;
}

function assertInspectionReviewAction({ product, inspection, action, user }) {
  if (!user || user.role !== "ADMIN") {
    const error = new Error("Only admins can review technical inspections");
    error.statusCode = 403;
    error.code = "TECHNICAL_INSPECTION_REVIEW_FORBIDDEN";
    throw error;
  }

  if (!action || !["APPROVE", "REJECT", "REQUEST_EVIDENCE"].includes(action)) {
    throw new Error("Review action must be APPROVE, REJECT, or REQUEST_EVIDENCE");
  }

  const reviewStatus = inspection?.reviewStatus || "NOT_SUBMITTED";
  if (["APPROVED", "REJECTED"].includes(reviewStatus)) {
    const error = new Error("This inspection has already been reviewed");
    error.statusCode = 409;
    error.code = "TECHNICAL_INSPECTION_ALREADY_REVIEWED";
    throw error;
  }

  if (!["PENDING_REVIEW", "ADDITIONAL_EVIDENCE_REQUIRED"].includes(reviewStatus)) {
    const error = new Error("This inspection is not awaiting review");
    error.statusCode = 409;
    error.code = "TECHNICAL_INSPECTION_NOT_AWAITING_REVIEW";
    throw error;
  }

  return { action, productStatusBeforeReview: inspection?.previousLifecycleStatus || product?.status || null };
}

function summarizeInspectionState(checklist = []) {
  return checklist
    .map((item) => `${item.label}: ${item.status}`)
    .join("; ")
    .slice(0, 2500);
}

function getInspectionValidity({ product, events = [] }) {
  const inspection = product?.technicalInspection;
  if (!inspection || inspection.status !== "TECHNICALLY_VERIFIED") {
    return {
      isCurrent: false,
      inspectionDate: inspection?.inspectedAt || inspection?.performedAt || null,
      inspectedState: inspection?.inspectedState || null,
      inspector: inspection?.inspector || inspection?.performedBy || null,
      affectedBy: [],
      reason: "No approved technical inspection is currently valid.",
      validityStatus: "HISTORICAL"
    };
  }

  const inspectionDate = inspection.inspectedAt || inspection.performedAt || null;
  const affectedBy = [...new Set((events || [])
    .filter((event) => {
      if (!event || !event.type || !event.createdAt || !inspectionDate) return false;
      const eventDate = new Date(event.createdAt);
      const inspectedAt = new Date(inspectionDate);
      if (Number.isNaN(eventDate.getTime()) || Number.isNaN(inspectedAt.getTime())) return false;
      if (eventDate <= inspectedAt) return false;
      if (event.type === "TRANSFERRED" || event.type === "PURCHASED") return false;
      return RELEVANT_INSPECTION_EVENTS.has(event.type);
    })
    .map((event) => event.type))];

  if (affectedBy.length > 0) {
    const lastRelevantEventAt = (events || [])
      .filter((event) => affectedBy.includes(event.type))
      .map((event) => new Date(event.createdAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b - a)[0];

    return {
      isCurrent: false,
      inspectionDate,
      inspectedState: inspection.inspectedState || summarizeInspectionState(inspection.checklist || []),
      inspector: inspection.inspector || inspection.performedBy || null,
      affectedBy,
      lastRelevantEventAt: lastRelevantEventAt || null,
      reason: `Historical inspection remains tied to the state as recorded on ${inspectionDate}. Later relevant lifecycle changes (${affectedBy.join(", ")}) mean the current device state is no longer guaranteed to match that inspection.`,
      validityStatus: "AFFECTED"
    };
  }

  return {
    isCurrent: true,
    inspectionDate,
    inspectedState: inspection.inspectedState || summarizeInspectionState(inspection.checklist || []),
    inspector: inspection.inspector || inspection.performedBy || null,
    affectedBy: [],
    lastRelevantEventAt: null,
    reason: inspectionDate ? `Inspection valid for the recorded state as of ${inspectionDate}; no later relevant device change is recorded.` : "Inspection valid for the recorded state; no later relevant device change is recorded.",
    validityStatus: "CURRENT"
  };
}

module.exports = {
  DEVICE_CATEGORIES,
  INSPECTION_ITEM_STATUSES,
  INSPECTION_ITEMS,
  INSPECTION_ITEM_IDS,
  getInspectionChecklistForCategory,
  validateInspectionChecklist,
  assertInspectionAssignedRepairer,
  assertInspectionRequestDecision,
  assertInspectionReviewAction,
  summarizeInspectionState,
  getInspectionValidity,
  RELEVANT_INSPECTION_EVENTS
};