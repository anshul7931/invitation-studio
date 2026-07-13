/**
 * Minimal Swagger UI shell. The OpenAPI JSON itself is produced by openapi.js.
 */
function swaggerPage() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invitation Studio API</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/openapi.json",dom_id:"#swagger-ui",deepLinking:true,withCredentials:true});</script>
</body></html>`;
}

module.exports = { swaggerPage };
