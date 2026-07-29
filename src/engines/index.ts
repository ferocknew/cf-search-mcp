import type { SearchEngine } from "../types";
import searchTavily from "./tavily";
import searchSerpapi from "./serpapi";
import searchSerper from "./serper";
import searchSearch1api from "./search1api";
import searchJina from "./jina";
import searchBaidu from "./baidu";

// 引擎注册表:统一签名 ({ query, signal }) => ResultItem[]
// 失败一律返回 [](不抛出),由 search.ts 的降级调度决定是否尝试下一个
export const ENGINES: Record<string, SearchEngine> = {
  tavily: searchTavily,
  serpapi: searchSerpapi,
  serper: searchSerper,
  search1api: searchSearch1api,
  jina: searchJina,
  baidu: searchBaidu,
};
