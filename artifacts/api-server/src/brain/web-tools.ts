// Web access tools for OmniLearn brain
// Search:  DuckDuckGo Lite HTML — single-quote class names, uddg-encoded redirect URLs
// Fetch:   Jina AI Reader (r.jina.ai) — strips HTML/JS, returns clean markdown text
//
// DDG Lite actual HTML structure (verified 2026-05):
//   <a rel="nofollow" href="//duckduckgo.com/l/?uddg=URL&amp;rut=..." class='result-link'>Title</a>
//   <td class='result-snippet'>Snippet text</td>
// Note: href comes BEFORE class — regex must be attribute-order-independent.

import { logger } from "../lib/logger.js";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";

// ─── Web Search ───────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(
  query: string,
): Promise<{ results: SearchResult[]; abstract?: string }> {
  // ── DuckDuckGo Lite HTML ──────────────────────────────────────────────────
  // DDG Lite uses single-quoted class attributes:
  //   <a class='result-link' href="//duckduckgo.com/l/?uddg=ENCODED_URL">Title</a>
  //   <td class='result-snippet'>Snippet text</td>
  try {
    const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const res = await fetch(liteUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const html = await res.text();

      // Two-pass extraction — attribute order in DDG Lite is href THEN class,
      // so we cannot use a single regex that requires class before href.
      //
      // Pass 1: find all <a ...>...</a> blocks, keep those with class='result-link'
      const anchorRe = /<a([^>]+)>([\s\S]*?)<\/a>/gi;
      // Pass 2: extract snippet text from <td class='result-snippet'>...</td>
      const snippetRe =
        /<td[^>]*class='result-snippet'[^>]*>([\s\S]*?)<\/td>/gi;

      const links: Array<{ url: string; title: string }> = [];
      const snippets: string[] = [];

      let m: RegExpExecArray | null;

      while ((m = anchorRe.exec(html)) !== null && links.length < 8) {
        const attrs = m[1];
        const content = m[2];
        if (!attrs.includes("result-link")) continue;
        // href may contain HTML entities — decode &amp; before URL parsing
        const hrefMatch = /href="([^"]+)"/.exec(attrs);
        if (!hrefMatch) continue;
        const rawHref = hrefMatch[1].replace(/&amp;/g, "&");
        const url = extractDdgUrl(rawHref);
        const title = stripHtml(content).trim();
        if (url && title) links.push({ url, title });
      }

      while ((m = snippetRe.exec(html)) !== null && snippets.length < 8) {
        const text = stripHtml(m[1]).trim();
        if (text) snippets.push(text);
      }

      logger.info(
        { linksFound: links.length, snippetsFound: snippets.length, query },
        "DDG Lite parse result",
      );

      const results: SearchResult[] = [];
      for (let i = 0; i < Math.min(links.length, snippets.length, 6); i++) {
        results.push({
          title: links[i].title,
          url: links[i].url,
          snippet: snippets[i],
        });
      }

      if (results.length > 0) return { results };
    }
  } catch {
    /* fall through */
  }

  // ── DuckDuckGo Instant Answer API (good for factual/definition queries) ──
  try {
    const iaUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const iaRes = await fetch(iaUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (iaRes.ok) {
      const data = (await iaRes.json()) as {
        Abstract?: string;
        AbstractSource?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{
          Text?: string;
          FirstURL?: string;
          Topics?: unknown[];
        }>;
        Results?: Array<{ Text?: string; FirstURL?: string }>;
      };

      const results: SearchResult[] = [];
      let abstract: string | undefined;

      if (data.Abstract) {
        abstract = `${data.Abstract}${data.AbstractSource ? ` (Source: ${data.AbstractSource})` : ""}`;
        if (data.AbstractURL) {
          results.push({
            title: data.AbstractSource ?? "Summary",
            url: data.AbstractURL,
            snippet: data.Abstract,
          });
        }
      }
      if (data.RelatedTopics) {
        for (const t of data.RelatedTopics.slice(0, 6)) {
          if (t.Text && t.FirstURL && !t.Topics) {
            results.push({
              title: t.Text.split(" - ")[0] ?? t.Text.slice(0, 60),
              url: t.FirstURL,
              snippet: t.Text,
            });
          }
        }
      }
      if (data.Results) {
        for (const r of data.Results.slice(0, 4)) {
          if (r.Text && r.FirstURL) {
            results.push({
              title: r.Text.slice(0, 80),
              url: r.FirstURL,
              snippet: r.Text,
            });
          }
        }
      }
      if (results.length > 0) return { results, abstract };
    }
  } catch {
    /* ignore */
  }

  return { results: [] };
}

/** Extract the real URL from a DDG redirect link like //duckduckgo.com/l/?uddg=ENCODED&rut=... */
function extractDdgUrl(rawHref: string): string {
  try {
    // Normalise protocol-relative URLs
    const href = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref;
    const parsed = new URL(href);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return href;
  } catch {
    return rawHref;
  }
}

// ─── URL Fetch & Extract ─────────────────────────────────────────────────────

export async function fetchUrl(
  url: string,
): Promise<{ title: string; text: string; url: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);

  // ── Primary: Jina AI Reader — returns clean markdown, no API key needed ──
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/plain,text/markdown,*/*;q=0.8",
        "X-Return-Format": "markdown",
        "X-Timeout": "10",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (res.ok) {
      const raw = await res.text();
      // Jina returns: "Title: ...\n\nURL Source: ...\n\nMarkdown Content:\n..."
      const titleMatch = /^Title:\s*(.+)$/m.exec(raw);
      const contentMatch = /Markdown Content:\s*\n([\s\S]+)/.exec(raw);
      const title = titleMatch ? titleMatch[1].trim() : url;
      const text = contentMatch
        ? contentMatch[1].trim().slice(0, 6000)
        : raw.slice(0, 6000);
      if (text.length > 100) return { title, text, url };
    }
  } catch {
    /* fall through */
  }

  // ── Fallback: Direct HTML fetch ───────────────────────────────────────────
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  if (contentType.includes("application/json"))
    return { title: url, text: raw.slice(0, 4000), url };

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : url;

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
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}
