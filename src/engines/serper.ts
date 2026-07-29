import { normalizeResults } from "./_shared";
import { getEnv } from "../env";
import type { SearchEngine } from "../types";

// Serper: POST https://google.serper.dev/search
// 认证 X-API-KEY,body {q},响应 organic[].{title,link,snippet}
const searchSerper: SearchEngine = async ({ query, signal }) => {
  const { SERPER_API_KEY } = getEnv();
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY ?? "",
    },
    body: JSON.stringify({ q: query }),
    signal,
  });
  if (!res.ok) {
    console.error(`[serper] HTTP ${res.status}`);
    return [];
  }
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeResults(data.organic);
};

export default searchSerper;
