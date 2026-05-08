import * as cheerio from "cheerio";

// Column headers that hold array values (split by whitespace, comma, or newline)
const ARRAY_FIELDS = new Set([
  "metodos",
  "dominio",
  "endpoints",
  "versoes",
]);

const DIACRITICS_REGEX = /[̀-ͯ]/g;

/**
 * Normalizes a table header string into a camelCase key.
 * Examples:
 *   "Regra de preenchimento" -> "regraDePreenchimento"
 *   "HTTP Code"              -> "httpCode"
 *   "Tamanho Maximo"         -> "tamanhoMaximo"
 */
function toCamelCase(text) {
  return text
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
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
function normalizeHeader(raw) {
  const lower = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "");

  const known = {
    "campo": "campo",
    "definicao": "definicao",
    "regra de preenchimento": "regraDePreenchimento",
    "roles": "roles",
    "http code": "httpCode",
    "httpcode": "httpCode",
    "metodos": "metodos",
    "metodo": "metodos",
    "dominio": "dominio",
    "endpoints": "endpoints",
    "endpoint": "endpoints",
    "versoes": "versoes",
    "versao": "versoes",
    "tamanho maximo": "tamanhoMaximo",
    "padrao": "padrao",
    "exemplo": "exemplo",
  };

  if (known[lower]) return known[lower];

  return toCamelCase(raw);
}

/**
 * Splits a cell value into an array when the field is expected to be multi-valued.
 * Splits on newlines, commas, or consecutive whitespace-separated tokens
 * that look like identifiers (all-caps or path-like).
 */
function splitArrayValue(value, key) {
  if (!value.trim()) return [];

  const parts = value
    .split(/[\n,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (key === "endpoints") {
    const result = [];
    for (const part of parts) {
      if (part.startsWith("/")) {
        result.push(part);
      } else {
        result.push(...part.split(/\s+/).filter((t) => t.startsWith("/")));
        const nonPaths = part
          .split(/\s+/)
          .filter((t) => !t.startsWith("/") && t.length > 0);
        result.push(...nonPaths);
      }
    }
    return result.filter(Boolean);
  }

  if (key === "metodos" || key === "dominio" || key === "versoes") {
    const result = [];
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
function cellText($, el) {
  const clone = $(el).clone();
  clone.find("br").replaceWith("\n");
  return clone.text().replace(/ /g, " ").trim();
}

/**
 * Parses all qualifying tables from a Confluence page HTML fragment.
 * Returns a flat list of Field objects (one per data row across all tables).
 */
export function parseAdditionalInfoTables(html) {
  const $ = cheerio.load(html);
  const fields = [];

  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();

    if (rows.length < 2) return;

    const headerRow = rows[0];
    const rawHeaders = $(headerRow)
      .find("th, td")
      .toArray()
      .map((th) => cellText($, th));

    if (rawHeaders.length === 0 || rawHeaders.every((h) => !h)) return;

    const headers = rawHeaders.map(normalizeHeader);

    if (!headers.includes("campo")) return;

    for (let i = 1; i < rows.length; i++) {
      const cells = $(rows[i]).find("td").toArray();
      if (cells.length === 0) continue;

      const field = {
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
          field[key] = isEmpty ? [] : splitArrayValue(text, key);
        } else {
          field[key] = isEmpty ? null : text;
        }
      });

      fields.push(field);
    }
  });

  return fields;
}
