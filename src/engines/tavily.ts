import { normalizeResults } from "./_shared";
import { getEnv } from "../env";
import type { SearchEngine } from "../types";

// Tavily: POST https://api.tavily.com/search
// 认证 Authorization: Bearer,响应 results[].{title,url,content}
const searchTavily: SearchEngine = async ({ query, signal }) => {
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
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeResults(data.results);
};

export default searchTavily;
