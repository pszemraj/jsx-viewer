import assert from "node:assert/strict";
import test from "node:test";
import { isClientMessage, isServerMessage } from "./protocol.mjs";

type MessageCase = readonly [name: string, message: unknown, expected: boolean];

const clientMessageCases: MessageCase[] = [
  [
    "accepts load-artifact client messages",
    {
      type: "load-artifact",
      content: "export default function Example() { return null; }",
      filename: "Example.tsx",
    },
    true,
  ],
  ["accepts reset-slot client messages", { type: "reset-slot" }, true],
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
  ["accepts file-updated payloads with a filename", { type: "file-updated", filename: "Example.tsx" }, true],
  ["accepts file-updated payloads without a filename", { type: "file-updated", filename: null }, true],
  ["rejects file-updated payloads with an invalid filename", { type: "file-updated", filename: 3 }, false],
  ["rejects unknown server payload types", { type: "unknown", filename: null }, false],
];

for (const [name, message, expected] of serverMessageCases) {
  test(name, () => {
    assert.equal(isServerMessage(message), expected);
  });
}
