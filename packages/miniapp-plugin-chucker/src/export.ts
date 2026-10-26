/**
 * AI-friendly plain-text exporter for Chucker logs.
 *
 * Output layout (stable, line-oriented, easy for LLMs / grep to parse):
 *
 *   #CHUCKER_EXPORT v1
 *   #KEY: value                       <- file header metadata
 *   ## INDEX                          <- one summary line per entry
 *   ## SECTION: NETWORK (CURL)        <- every HTTP / upload / download call as cURL
 *   ## SECTION: NATIVE API            <- every invokeNativePlugin call
 *   ## SECTION: OTHER                 <- console / custom chuckerStore.log entries
 *   #END_OF_EXPORT
 *
 * Every entry starts with `=== ENTRY <n> ===` and ends with `=== END ENTRY <n> ===`.
 * Scalar fields are `KEY: value`. Multi-line blocks are wrapped in
 * `<<<BLOCK_NAME` ... `BLOCK_NAME>>>` so they can be extracted without ambiguity.
 */
import type { ChuckerLog } from "./store";
import { generateCurl, formatJson } from "./utils";

export interface ExportOptions {
  /** Max characters kept per body block (request/response). 0 = unlimited. @default 20000 */
  maxBodyLength?: number;
  /** Include console logs captured with `console: true`. @default false */
  includeConsole?: boolean;
  /** Free text written into the header (e.g. app version, tester name). */
  note?: string;
}

const NETWORK_TYPES = ["network", "http", "upload", "download"];

function isNetwork(log: ChuckerLog) {
  return !log.type || NETWORK_TYPES.indexOf(String(log.type)) !== -1;
}
function isNative(log: ChuckerLog) {
  return log.type === "native";
}

function iso(ts?: number) {
  if (!ts) return "-";
  try {
    return new Date(ts).toISOString();
  } catch (_e) {
    return String(ts);
  }
}

function clip(text: string, max: number) {
  if (!max || text.length <= max) return text;
  return text.slice(0, max) + `\n...[TRUNCATED ${text.length - max} chars]`;
}

function oneLine(v: any) {
  if (v === undefined || v === null || v === "") return "-";
  return String(v).replace(/\s*\n\s*/g, " ");
}

function block(name: string, value: any, max: number): string {
  const empty = value === undefined || value === null || value === "";
  const isEmptyObj =
    !empty && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
  const body = empty || isEmptyObj ? "(empty)" : clip(formatJson(value), max);
  return `<<<${name}\n${body}\n${name}>>>`;
}

function resultOf(log: ChuckerLog): string {
  const s = log.status;
  if (s === undefined || s === "pending") return "PENDING";
  if (s === "fail" || s === "error") return "FAIL";
  if (typeof s === "number") return s >= 400 ? "FAIL" : "OK";
  if (log.error) return "FAIL";
  return "OK";
}

function renderNetwork(log: ChuckerLog, n: number, max: number): string {
  const curl = generateCurl(log.url, log.method || "GET", log.requestHeaders || {}, log.requestData);
  return [
    `=== ENTRY ${n} ===`,
    `KIND: NETWORK`,
    `ID: ${log.id}`,
    `TIME: ${iso(log.startTime)}`,
    `METHOD: ${oneLine(log.method)}`,
    `URL: ${oneLine(log.url)}`,
    `STATUS: ${oneLine(log.status)}`,
    `RESULT: ${resultOf(log)}`,
    `DURATION_MS: ${log.duration ?? "-"}`,
    `ERROR: ${oneLine(log.error)}`,
    `<<<CURL\n${curl}\nCURL>>>`,
    block("REQUEST_HEADERS", log.requestHeaders, max),
    block("REQUEST_BODY", log.requestData, max),
    block("RESPONSE_HEADERS", log.responseHeaders, max),
    block("RESPONSE_BODY", log.responseData, max),
    `=== END ENTRY ${n} ===`,
  ].join("\n");
}

function renderNative(log: ChuckerLog, n: number, max: number): string {
  return [
    `=== ENTRY ${n} ===`,
    `KIND: NATIVE`,
    `ID: ${log.id}`,
    `TIME: ${iso(log.startTime)}`,
    `API_NAME: ${oneLine(log.url)}`,
    `CALL: invokeNativePlugin`,
    `STATUS: ${oneLine(log.status)}`,
    `RESULT: ${resultOf(log)}`,
    `DURATION_MS: ${log.duration ?? "-"}`,
    `ERROR: ${oneLine(log.error)}`,
    block("ARGS", log.requestData, max),
    block("RESPONSE", log.responseData, max),
    `=== END ENTRY ${n} ===`,
  ].join("\n");
}

