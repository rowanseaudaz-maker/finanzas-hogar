import { DATA_SCHEMA_VERSION, isValidFinanceData } from "./storage.js";

export function serializeFinanceBackup(data) {
  if (!isValidFinanceData(data)) {
    throw new TypeError("Cannot export invalid finance data");
  }

  return JSON.stringify(data, null, 2);
}

export function parseFinanceBackup(serializedData) {
  if (typeof serializedData !== "string") {
    return { valid: false, error: "invalid-json" };
  }

  let data;
  try {
    data = JSON.parse(serializedData);
  } catch {
    return { valid: false, error: "invalid-json" };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, error: "invalid-data" };
  }

  if (Object.hasOwn(data, "schemaVersion") && data.schemaVersion !== DATA_SCHEMA_VERSION) {
    return { valid: false, error: "unsupported-version" };
  }

  if (!isValidFinanceData(data)) {
    return { valid: false, error: "invalid-data" };
  }

  return { valid: true, data };
}