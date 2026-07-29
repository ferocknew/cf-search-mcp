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

## 搜索引擎配置
环境变量 `SEARCH_CONFIG`(CF 文本变量),JSON 简洁式:
```json
{"tavily":1,"baidu":2,"serper":3,"jina":4,"search1api":5,"serpapi":6}
```
- 列出的引擎=启用,值为优先级(数字小的先尝试),未列=禁用
- 启用且配置了对应 API key(在 CF Secret)的引擎才真正生效

## 搜索引擎 API 格式
详见 [docs/search_readme.md](docs/search_readme.md)

## 环境变量(在 CF Worker Settings → Variables and Secrets 配置)
- `SEARCH_CONFIG`:文本变量,JSON 格式(如上)
- `TAVILY_API_KEY` 等:Secret(各引擎 API key,至少配一个)
- `TOKEN`:文本或 Secret(可选,配置后需鉴权)

## 注意事项
- 不要在本机测试付费 LLM API(避免触发监管),先 CF 部署配 key 验证
- search1api/jina 响应字段是按文档推断的,需真 key 确认
- 百科搜索、网页抓取、MCP 端点正在开发中(M2-M5)