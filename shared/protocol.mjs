/**
 * @typedef {{type: "file-updated", filename: string | null}} FileUpdatedMessage
 * @typedef {{type: "load-artifact", content: string, filename?: string}} LoadArtifactMessage
 * @typedef {{type: "reset-slot"}} ResetSlotMessage
 * @typedef {LoadArtifactMessage | ResetSlotMessage} ClientMessage
 * @typedef {FileUpdatedMessage} ServerMessage
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null;
}

/**
 * @param {unknown} value
 * @returns {value is ClientMessage}
 */
export function isClientMessage(value) {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "reset-slot") {
    return true;
  }

  if (value.type === "load-artifact") {
    return (
      typeof value.content === "string" &&
      (value.filename === undefined || typeof value.filename === "string")
    );
  }

  return false;
}

/**
 * @param {unknown} value
 * @returns {value is ServerMessage}
 */
export function isServerMessage(value) {
  return (
    isRecord(value) &&
    value.type === "file-updated" &&
    (value.filename === null || typeof value.filename === "string")
  );
}
