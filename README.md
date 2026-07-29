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
- 构建命令填 npm run build，部署命令填 npm run deploy