export interface FileUpdatedMessage {
  type: "file-updated";
  filename: string | null;
}

export interface LoadArtifactMessage {
  type: "load-artifact";
  content: string;
  filename?: string;
}

export interface ResetSlotMessage {
  type: "reset-slot";
}

export type ClientMessage = LoadArtifactMessage | ResetSlotMessage;
export type ServerMessage = FileUpdatedMessage;

export function isClientMessage(value: unknown): value is ClientMessage;
export function isServerMessage(value: unknown): value is ServerMessage;
