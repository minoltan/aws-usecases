import openapiSpec from "./openapi.json";

// Spec URL is computed client-side from the current path (absolute, not
// relative) so this works under any API Gateway stage prefix or custom
// domain without hardcoding it server-side.
const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Recipe Finder API Docs</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        const specUrl = window.location.pathname.replace(/\\/$/, '') + '/openapi.json';
        window.ui = SwaggerUIBundle({
          url: specUrl,
          dom_id: '#swagger-ui',
        });
      };
    </script>
  </body>
</html>`;

export const handler = async (event) => {
    if (event.path.endsWith('/openapi.json')) {
        // The spec has no servers entry, so without this Swagger UI's "Try it
        // out" defaults to the page's bare origin, dropping the stage prefix
        // (e.g. /prod) that every actual route needs. Computed per-request
        // instead of hardcoded so it's correct under any stage name/domain.
        const host = event.requestContext.domainName || event.headers?.Host || event.headers?.host;
        const stage = event.requestContext.stage;
        const spec = host
            ? { ...openapiSpec, servers: [{ url: `https://${host}/${stage}` }] }
            : openapiSpec;

        return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(spec),
        };
    }

    return {
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        body: SWAGGER_UI_HTML,
    };
};
