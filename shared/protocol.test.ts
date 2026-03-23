import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  ClientMessage as DeclaredClientMessage,
  ServerMessage as DeclaredServerMessage,
} from "./protocol.d.mts";
import { isClientMessage, isServerMessage } from "./protocol.mjs";

type MessageCase = readonly [name: string, message: unknown, expected: boolean];
type TypedMessageCase<TMessage> = readonly [name: string, message: TMessage];
type GuardedType<TGuard> =
  TGuard extends (value: unknown) => value is infer TMessage ? TMessage : never;
type IsExactly<TLeft, TRight> = (<TValue>() => TValue extends TLeft ? 1 : 2) extends <
  TValue,
>() => TValue extends TRight ? 1 : 2
  ? (<TValue>() => TValue extends TRight ? 1 : 2) extends <
      TValue,
    >() => TValue extends TLeft ? 1 : 2
    ? true
    : false
  : false;
type Assert<TValue extends true> = TValue;

// Keep the shipped declaration file and the JSDoc-exposed runtime guard
// surface in lockstep. If either side drifts, typecheck fails in CI.
type RuntimeClientMessage = GuardedType<typeof isClientMessage>;
type RuntimeServerMessage = GuardedType<typeof isServerMessage>;
type _ClientMessageContractMatches = Assert<
  IsExactly<RuntimeClientMessage, DeclaredClientMessage>
>;
type _ServerMessageContractMatches = Assert<
  IsExactly<RuntimeServerMessage, DeclaredServerMessage>
>;

const declarationSource = readFileSync(
  new URL("./protocol.d.mts", import.meta.url),
  "utf8",
);

const validClientMessageCases = [
  [
    "accepts load-artifact client messages",
    {
      type: "load-artifact",
      content: "export default function Example() { return null; }",
      filename: "Example.tsx",
    },
  ],
  ["accepts reset-slot client messages", { type: "reset-slot" }],
] as const satisfies readonly TypedMessageCase<DeclaredClientMessage>[];

const validServerMessageCases = [
  ["accepts file-updated payloads with a filename", { type: "file-updated", filename: "Example.tsx" }],
  ["accepts file-updated payloads without a filename", { type: "file-updated", filename: null }],
] as const satisfies readonly TypedMessageCase<DeclaredServerMessage>[];

const clientMessageCases: MessageCase[] = [
  ...validClientMessageCases.map(([name, message]) => [name, message, true] as const),
  [
    "rejects the removed load-jsx client alias",
    {
      type: "load-jsx",
      content: "export default function Legacy() { return null; }",
    },
    false,
  ],
  ["rejects incomplete load-artifact client messages", { type: "load-artifact" }, false],
  ["accepts reset-slot client messages with extra properties", { type: "reset-slot", extra: true }, true],
];

for (const [name, message, expected] of clientMessageCases) {
  test(name, () => {
    assert.equal(isClientMessage(message), expected);
  });
}

const serverMessageCases: MessageCase[] = [
  ...validServerMessageCases.map(([name, message]) => [name, message, true] as const),
  ["rejects file-updated payloads with an invalid filename", { type: "file-updated", filename: 3 }, false],
  ["rejects unknown server payload types", { type: "unknown", filename: null }, false],
];

for (const [name, message, expected] of serverMessageCases) {
  test(name, () => {
    assert.equal(isServerMessage(message), expected);
  });
}

test("shipped protocol declaration stays aligned with the current runtime surface", () => {
  for (const pattern of [
    /export interface FileUpdatedMessage/,
    /type:\s*"file-updated";/,
    /filename:\s*string \| null;/,
    /export interface LoadArtifactMessage/,
    /type:\s*"load-artifact";/,
    /content:\s*string;/,
    /filename\?:\s*string;/,
    /export interface ResetSlotMessage/,
    /type:\s*"reset-slot";/,
    /export type ClientMessage = LoadArtifactMessage \| ResetSlotMessage;/,
    /export type ServerMessage = FileUpdatedMessage;/,
    /export function isClientMessage\(value: unknown\): value is ClientMessage;/,
    /export function isServerMessage\(value: unknown\): value is ServerMessage;/,
  ]) {
    assert.match(declarationSource, pattern);
  }
});
