import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['sup', 'sub', 'i', 'b'];
const PURIFY_CONFIG = { ALLOWED_TAGS, ALLOWED_ATTR: [] as string[] };

const ALLOWED_TAG_RE = /^(sup|sub|i|b)$/i;

function ssrSanitize(dirty: string): string {
  return dirty.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag: string) => {
    if (!ALLOWED_TAG_RE.test(tag)) return '';
    const isClosing = match.startsWith('</');
    return isClosing ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
  });
}

export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    return ssrSanitize(dirty);
  }
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG);
}

interface SafeHtmlProps extends React.HTMLAttributes<HTMLSpanElement> {
  html: string;
}

export function SafeHtml({ html, ...rest }: SafeHtmlProps) {
  return <span {...rest} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
