export function generateMobileHtml(
  token: string,
  apiBaseUrl: string,
  appScript: string
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Verificación de Identidad</title>
  <link rel="stylesheet" href="/public/styles.css">
</head>
<body class="font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] bg-gray-50 text-gray-900 min-h-dvh flex flex-col"
      style="padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);">
  <div id="app" class="flex-1 flex flex-col"></div>
  <script>
    window.__TOKEN = ${JSON.stringify(token)};
    window.__API = ${JSON.stringify(apiBaseUrl)};
  <\/script>
  <script>${appScript}<\/script>
</body>
</html>`;
}

export function errorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:sans-serif;text-align:center;padding:40px;}</style></head>
<body><h2>${title}</h2><p>${message}</p></body></html>`;
}
