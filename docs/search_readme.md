### jina

```bash
curl "https://s.jina.ai/?q=Jina+AI" \
  -H "Authorization: Bearer <token>" \
  -H "X-Respond-With: no-content"
  ```

### search1api
- https://www.search1api.com/zh

```bash
curl -X POST 'https://api.search1api.com/search' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{
  "query": "Latest news about OpenAI",
  "search_service": "google",
  "max_results": 5,
  "crawl_results": 0,
  "image": false,
  "include_sites": [],
  "exclude_sites": [],
  "language": ""
}'
```

### serper

```bash
curl --location 'https://google.serper.dev/search' \
--header 'X-API-KEY: <token>' \
--header 'Content-Type: application/json' \
--data '{"q":"apple inc"}'
```

### serpapi
```bash
curl --get https://serpapi.com/search \
 -d q="drop+shipping" \
 -d api_key="<token>"
```

### tavily

```bash
curl -X POST https://api.tavily.com/search \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer <token>' \
-d '{
    "query": "",
    "search_depth": "advanced"
}'
```