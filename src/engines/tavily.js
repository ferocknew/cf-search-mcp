import { normalizeResults } from "./_shared.js";
import { getEnv } from "../env.js";

// Tavily: POST https://api.tavily.com/search
// 认证 Authorization: Bearer,响应 results[].{title,url,content}
export default async function searchTavily({ query, signal }) {
  const { TAVILY_API_KEY } = getEnv();
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ query, search_depth: "advanced" }),
    signal,
  });
  if (!res.ok) {
    console.error(`[tavily] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.results);
}
