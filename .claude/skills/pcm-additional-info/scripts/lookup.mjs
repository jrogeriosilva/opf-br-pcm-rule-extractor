#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extractorDir = resolve(scriptDir, "..", "extractor");
const configPath = resolve(extractorDir, "config.json");

const FLAG_DEFS = {
  "--field": "string",
  "--contains": "string",
  "--endpoint": "string",
  "--method": "string",
  "--page": "string",
  "--format": "string",
  "--list-fields": "bool",
  "--list-pages": "bool",
  "--help": "bool",
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!(arg in FLAG_DEFS)) {
      die(`Flag desconhecida: ${arg}`);
    }
    if (FLAG_DEFS[arg] === "bool") {
      out[arg] = true;
    } else {
      const value = argv[++i];
      if (value === undefined) die(`Flag ${arg} exige um valor`);
      out[arg] = value;
    }
  }
  return out;
}

function die(message, code = 2) {
  console.error(`[lookup] ${message}`);
  process.exit(code);
}

function printHelp() {
  console.log(`Uso: node lookup.mjs <flags>

Filtros (AND):
  --field <nome>        Match exato em campo (case-insensitive)
  --contains <substr>   Substring em campo ou definicao
  --endpoint <path>     Substring em endpoints[]
  --method <verb>       Match em metodos[] (uppercase)
  --page <substr>       Substring em page.title

Modos:
  --list-fields         Lista nomes de campos por página
  --list-pages          Lista páginas com fieldCount

Saída:
  --format compact|json (default: compact — omite null e arrays vazios)
  --help                Esta mensagem
`);
}

const args = parseArgs(process.argv.slice(2));

if (args["--help"]) {
  printHelp();
  process.exit(0);
}

if (!existsSync(configPath)) {
  die(`config.json não encontrado em ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const outputPath = resolve(extractorDir, config.outputFile);

if (!existsSync(outputPath)) {
  die(`JSON ausente em ${outputPath}. Rode: node ${resolve(scriptDir, "ensure-fresh.mjs")}`, 1);
}

const raw = JSON.parse(readFileSync(outputPath, "utf8"));
const pages = Array.isArray(raw) ? raw : (raw.pages ?? []);

const format = args["--format"] ?? "compact";
if (format !== "compact" && format !== "json") {
  die(`--format deve ser "compact" ou "json"`);
}

if (args["--list-pages"]) {
  const pageOnly = args["--page"]?.toLowerCase();
  const out = pages
    .filter((p) => !pageOnly || (p.title ?? "").toLowerCase().includes(pageOnly))
    .map((p) => ({
      pageId: p.pageId,
      title: p.title,
      url: p.url,
      fieldCount: (p.fields ?? []).length,
    }));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (args["--list-fields"]) {
  const pageOnly = args["--page"]?.toLowerCase();
  const out = {
    pages: pages
      .filter((p) => !pageOnly || (p.title ?? "").toLowerCase().includes(pageOnly))
      .map((p) => ({
        pageId: p.pageId,
        title: p.title,
        fields: (p.fields ?? [])
          .map((f) => f.campo)
          .filter((name) => typeof name === "string" && name.length > 0),
      })),
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const filterField = args["--field"]?.trim().toLowerCase();
const filterContains = args["--contains"]?.toLowerCase();
const filterEndpoint = args["--endpoint"]?.toLowerCase();
const filterMethod = args["--method"]?.toUpperCase();
const filterPage = args["--page"]?.toLowerCase();

const results = [];

for (const page of pages) {
  if (filterPage && !(page.title ?? "").toLowerCase().includes(filterPage)) continue;

  const pageMeta = { pageId: page.pageId, title: page.title, url: page.url };

  for (const field of page.fields ?? []) {
    const campo = (field.campo ?? "").toString();

    if (filterField && campo.trim().toLowerCase() !== filterField) continue;

    if (filterContains) {
      const haystack = `${campo} ${field.definicao ?? ""}`.toLowerCase();
      if (!haystack.includes(filterContains)) continue;
    }

    if (filterEndpoint) {
      const eps = Array.isArray(field.endpoints) ? field.endpoints : [];
      if (!eps.some((e) => (e ?? "").toLowerCase().includes(filterEndpoint))) continue;
    }

    if (filterMethod) {
      const methods = Array.isArray(field.metodos) ? field.metodos : [];
      if (!methods.some((m) => (m ?? "").toUpperCase() === filterMethod)) continue;
    }

    results.push({ ...field, _page: pageMeta });
  }
}

function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

const finalResults = format === "compact" ? results.map(compact) : results;

console.log(JSON.stringify({ matches: finalResults.length, results: finalResults }, null, 2));
