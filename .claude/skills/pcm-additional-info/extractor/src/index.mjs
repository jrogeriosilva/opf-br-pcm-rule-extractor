import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchConfluencePage, sleep } from "./fetcher.mjs";
import { parseAdditionalInfoTables } from "./parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.resolve(__dirname, "../config.json");

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const baseUrl = config.confluenceBaseUrl.replace(/\/$/, "");
  const outputFile = path.resolve(__dirname, "..", config.outputFile);

  console.log(`PCM Additional Info Scraper — ${config.version}`);
  console.log(`Target: ${config.pages.length} pages\n`);

  const output = {
    extractedAt: new Date().toISOString(),
    version: config.version,
    pages: [],
  };

  for (let i = 0; i < config.pages.length; i++) {
    const page = config.pages[i];
    console.log(
      `[${i + 1}/${config.pages.length}] Fetching: ${page.title} (pageId=${page.pageId})`
    );

    try {
      const { html, url } = await fetchConfluencePage(
        page.pageId,
        baseUrl,
        config.retryDelaysMs
      );
      const fields = parseAdditionalInfoTables(html);

      output.pages.push({ pageId: page.pageId, title: page.title, url, fields });
      console.log(`  ✓ Extracted ${fields.length} fields`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Error: ${message}`);

      output.pages.push({
        pageId: page.pageId,
        title: page.title,
        url: `${baseUrl}/wiki/pages/${page.pageId}`,
        fields: [],
      });
    }

    if (i < config.pages.length - 1) {
      console.log(`  Waiting ${config.interRequestDelayMs}ms before next request...`);
      await sleep(config.interRequestDelayMs);
    }
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf8");

  const totalFields = output.pages.reduce((acc, p) => acc + p.fields.length, 0);
  console.log(`\nDone. ${totalFields} total fields extracted.`);
  console.log(`Output: ${outputFile}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
