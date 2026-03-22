import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect, useRef } from 'react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Group, TableOfContents } from '@mantine/core';

import { requireAuth } from '~/utils/auth.server';
import { resolveLocale } from '~/i18n/i18next.server';
import { isValidDocSlug } from '~/lib/docs-manifest';
import { DocsArticle } from '~/components/docs-article';
import RouteErrorFallback from '~/components/route-error-fallback';
import { styled } from '~/styled-system/jsx';

const TocContainer = styled('div', {
  base: {
    display: 'none',

    lg: {
      display: 'block',
      position: 'sticky',
      top: '6rem',
      alignSelf: 'flex-start',
      minWidth: '200px',
      maxWidth: '220px',
      paddingRight: 'var(--mantine-spacing-md)',
    },
  },
});

function readDocFile(slug: string, locale: string): string | null {
  const basePath = join(process.cwd(), 'content', 'docs');
  const localePath = join(basePath, locale, `${slug}.md`);

  if (existsSync(localePath)) {
    return readFileSync(localePath, 'utf-8');
  }

  // Fall back to Spanish
  if (locale !== 'es') {
    const fallbackPath = join(basePath, 'es', `${slug}.md`);
    if (existsSync(fallbackPath)) {
      return readFileSync(fallbackPath, 'utf-8');
    }
  }

  return null;
}

function parseInitialHeadings(content: string) {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: { depth: number; value: string; id: string }[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const depth = match[1].length;
    const value = match[2].trim();
    const id = value
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ depth, value, id });
  }

  return headings;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireAuth(request);

  const slug = params.slug!;

  if (!isValidDocSlug(slug)) {
    throw new Response('Not Found', { status: 404 });
  }

  const locale = await resolveLocale(request);
  const content = readDocFile(slug, locale);

  if (!content) {
    throw new Response('Not Found', { status: 404 });
  }

  const initialHeadings = parseInitialHeadings(content);

  return json({ content, slug, initialHeadings });
};

export default function DocsPage() {
  const { content, slug, initialHeadings } = useLoaderData<typeof loader>();
  const reinitializeRef = useRef<() => void>(() => {});

  // Re-scan headings from DOM when navigating between doc pages
  useEffect(() => {
    reinitializeRef.current();
  }, [slug]);

  return (
    <Group align="flex-start" gap="xl" wrap="nowrap">
      <DocsArticle>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
          {content}
        </ReactMarkdown>
      </DocsArticle>
      {initialHeadings.length > 0 && (
        <TocContainer>
          <TableOfContents
            initialData={initialHeadings}
            reinitializeRef={reinitializeRef}
            variant="light"
            color="blue"
            size="sm"
            minDepthToOffset={2}
          />
        </TocContainer>
      )}
    </Group>
  );
}

export const ErrorBoundary = RouteErrorFallback;
