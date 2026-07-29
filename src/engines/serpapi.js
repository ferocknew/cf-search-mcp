import { normalizeResults } from "./_shared.js";
import { getEnv } from "../env.js";

// SerpApi: GET https://serpapi.com/search?q=&api_key=
// 响应 organic_results[].{title,link,snippet}
export default async function searchSerpapi({ query, signal }) {
  const { SERPAPI_API_KEY } = getEnv();
  const url = `https://serpapi.com/search?q=${encodeURIComponent(
    query
  )}&api_key=${encodeURIComponent(SERPAPI_API_KEY)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    console.error(`[serpapi] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.organic_results);
}
