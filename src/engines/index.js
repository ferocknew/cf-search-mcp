// 引擎注册表:统一签名 ({ query, signal }) => ResultItem[]
// 失败一律返回 [](不抛出),由 search.js 的降级调度决定是否尝试下一个
import searchTavily from "./tavily.js";
import searchSerpapi from "./serpapi.js";
import searchSerper from "./serper.js";
import searchSearch1api from "./search1api.js";
import searchJina from "./jina.js";
import searchBaidu from "./baidu.js";

export const ENGINES = {
  tavily: searchTavily,
  serpapi: searchSerpapi,
  serper: searchSerper,
  search1api: searchSearch1api,
  jina: searchJina,
  baidu: searchBaidu,
};
