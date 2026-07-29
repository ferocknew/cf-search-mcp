import type { ResultItem } from "../types";

// 各引擎原始结果字段不一,统一为 {title, url, description}
interface RawResult {
  title?: string;
  name?: string;
  url?: string;
  link?: string;
  href?: string;
  description?: string;
  content?: string;
  snippet?: string;
  summary?: string;
}

// 搜索结果归一化
export const normalizeResults = (results: unknown): ResultItem[] =>
  (Array.isArray(results) ? (results as RawResult[]) : []).map((r) => ({
    title: r.title || r.name || "",
    url: r.url || r.link || r.href || "",
    description: r.description || r.content || r.snippet || r.summary || "",
  }));
