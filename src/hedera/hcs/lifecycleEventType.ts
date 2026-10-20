export const DEVICE_LIFECYCLE_EVENT_TYPES = [
  "PRODUCT_CREATED",
  "PURCHASED",
  "TRANSFERRED",
  "REPAIR",
  "MAINTENANCE",
  "INSPECTION",
  "RESALE",
  "END_OF_LIFE",
  "LISTED_FOR_PARTS",
  "SOLD_FOR_PARTS",
  "RECYCLED",
  "DECOMMISSIONED",
] as const;

export type DeviceLifecycleEventType =
  (typeof DEVICE_LIFECYCLE_EVENT_TYPES)[number];

export function isDeviceLifecycleEventType(
  value: string,
): value is DeviceLifecycleEventType {
  return (DEVICE_LIFECYCLE_EVENT_TYPES as readonly string[]).includes(value);
}
