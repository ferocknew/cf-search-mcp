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

## 技术说明
- 构建命令:`npm run build`(esbuild 打包到 dist/worker.js)
- 部署命令:`npm run deploy`(wrangler deploy)
- 推荐部署方式:CF Workers Builds Git 自动部署
  - 连接 GitHub 仓库 ferocknew/cf-search-mcp
  - 构建命令填 `npm run build`,部署命令填 `npm run deploy`
  - 不需要 wrangler login(Workers Builds 自动处理认证)

## 项目架构
- Worker 直接提供 MCP HTTP 端点(Streamable HTTP),非独立 npm 包
- 多引擎降级搜索:按权重顺序逐个尝试(非并行,省请求次数),首个有结果即返回
- 自集成 @mozilla/readability + turndown(网页抓取阅读模式)
- 百科搜索(wikipedia/wikisource/教育百科)为独立工具
- TOKEN 鉴权(可选),JSON 配置搜索引擎开关与优先级

## 配置(部署后在 CF 后台设置)

Worker 部署后,进入 Cloudflare Dashboard → Workers & Pages → `cf-search-mcp` → **Settings → Variables and Secrets**,逐个添加以下变量。改完即时生效,无需重新部署。

### 变量总览

| 变量名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `SEARCH_CONFIG` | Text/JSON | 是 | 启用的引擎与优先级,JSON 简洁式,见下方格式 |
| `TAVILY_API_KEY` | Secret | 按需 | Tavily key(月 1000 次) |
| `SERPAPI_API_KEY` | Secret | 按需 | SerpAPI key(月 250 次) |
| `SERPER_API_KEY` | Secret | 按需 | Serper key(共 2500 次) |
| `SEARCH1API_KEY` | Secret | 按需 | search1api key(月 100 次) |
| `JINA_API_KEY` | Secret | 按需 | Jina key(赠送额度) |
| `BAIDU_API_KEY` | Secret | 按需 | 百度千帆 AI 搜索 key(月 1500 次) |
| `TOKEN` | Text/Secret | 否 | 访问令牌;配置后 Web/API/MCP 需鉴权,留空则开放访问 |
| `DEFAULT_TIMEOUT` | Text | 否 | 单引擎超时(毫秒),默认 `8000` |

> 引擎 key 至少配置一个,且需与 `SEARCH_CONFIG` 列出的引擎对应;只列出但没配 key 的引擎会被自动跳过。

### SEARCH_CONFIG 格式

JSON 简洁式,键为引擎名,值为优先级(数字小的先尝试,未列出=禁用):

```json
{"tavily":1,"baidu":2,"serper":3,"jina":4,"search1api":5,"serpapi":6}
```

只有同时配置了对应 API key 的引擎才会真正参与降级搜索。

CF 后台变量类型选 **Text**(值填上面的 JSON 字符串)或 **JSON**(直接填对象,无需手动转义)均可,代码两种都兼容;`wrangler.toml` 的 `[vars]` 仅支持字符串,故写配置文件时须用 Text 形式。

### 配置方式

- **CF 后台**:在 Variables and Secrets 页面逐个 Add;Secret 类型勾选 Encrypt 加密存储
- **命令行(仅 Secret)**:`wrangler secret put TAVILY_API_KEY` 等逐个配置;文本变量(`SEARCH_CONFIG`/`TOKEN`/`DEFAULT_TIMEOUT`)建议直接在后台填,或写进 `wrangler.toml` 的 `[vars]`

### 配置后验证

- 访问 `https://cf-search-mcp.ferock.workers.dev/` 应看到 Worker 占位页(正式 Web 界面待 M4)
- 访问 `https://cf-search-mcp.ferock.workers.dev/search?q=test` 验证搜索;若配了 `TOKEN`,改为 `?token=你的token&q=test`

## 搜索引擎 API 格式
详见 [docs/search_readme.md](docs/search_readme.md)

## 注意事项
- 不要在本机测试付费 LLM API(避免触发监管),先 CF 部署配 key 验证
- search1api/jina 响应字段是按文档推断的,需真 key 确认
- 百科搜索、网页抓取、MCP 端点正在开发中(M2-M5)