// 核心类型定义

// Worker 运行时环境变量(CF Dashboard → Variables and Secrets 配置)
export interface Env {
  // 主搜索配置:CF Text 变量为 string,JSON 变量会被注入为已解析对象,故两种都兼容
  SEARCH_CONFIG?: string | Record<string, number>;
  // 单引擎超时(毫秒),默认 8000
  DEFAULT_TIMEOUT?: string;
  // 访问令牌(可选),配置后需鉴权
  TOKEN?: string;
  // 各引擎 API key(Secret)
  TAVILY_API_KEY?: string;
  SERPAPI_API_KEY?: string;
  SERPER_API_KEY?: string;
  SEARCH1API_KEY?: string;
  JINA_API_KEY?: string;
  BAIDU_API_KEY?: string;
}

// 归一化后的单条搜索结果
export interface ResultItem {
  title: string;
  url: string;
  description: string;
  // 由 searchWithFallback 标注命中的引擎(归一化时不填)
  engine?: string;
}

// /search 接口响应结构
export interface SearchResponse {
  query: string;
  number_of_results: number;
  engine_used: string | null;
  tried_engines: string[];
  engines_available: string[];
  results: ResultItem[];
}

// 统一的搜索引擎函数签名
export type SearchEngine = (options: {
  query: string;
  signal: AbortSignal;
}) => Promise<ResultItem[]>;

// ==================== 百科搜索(M2,wikipedia/wikisource)====================
// 百科搜索为独立工具,不参与主搜索降级链;两者均走 MediaWiki API
export type WikiSource = "wikipedia" | "wikisource";
export type WikiSearchType = "text" | "title";

// 百科搜索请求参数
export interface WikiSearchParams {
  query: string;
  source: WikiSource; // wikipedia 多语言;wikisource 固定 zh
  language?: string; // 仅 wikipedia 用,默认 zh
  limit?: number; // 1-50,默认 20
  search_type?: WikiSearchType; // text 全文 / title 标题,默认 text
}

// 百科搜索单条结果(MediaWiki search 项归一化)
export interface WikiResultItem {
  title: string;
  url: string;
  snippet: string;
  size: number;
  word_count: number;
  timestamp: string;
}

// 百科搜索响应
export interface WikiSearchResponse {
  query: string;
  source: WikiSource;
  language: string;
  total_hits: number;
  number_of_results: number;
  results: WikiResultItem[];
}
