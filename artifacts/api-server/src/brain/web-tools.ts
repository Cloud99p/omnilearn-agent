// Web access tools for OmniLearn brain
// Used as Claude tool_use callbacks during message processing.

const USER_AGENT = "OmniLearn/1.0 (research assistant; respects robots.txt)";

// ─── Web Search (DuckDuckGo Instant Answer + HTML results) ───────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string): Promise<{ results: SearchResult[]; abstract?: string }> {
  const results: SearchResult[] = [];
  let abstract: string | undefined;

  try {
    // 1. DuckDuckGo Instant Answer API (no key needed)
    const iaUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=OmniLearn`;
    const iaRes = await fetch(iaUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (iaRes.ok) {
      const data = await iaRes.json() as {
        Abstract?: string;
        AbstractSource?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Name?: string; Topics?: unknown[] }>;
        Results?: Array<{ Text?: string; FirstURL?: string }>;
      };

      if (data.Abstract) {
        abstract = `${data.Abstract}${data.AbstractSource ? ` (Source: ${data.AbstractSource})` : ""}`;
        if (data.AbstractURL) {
          results.push({ title: data.AbstractSource ?? "Summary", url: data.AbstractURL, snippet: data.Abstract });
        }
      }

      // Related topics as additional results
      if (data.RelatedTopics) {
        for (const t of data.RelatedTopics.slice(0, 6)) {
          if (t.Text && t.FirstURL && !t.Topics) {
            results.push({ title: t.Text.split(" - ")[0] ?? t.Text.slice(0, 60), url: t.FirstURL, snippet: t.Text });
          }
        }
      }

      if (data.Results) {
        for (const r of data.Results.slice(0, 4)) {
          if (r.Text && r.FirstURL) {
            results.push({ title: r.Text.slice(0, 80), url: r.FirstURL, snippet: r.Text });
          }
        }
      }
    }
  } catch { /* network error — fall through */ }

  // 2. DuckDuckGo Lite HTML fallback if instant answer had no results
  if (results.length === 0) {
    try {
      const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      const htmlRes = await fetch(liteUrl, {
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
        signal: AbortSignal.timeout(8000),
      });

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        // Extract result snippets from DDG lite HTML
        const snippetRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
        const linkRe = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

        const links: Array<{ url: string; title: string }> = [];
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(html)) !== null && links.length < 5) {
          links.push({ url: decodeURIComponent(m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "")), title: stripHtml(m[2]).trim() });
        }

        const snippets: string[] = [];
        while ((m = snippetRe.exec(html)) !== null && snippets.length < 5) {
          snippets.push(stripHtml(m[1]).trim());
        }

        for (let i = 0; i < Math.min(links.length, snippets.length, 5); i++) {
          results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] });
        }
      }
    } catch { /* ignore */ }
  }

  return { results: results.slice(0, 6), abstract };
}

// ─── URL Fetch & Extract ─────────────────────────────────────────────────────

export async function fetchUrl(url: string): Promise<{ title: string; text: string; url: string }> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  if (contentType.includes("application/json")) {
    return { title: url, text: raw.slice(0, 4000), url };
  }

  // Extract title
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : url;

  // Remove noisy elements before extracting text
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<figure[\s\S]*?<\/figure>/gi, " ");

  const text = stripHtml(cleaned)
    .replace(/\s{3,}/g, "\n\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
    .slice(0, 6000);

  return { title, text, url };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}
