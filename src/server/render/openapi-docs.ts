/**
 * Dev-only OpenAPI documentation HTML shell. Serves a Stoplight Elements
 * viewer whose `apiDescriptionUrl` points at the auto-generated
 * `/openapi.json` endpoint.
 */
export function buildOpenApiDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>API Documentation</title>
  <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  <style>
    body { margin: 0; }
    elements-api { display: block; height: 100vh; }
  </style>
</head>
<body>
  <elements-api
    apiDescriptionUrl="/openapi.json"
    router="hash"
    layout="sidebar"
  />
</body>
</html>`
}
