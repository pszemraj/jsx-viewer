# TODO

- Generate `shared/protocol.d.mts` from a typed protocol source instead of maintaining it by hand alongside `shared/protocol.mjs`. CI now enforces that the shipped declaration matches the JSDoc-exposed runtime guard types, but the declarations are still not emitted from a single source of truth.
