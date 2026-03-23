function isRecord(value) {
  return typeof value === "object" && value !== null;
}

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

export function isServerMessage(value) {
  return (
    isRecord(value) &&
    value.type === "file-updated" &&
    (value.filename === null || typeof value.filename === "string")
  );
}
