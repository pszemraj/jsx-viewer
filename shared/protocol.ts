function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export interface FileUpdatedMessage {
  type: "file-updated";
  filename: string | null;
}

export interface LoadArtifactMessage {
  type: "load-artifact" | "load-jsx";
  content: string;
  filename?: string;
}

export interface ResetSlotMessage {
  type: "reset-slot";
}

export type ClientMessage = LoadArtifactMessage | ResetSlotMessage;
export type ServerMessage = FileUpdatedMessage;

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "reset-slot") {
    return true;
  }

  if (value.type === "load-artifact" || value.type === "load-jsx") {
    return (
      typeof value.content === "string" &&
      (value.filename === undefined || typeof value.filename === "string")
    );
  }

  return false;
}

export function isServerMessage(value: unknown): value is ServerMessage {
  return (
    isRecord(value) &&
    value.type === "file-updated" &&
    (value.filename === null || typeof value.filename === "string")
  );
}
