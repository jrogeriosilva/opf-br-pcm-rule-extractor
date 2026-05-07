function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the rendered HTML body of a Confluence page via the REST API.
 * Endpoint: GET /wiki/rest/api/content/{pageId}?expand=body.view
 */
export async function fetchConfluencePage(
  pageId: string,
  baseUrl: string,
  retryDelaysMs: number[]
): Promise<{ html: string; url: string }> {
  const apiUrl = `${baseUrl}/wiki/rest/api/content/${pageId}?expand=body.view`;
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (compatible; PCM-Rule-Extractor/1.0; +pcm-rule-extractor)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Charset": "UTF-8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) {
      const delay = retryDelaysMs[attempt - 1];
      console.log(`  Retry ${attempt}/${retryDelaysMs.length} after ${delay}ms...`);
      await sleep(delay);
    }

    try {
      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText} for pageId=${pageId}`
        );
      }

      const json = (await response.json()) as {
        title: string;
        _links: { webui: string };
        body: { view: { value: string } };
      };

      const html = json.body?.view?.value ?? "";
      const webUrl = `${baseUrl}/wiki${json._links?.webui ?? ""}`;

      return { html, url: webUrl };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`  Fetch failed (attempt ${attempt + 1}): ${lastError.message}`);
    }
  }

  throw lastError ?? new Error(`Failed to fetch pageId=${pageId}`);
}

export { sleep };
