import * as pug from 'pug';
import * as path from 'path';

const compiledTemplate = pug.compileFile(path.join(__dirname, 'template.pug'));
const compiledErrorTemplate = pug.compileFile(path.join(__dirname, 'error.pug'));

export function generateMobileHtml(token: string, apiBaseUrl: string): string {
  return compiledTemplate({
    tokenJson: JSON.stringify(token),
    apiJson: JSON.stringify(apiBaseUrl),
  });
}

export function errorPage(title: string, message: string): string {
  return compiledErrorTemplate({ title, message });
}
