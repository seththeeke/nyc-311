import type { WarehouseTable } from "../../models/warehouseSchema";

/*
 * A basic, schema-aware typeahead for the ad-hoc SQL textarea — plain
 * JS over the raw text, no editor library or real parser (deliberately
 * hand-rolled over something like CodeMirror). Regex/heuristic, but it
 * tracks what a flat prefix-match can't: which clause the cursor is in
 * (FROM offers tables, WHERE offers columns + conditions, ...), and
 * which tables are already referenced via FROM/JOIN (so SELECT only
 * offers their columns, and `alias.` narrows to that table alone).
 */
export const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "JOIN",
  "LEFT JOIN",
  "INNER JOIN",
  "ON",
  "AND",
  "OR",
  "NOT",
  "AS",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "IS NULL",
  "IS NOT NULL",
  "IN",
  "BETWEEN",
  "LIKE",
  "DESC",
  "ASC",
  "WITH",
] as const;

/** Extra candidates offered only while inside a SELECT clause's column list. */
const SELECT_CLAUSE_KEYWORDS = ["DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "CASE"];
/** Extra candidates offered only inside WHERE/ON/HAVING — conditions, not column/table references. */
const CONDITION_CLAUSE_KEYWORDS = ["AND", "OR", "NOT", "IS NULL", "IS NOT NULL", "IN", "BETWEEN", "LIKE"];
/** Extra candidates offered only inside GROUP BY/ORDER BY. */
const ORDERING_CLAUSE_KEYWORDS = ["ASC", "DESC"];

/** Word characters a table/column identifier or keyword fragment can be made of. */
const WORD_CHAR_PATTERN = /[\w.]/;

export interface WordRange {
  start: number;
  end: number;
  word: string;
}

/**
 * The identifier fragment immediately before `cursor` — walks backward
 * from the cursor while characters are word-like, per `WORD_CHAR_PATTERN`
 * (dots included, so `o.order_id` reads as one word). An empty `word`
 * means the cursor sits right after whitespace/punctuation.
 */
export function getCurrentWordRange(text: string, cursor: number): WordRange {
  let start = cursor;
  while (start > 0 && WORD_CHAR_PATTERN.test(text[start - 1])) start -= 1;
  return { start, end: cursor, word: text.slice(start, cursor) };
}

/**
 * The range a selected suggestion should actually replace — the same as
 * {@link getCurrentWordRange} normally, but for a qualified reference like
 * `o.ord` only the part after the last dot (`ord`), so completing it
 * inserts just the column name and keeps the `o.` prefix intact.
 */
export function getCompletionRange(text: string, cursor: number): WordRange {
  const full = getCurrentWordRange(text, cursor);
  const dotIndex = full.word.lastIndexOf(".");
  if (dotIndex === -1) return full;
  return { start: full.start + dotIndex + 1, end: full.end, word: full.word.slice(dotIndex + 1) };
}

export type SqlClause = "SELECT" | "FROM" | "JOIN" | "ON" | "WHERE" | "GROUP_BY" | "ORDER_BY" | "HAVING" | "LIMIT" | "UNKNOWN";

/* Matched longest-first only where it matters (two-word clauses); a single combined regex so "the last one before the cursor wins". */
const CLAUSE_KEYWORD_PATTERN =
  /\b(GROUP\s+BY|ORDER\s+BY|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|SELECT|FROM|WHERE|HAVING|JOIN|ON|LIMIT)\b/gi;

function normalizeClauseKeyword(matched: string): SqlClause {
  const upper = matched.toUpperCase().replace(/\s+/g, " ");
  if (upper === "SELECT") return "SELECT";
  if (upper === "FROM") return "FROM";
  if (upper === "WHERE") return "WHERE";
  if (upper === "ON") return "ON";
  if (upper === "GROUP BY") return "GROUP_BY";
  if (upper === "ORDER BY") return "ORDER_BY";
  if (upper === "HAVING") return "HAVING";
  if (upper === "LIMIT") return "LIMIT";
  if (upper.endsWith("JOIN")) return "JOIN";
  return "UNKNOWN";
}

/**
 * Which clause the cursor currently sits in, found by scanning every
 * *complete* clause keyword before `cursor` and taking the last one — the
 * keyword the cursor's own (still-being-typed) word can't itself be, since
 * `\b...\b` requires a full match. `"UNKNOWN"` before any clause keyword
 * (or for text with none at all) falls back to unfiltered suggestions.
 */
export function getClauseContext(text: string, cursor: number): SqlClause {
  const before = text.slice(0, cursor);
  let clause: SqlClause = "UNKNOWN";
  for (const match of before.matchAll(CLAUSE_KEYWORD_PATTERN)) {
    clause = normalizeClauseKeyword(match[0]);
  }
  return clause;
}

export interface TableReference {
  table: string;
  alias: string | null;
}

/* Words a captured "alias" must not actually be — the start of the next clause, not an alias. */
const NON_ALIAS_WORDS = new Set(
  ["SELECT", "FROM", "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "JOIN", "ON", "AS", "BY", "LEFT", "RIGHT", "INNER", "FULL"].map((w) =>
    w.toUpperCase()
  )
);

const TABLE_REFERENCE_PATTERN = /\b(?:FROM|JOIN)\s+([a-zA-Z_]\w*)(?:\s+(?:AS\s+)?([a-zA-Z_]\w*))?/gi;

/**
 * Every table referenced anywhere in `text` via `FROM`/`JOIN`, with its
 * alias when one is given — scanned across the *whole* query, not just
 * before the cursor, so editing the SELECT list of a query whose FROM
 * clause comes later still resolves `alias.column` correctly. A captured
 * "alias" that's actually the next clause keyword (`FROM orders WHERE`)
 * is dropped rather than treated as a real alias.
 */
export function extractTableReferences(text: string): TableReference[] {
  const refs: TableReference[] = [];
  for (const match of text.matchAll(TABLE_REFERENCE_PATTERN)) {
    const table = match[1];
    const rawAlias = match[2];
    const alias = rawAlias && !NON_ALIAS_WORDS.has(rawAlias.toUpperCase()) ? rawAlias : null;
    refs.push({ table, alias });
  }
  return refs;
}

function buildAliasMap(refs: TableReference[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const ref of refs) {
    map.set(ref.table.toLowerCase(), ref.table);
    if (ref.alias) map.set(ref.alias.toLowerCase(), ref.table);
  }
  return map;
}

/** Every unique table and column name in the schema, in schema order (tables first, then each table's own columns) — the fallback when no clause is recognized yet. */
function schemaIdentifiers(tables: WarehouseTable[]): string[] {
  const seen = new Set<string>();
  const identifiers: string[] = [];
  for (const table of tables) {
    if (!seen.has(table.table_name)) {
      seen.add(table.table_name);
      identifiers.push(table.table_name);
    }
    for (const column of table.columns) {
      if (!seen.has(column.name)) {
        seen.add(column.name);
        identifiers.push(column.name);
      }
    }
  }
  return identifiers;
}

/** Every unique column name across the given tables, in table/column order. */
function columnsOf(tables: WarehouseTable[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const table of tables) {
    for (const column of table.columns) {
      if (!seen.has(column.name)) {
        seen.add(column.name);
        names.push(column.name);
      }
    }
  }
  return names;
}

function matchesPrefix(candidate: string, word: string): boolean {
  const lowerWord = word.toLowerCase();
  const lowerCandidate = candidate.toLowerCase();
  return lowerCandidate.startsWith(lowerWord) && lowerCandidate !== lowerWord;
}

const MAX_SUGGESTIONS = 8;

/**
 * Suggestions for the word at `cursor`, scoped to what the schema
 * allows there — `alias.`/`table.` to that table's columns; FROM/JOIN
 * to table names; SELECT/WHERE/ON/HAVING/GROUP BY/ORDER BY to columns
 * from tables already referenced in the query, plus a few clause
 * keywords; anywhere else, every identifier and keyword. Capped at
 * {@link MAX_SUGGESTIONS}; `[]` when nothing's typed yet.
 */
export function getSuggestions(text: string, cursor: number, tables: WarehouseTable[]): string[] {
  const full = getCurrentWordRange(text, cursor);
  if (full.word.trim() === "") return [];

  const dotIndex = full.word.lastIndexOf(".");
  if (dotIndex !== -1) {
    const qualifier = full.word.slice(0, dotIndex).toLowerCase();
    const columnPrefix = full.word.slice(dotIndex + 1);
    const tableName = buildAliasMap(extractTableReferences(text)).get(qualifier);
    const table = tables.find((t) => t.table_name === tableName);
    if (!table) return [];
    return table.columns
      .map((c) => c.name)
      .filter((name) => matchesPrefix(name, columnPrefix))
      .slice(0, MAX_SUGGESTIONS);
  }

  const clause = getClauseContext(text, cursor);
  const referencedNames = new Set(extractTableReferences(text).map((ref) => ref.table));
  const scopedTables = referencedNames.size > 0 ? tables.filter((t) => referencedNames.has(t.table_name)) : tables;

  let candidates: string[];
  switch (clause) {
    case "FROM":
    case "JOIN":
      candidates = tables.map((t) => t.table_name);
      break;
    case "SELECT":
      candidates = [...columnsOf(scopedTables), ...SELECT_CLAUSE_KEYWORDS];
      break;
    case "WHERE":
    case "ON":
    case "HAVING":
      candidates = [...columnsOf(scopedTables), ...CONDITION_CLAUSE_KEYWORDS];
      break;
    case "GROUP_BY":
    case "ORDER_BY":
      candidates = [...columnsOf(scopedTables), ...ORDERING_CLAUSE_KEYWORDS];
      break;
    case "LIMIT":
      candidates = [];
      break;
    default:
      candidates = [...schemaIdentifiers(tables), ...SQL_KEYWORDS];
  }

  return candidates.filter((c) => matchesPrefix(c, full.word)).slice(0, MAX_SUGGESTIONS);
}

/** Replaces the word at `range` with `suggestion` plus a trailing space, and returns where the cursor lands next. */
export function applySuggestion(text: string, range: WordRange, suggestion: string): { text: string; cursor: number } {
  const insertion = `${suggestion} `;
  const nextText = text.slice(0, range.start) + insertion + text.slice(range.end);
  return { text: nextText, cursor: range.start + insertion.length };
}
