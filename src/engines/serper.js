import { normalizeResults } from "./_shared.js";
import { getEnv } from "../env.js";

// Serper: POST https://google.serper.dev/search
// 认证 X-API-KEY,body {q},响应 organic[].{title,link,snippet}
export default async function searchSerper({ query, signal }) {
  const { SERPER_API_KEY } = getEnv();
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY,
    },
    body: JSON.stringify({ q: query }),
    signal,
  });
  if (!res.ok) {
    console.error(`[serper] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.organic);
}
