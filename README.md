# cf-search-mcp
- 参考 https://github.com/Yrobot/cloudflare-search
- 提供 web 界面，如果设置 token 了，则弹出提示框，输入以后才可以使用web 界面
- 需要在后台配置 TOKEN （文本）变量，默认配置，用户也可以选择不配置
- 支持这几个站
    - tavily（一个月 1000 次）
    - serpapi（一个月 250 次）
    - serper（总共2500次）
    - search1api（一个月100次）
    - jina （赠送 token 额度）
    - baidu （一个月1500次） 参考：https://github.com/ferocknew/claude_code_public_skills/blob/main/baidu_search_nodejs/skill.js
- 以上搜索 api ，可以用户自行配置开放那些，用户可以自行配置搜索接口的权重，逐个降级搜索，不支持并行搜索（费请求次数，没意义）
- 支持其他搜索
  - wikipedia （维基百科）
  - wikisource （维基文库）
  - https://pedia.cloud.edu.tw/ （教育百科）

- 支持 fetch web
  - fetch txt （基于 阅读模式 获取主要内容）
  - fetch markdown（基于 阅读模式 获取带格式的主要内容）
  - fetch html_body
  - fetch html_raw

## tools list
- search（搜索）
- wiki_search
- wikisource_search
- pedia_search
- web_fetch

## 技术说明
- 语言:TypeScript(strict + @cloudflare/workers-types)
- 构建:`npm run build`(先 `tsc --noEmit` 类型检查,再 esbuild 打包到 dist/worker.js)
- 部署:`npm run deploy`;推荐 CF Workers Builds Git 自动部署(push 触发,免 wrangler login)

## 项目架构
- Worker 直接提供 MCP HTTP 端点(Streamable HTTP),非独立 npm 包
- 多引擎降级搜索:按权重顺序逐个尝试(非并行,省请求次数),首个有结果即返回
- 自集成 @mozilla/readability + turndown(网页抓取阅读模式)
- 百科搜索(wikipedia/wikisource/教育百科)为独立工具
- TOKEN 鉴权(可选),JSON 配置搜索引擎开关与优先级

## 配置(在 CF 后台设置,须在首次部署前配好)

CF Dashboard → Workers & Pages → `cf-search-mcp` → **Settings → Variables and Secrets**,逐个添加,改完即时生效。

> 必须在 wrangler.toml 保留 `keep_vars = true`,否则部署会清除后台文本变量。

> ⚠️ **部署顺序(反复测试得出,非常重要)**:Worker 一旦正式部署成功,后台再编辑变量/密钥会报 403(`POST /workers/scripts/{name}/versions (403)`),无法保存。正确做法:
> 1. 删除该 Worker,重新新建;
> 2. **先**在 Settings -> Variables and Secrets 配好所有变量(TOKEN/SEARCH_CONFIG/各引擎 key);
> 3. **再**链接 GitHub 触发部署。
>
> 顺序不能反:先部署后配变量会 403,只能删了重建。

### 变量总览

| 变量名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `SEARCH_CONFIG` | Text/JSON | 是 | 启用的引擎与优先级,JSON 简洁式 |
| `TAVILY_API_KEY` | Secret | 按需 | Tavily key(月 1000 次) |
| `SERPAPI_API_KEY` | Secret | 按需 | SerpAPI key(月 250 次) |
| `SERPER_API_KEY` | Secret | 按需 | Serper key(共 2500 次) |
| `SEARCH1API_KEY` | Secret | 按需 | search1api key(月 100 次) |
| `JINA_API_KEY` | Secret | 按需 | Jina key(赠送额度) |
| `BAIDU_API_KEY` | Secret | 按需 | 百度千帆 AI 搜索 key(月 1500 次) |
| `TOKEN` | Text/Secret | 否 | 访问令牌;配置后需鉴权,留空则开放 |
| `DEFAULT_TIMEOUT` | Text | 否 | 单引擎超时(毫秒),默认 `8000` |

> 引擎 key 至少配一个,且需与 `SEARCH_CONFIG` 列出的引擎对应;没配 key 的引擎会被跳过。

### SEARCH_CONFIG 格式

JSON 简洁式,键为引擎名,值为优先级(数字小的先尝试,未列出=禁用):

```json
{"tavily":1,"baidu":2,"serper":3,"jina":4,"search1api":5,"serpapi":6}
```

只有同时配置了对应 API key 的引擎才会真正参与降级搜索。

CF 后台变量类型选 **Text**(填 JSON 字符串)或 **JSON**(填对象)均可,代码两种都兼容。`wrangler.toml [vars]` 仅支持字符串,写配置文件时须用 Text 形式。

### 配置后验证

- 访问 `https://cf-search-mcp.ferock.workers.dev/` 看 Web 界面(降级搜索+Token 弹框)
- 搜索验证:`/search?q=test`;若配了 `TOKEN`,加 `&token=你的token`
- 鉴权:不带 token 应返回 401


### 日志(Workers Logs)

`wrangler.toml` 已启用 `[observability]` 与 `keep_vars = true`:
- `keep_vars` 保留后台变量,避免部署清除
- `[observability]` 让 `console.error` 进 Workers Logs

部署后 CF Dashboard → `cf-search-mcp` → **Logs/Observability** 查看(如 `[baidu] HTTP 401` 可排查引擎 key 是否有效)。

> 免费套餐限制:每天 200K events,超出后事件将被采样。

## 开发规范
- TypeScript strict 模式;纯类型导入用 `import type`(verbatimModuleSyntax)
- 改代码后务必 `npm run typecheck`(tsc --noEmit);esbuild 只转译不查类型
- wrangler.toml 必须保留 `keep_vars = true`
- 引擎 key 用 Secret;SEARCH_CONFIG/TOKEN/DEFAULT_TIMEOUT 为文本变量
- 不在本机测试付费搜索 API,用假 key 验证降级结构,真 key 靠线上验证

## 搜索引擎 API 格式
详见 [docs/search_readme.md](docs/search_readme.md)

## 注意事项
- 不要在本机测试付费 LLM API,先 CF 部署配 key 验证
- search1api/jina 响应字段按文档推断,需真 key 确认(baidu 已实测通过)
- 百科搜索、网页抓取正在开发中(M2-M3)
