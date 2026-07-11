# TODO

- Generate `shared/protocol.d.mts` from a typed protocol source instead of maintaining it by hand alongside `shared/protocol.mjs`. CI checks that the shipped declaration matches the runtime module's exposed guard types and public declaration surface, but handwritten JSDoc and runtime validator logic can still drift.
- Revisit `LEGACY_RUNTIME_GRACE_MS` after the ownership-tracking migration has had time to age out. The current 7-day window is intentionally conservative for pre-owner temp dirs, but it should probably shrink or disappear once older installs are no longer active.
- If the viewer shell keeps growing, extract the inline chrome styles into shared tokens or scoped CSS so shell-only UI changes stop being a grep-through-`style={{}}` exercise.
