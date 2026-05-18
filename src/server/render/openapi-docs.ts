/**
 * Dev-only OpenAPI documentation HTML shell. Serves a Stoplight Elements
 * viewer whose `apiDescriptionUrl` points at the auto-generated
 * `/openapi.json` endpoint.
 *
 * Assets are pinned to an exact version with SRI hashes so a compromised
 * CDN cannot inject arbitrary JS into the admin browser context.
 */
export function buildOpenApiDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>API Documentation</title>
  <script src="https://unpkg.com/@stoplight/elements@7.7.5/web-components.min.js"
    integrity="sha384-swnFFXpnRVPwGcsf7yoBzU88bcogQa2Qug931xauVSZkSmEfvGcWI1PhJGlTxhHj"
    crossorigin="anonymous"></script>
  <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements@7.7.5/styles.min.css"
    integrity="sha384-1lLf7J28IOR7k5RlItk6Y+G3hDgVB3y4RCgWNq6ZSwjYfvJXPtZAdW0uklsAZbGW"
    crossorigin="anonymous">
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
