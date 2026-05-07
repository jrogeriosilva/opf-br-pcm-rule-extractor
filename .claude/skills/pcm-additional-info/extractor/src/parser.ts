import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Field } from "./types.js";

// Column headers that hold array values (split by whitespace, comma, or newline)
const ARRAY_FIELDS = new Set([
  "metodos",
  "dominio",
  "endpoints",
  "versoes",
]);

/**
 * Normalizes a table header string into a camelCase key.
 * Examples:
 *   "Regra de preenchimento" → "regraDePreenchimento"
 *   "HTTP Code"             → "httpCode"
 *   "Tamanho Máximo"        → "tamanhoMaximo"
 */
function toCamelCase(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-zA-Z0-9\s]/g, "")  // remove punctuation
    .trim()
    .split(/\s+/)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}

/**
 * Returns a well-known camelCase key for common Portuguese column names,
 * falling back to generic camelCase conversion.
 */
function normalizeHeader(raw: string): string {
  const lower = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const known: Record<string, string> = {
    "campo":                    "campo",
    "definicao":                "definicao",
    "definição":                "definicao",
    "regra de preenchimento":   "regraDePreenchimento",
    "roles":                    "roles",
    "http code":                "httpCode",
    "httpcode":                 "httpCode",
    "metodos":                  "metodos",
    "metodo":                   "metodos",
    "método":                   "metodos",
    "métodos":                  "metodos",
    "dominio":                  "dominio",
    "domínio":                  "dominio",
    "endpoints":                "endpoints",
    "endpoint":                 "endpoints",
    "versoes":                  "versoes",
    "versao":                   "versoes",
    "versão":                   "versoes",
    "versões":                  "versoes",
    "tamanho maximo":           "tamanhoMaximo",
    "tamanho máximo":           "tamanhoMaximo",
    "padrao":                   "padrao",
    "padrão":                   "padrao",
    "exemplo":                  "exemplo",
  };

  if (known[lower]) return known[lower];

  // Try without accents after stripping
  const stripped = lower.replace(/[\u0300-\u036f]/g, "");
  if (known[stripped]) return known[stripped];

  return toCamelCase(raw);
}

/**
 * Splits a cell value into an array when the field is expected to be multi-valued.
 * Splits on newlines, commas, or consecutive whitespace-separated tokens
 * that look like identifiers (all-caps or path-like).
 */
function splitArrayValue(value: string, key: string): string[] {
  if (!value.trim()) return [];

  // Split on newlines first, then on comma, then trim
  const parts = value
    .split(/[\n,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // For endpoints: they usually start with /
  if (key === "endpoints") {
    // Re-split by whitespace if items don't start with /
    const result: string[] = [];
    for (const part of parts) {
      if (part.startsWith("/")) {
        result.push(part);
      } else {
        // might be space-separated paths merged into one token
        result.push(...part.split(/\s+/).filter((t) => t.startsWith("/")));
        const nonPaths = part.split(/\s+/).filter((t) => !t.startsWith("/") && t.length > 0);
        result.push(...nonPaths);
      }
    }
    return result.filter(Boolean);
  }

  // For metodos/dominio/versoes: each word is usually a separate token
  if (key === "metodos" || key === "dominio" || key === "versoes") {
    const result: string[] = [];
    for (const part of parts) {
      result.push(...part.split(/\s+/).filter(Boolean));
    }
    return result;
  }

  return parts;
}

/**
 * Extracts the inner text from a cheerio element, collapsing whitespace.
 */
function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  // Replace <br> with newline before getting text
  const clone = $(el).clone();
  clone.find("br").replaceWith("\n");
  return clone.text().replace(/\u00a0/g, " ").trim();
}

/**
 * Parses all qualifying tables from a Confluence page HTML fragment.
 * Returns a flat list of Field objects (one per data row across all tables).
 */
export function parseAdditionalInfoTables(html: string): Field[] {
  const $ = cheerio.load(html);
  const fields: Field[] = [];

  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();

    // Skip tables with fewer than 2 rows (header + at least 1 data row)
    if (rows.length < 2) return;

    // Extract headers from the first row (th or td)
    const headerRow = rows[0];
    const rawHeaders = $(headerRow)
      .find("th, td")
      .toArray()
      .map((th) => cellText($, th));

    // Skip if no headers found or if it looks like a layout/empty table
    if (rawHeaders.length === 0 || rawHeaders.every((h) => !h)) return;

    const headers = rawHeaders.map(normalizeHeader);

    // Must have at least a "campo" column to be a valid rules table
    if (!headers.includes("campo")) return;

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
      const cells = $(rows[i]).find("td").toArray();
      if (cells.length === 0) continue;

      const field: Partial<Field> = {
        campo: null,
        definicao: null,
        regraDePreenchimento: null,
        roles: null,
        httpCode: null,
        metodos: [],
        dominio: [],
        endpoints: [],
        versoes: [],
        tamanhoMaximo: null,
        padrao: null,
        exemplo: null,
      };

      cells.forEach((cell, colIdx) => {
        const key = headers[colIdx];
        if (!key) return;

        const text = cellText($, cell);
        const isEmpty = text === "" || text === "-" || text === "—";

        if (ARRAY_FIELDS.has(key)) {
          (field as Record<string, string[]>)[key] = isEmpty
            ? []
            : splitArrayValue(text, key);
        } else {
          (field as Record<string, string | null>)[key] = isEmpty ? null : text;
        }
      });

      fields.push(field as Field);
    }
  });

  return fields;
}
