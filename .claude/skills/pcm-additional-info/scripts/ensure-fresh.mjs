#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extractorDir = resolve(scriptDir, "..", "extractor");
const configPath = resolve(extractorDir, "config.json");
const nodeModulesDir = resolve(extractorDir, "node_modules");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");

function fail(message, code = 1) {
  console.error(`[ensure-fresh] ${message}`);
  process.exit(code);
}

if (!existsSync(configPath)) {
  fail(`config.json não encontrado em ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const outputPath = resolve(extractorDir, config.outputFile);

if (!existsSync(nodeModulesDir)) {
  console.log("[ensure-fresh] Instalando dependências da skill (primeira execução)...");
  const install = spawnSync("npm", ["install", "--silent", "--no-progress"], {
    cwd: extractorDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (install.status !== 0) {
    fail(`npm install falhou (exit ${install.status})`, install.status ?? 1);
  }
}

let needsExtract = force;
let ageHours = null;

if (!existsSync(outputPath)) {
  needsExtract = true;
} else {
  const ageMs = Date.now() - statSync(outputPath).mtimeMs;
  ageHours = Math.round((ageMs / 3600000) * 10) / 10;
  if (ageMs > STALE_AFTER_MS) needsExtract = true;
}

if (!needsExtract) {
  console.log(JSON.stringify({ status: "fresh", ageHours, outputPath }));
  process.exit(0);
}

console.log(`[ensure-fresh] ${force ? "Forçando" : existsSync(outputPath) ? "JSON desatualizado, re-extraindo" : "JSON ausente, extraindo"}...`);
const run = spawnSync("npm", ["run", "start"], {
  cwd: extractorDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (run.status !== 0) {
  fail(`Extração falhou (exit ${run.status})`, run.status ?? 1);
}

console.log(JSON.stringify({ status: "refreshed", outputPath }));
