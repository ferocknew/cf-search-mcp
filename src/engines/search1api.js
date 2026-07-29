import { normalizeResults } from "./_shared.js";
import { getEnv } from "../env.js";

// search1api: POST https://api.search1api.com/search
// 认证 Authorization: Bearer,body {query,search_service,...}
// 响应字段以 results 为主,兼容 organic/data
export default async function searchSearch1api({ query, signal }) {
  const { SEARCH1API_KEY } = getEnv();
  const res = await fetch("https://api.search1api.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SEARCH1API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_service: "google",
      max_results: 10,
      crawl_results: 0,
      image: false,
      language: "",
    }),
    signal,
  });
  if (!res.ok) {
    console.error(`[search1api] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const results = data.results || data.organic || data.data || [];
  return normalizeResults(results);
}
