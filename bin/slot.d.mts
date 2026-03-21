export const ROOT: string;
export const SLOT: string;
export const PLACEHOLDER: string;

export function ensureSlotDir(): void;
export function writeSlot(content: string): void;
export function resetSlot(): void;
export function readSlot(): string | null;
export function slotMatchesPlaceholder(): boolean;