function renderOther(log: ChuckerLog, n: number, max: number): string {
  return [
    `=== ENTRY ${n} ===`,
    `KIND: ${String(log.type || "custom").toUpperCase()}`,
    `ID: ${log.id}`,
    `TIME: ${iso(log.startTime)}`,
    `METHOD: ${oneLine(log.method)}`,
    `TARGET: ${oneLine(log.url)}`,
    `STATUS: ${oneLine(log.status)}`,
    `RESULT: ${resultOf(log)}`,
    `DURATION_MS: ${log.duration ?? "-"}`,
    `ERROR: ${oneLine(log.error)}`,
    block("REQUEST", log.requestData, max),
    block("RESPONSE", log.responseData, max),
    `=== END ENTRY ${n} ===`,
  ].join("\n");
}

/** Build the AI-friendly export text from a list of logs (oldest first in output). */
export function buildExportText(logs: ChuckerLog[], options: ExportOptions = {}): string {
  const max = options.maxBodyLength ?? 20000;
  const includeConsole = !!options.includeConsole;

  // Store keeps newest first → export chronologically.
  const ordered = (logs || []).slice().reverse();
  const network = ordered.filter(isNetwork);
  const native = ordered.filter(isNative);
  const other = ordered.filter(
    (l) => !isNetwork(l) && !isNative(l) && (includeConsole || l.type !== "console"),
  );

  // Global numbering follows section order so INDEX lines map 1:1 to ENTRY numbers.
  const all = [...network, ...native, ...other];
  const numberOf = new Map<string, number>();
  all.forEach((l, i) => numberOf.set(l.id, i + 1));
  const failCount = all.filter((l) => resultOf(l) === "FAIL").length;

  const out: string[] = [];
  out.push("#CHUCKER_EXPORT v1");
  out.push(`#GENERATED_AT: ${new Date().toISOString()}`);
  out.push(`#TOTAL_ENTRIES: ${all.length}`);
  out.push(`#NETWORK_COUNT: ${network.length}`);
  out.push(`#NATIVE_COUNT: ${native.length}`);
  out.push(`#OTHER_COUNT: ${other.length}`);
  out.push(`#FAIL_COUNT: ${failCount}`);
  out.push(`#ORDER: chronological (oldest first)`);
  if (options.note) out.push(`#NOTE: ${oneLine(options.note)}`);
  out.push(
    "#FORMAT: entries are delimited by '=== ENTRY n ===' / '=== END ENTRY n ==='. " +
      "Fields are 'KEY: value'. Multi-line blocks are '<<<NAME' ... 'NAME>>>'. " +
      "Bodies are pretty-printed JSON when parseable. '-' means no value.",
  );
  out.push("");

  out.push("## INDEX");
  out.push("# n | kind | result | status | duration_ms | method | url_or_api");
  all.forEach((l) => {
    const kind = isNetwork(l) ? "NETWORK" : isNative(l) ? "NATIVE" : String(l.type).toUpperCase();
    out.push(
      [
        numberOf.get(l.id),
        kind,
        resultOf(l),
        oneLine(l.status),
        l.duration ?? "-",
        oneLine(l.method),
        oneLine(l.url),
      ].join(" | "),
    );
  });
  out.push("");

  out.push(`## SECTION: NETWORK (CURL) — ${network.length} entries`);
  network.forEach((l) => out.push(renderNetwork(l, numberOf.get(l.id)!, max), ""));
  if (!network.length) out.push("(none)", "");

  out.push(`## SECTION: NATIVE API — ${native.length} entries`);
  native.forEach((l) => out.push(renderNative(l, numberOf.get(l.id)!, max), ""));
  if (!native.length) out.push("(none)", "");

  if (other.length) {
    out.push(`## SECTION: OTHER — ${other.length} entries`);
    other.forEach((l) => out.push(renderOther(l, numberOf.get(l.id)!, max), ""));
  }

  out.push("#END_OF_EXPORT");
  return out.join("\n");
}
