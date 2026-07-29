import { getEnv, getEnabledEngines } from "./env";
import { ENGINES } from "./engines/index";
import type { ResultItem, SearchResponse } from "./types";

// 用 AbortController + 超时调用单个引擎
// 失败 / 超时 / 空结果一律返回 [](不抛出),由降级调度决定是否继续
async function searchSingle(
  engineName: string,
  query: string,
  timeout: number
): Promise<ResultItem[]> {
  const fn = ENGINES[engineName];
  if (!fn) {
    console.warn(`[search] unknown engine: ${engineName}`);
    return [];
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const results = await fn({ query, signal: controller.signal });
    clearTimeout(timer);
    return Array.isArray(results) ? results : [];
  } catch (e) {
    clearTimeout(timer);
    const err = e as Error;
    if (err.name === "AbortError") {
      console.error(`[${engineName}] timeout after ${timeout}ms`);
    } else {
      console.error(`[${engineName}] ${err.message}`);
    }
    return [];
  }
}

// 降级搜索:按权重顺序逐个尝试,首个有结果即返回(不并行,省请求次数)
// enginesOverride:用户显式指定的引擎列表,仅在已启用(配了 key)范围内生效
export async function searchWithFallback(
  query: string,
  enginesOverride?: string[]
): Promise<SearchResponse> {
  const env = getEnv();
  const timeout = parseInt(env.DEFAULT_TIMEOUT || "8000", 10);
  const enabled = getEnabledEngines();

  const engines =
    enginesOverride && enginesOverride.length
      ? enginesOverride
          .map((n) => n.toLowerCase())
          .filter((n) => enabled.includes(n))
      : enabled;

  const tried: string[] = [];
  for (const name of engines) {
    tried.push(name);
    const results = await searchSingle(name, query, timeout);
    if (results.length > 0) {
      return {
        query,
        number_of_results: results.length,
        engine_used: name,
        tried_engines: tried,
        engines_available: engines,
        results: results.map((r) => ({ ...r, engine: name })),
      };
    }
    // 无结果或失败 → 降级到下一个引擎
  }

  // 全部引擎均无结果
  return {
    query,
    number_of_results: 0,
    engine_used: null,
    tried_engines: tried,
    engines_available: engines,
    results: [],
  };
}
