import PapaParse from "papaparse";

// Export explicit bindings so the browser runtime preserves PapaParse's
// CommonJS-shaped public API after the Pages build bundles it as an entry.
export default PapaParse;
export const {
  BAD_DELIMITERS,
  BYTE_ORDER_MARK,
  DefaultDelimiter,
  DuplexStreamStreamer,
  FileStreamer,
  LocalChunkSize,
  NODE_STREAM_INPUT,
  NetworkStreamer,
  Parser,
  ParserHandle,
  RECORD_SEP,
  ReadableStreamStreamer,
  RemoteChunkSize,
  StringStreamer,
  UNIT_SEP,
  WORKERS_SUPPORTED,
  parse,
  unparse,
} = PapaParse;
