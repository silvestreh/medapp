export type DocsPage = {
  slug: string;
  titleKey: string;
};

export type DocsSection = {
  titleKey: string;
  pages: DocsPage[];
};

export const docsManifest: DocsSection[] = [
  {
    titleKey: 'docs.section_general',
    pages: [{ slug: 'getting-started', titleKey: 'docs.getting_started' }],
  },
  {
    titleKey: 'docs.section_features',
    pages: [
      { slug: 'encounters', titleKey: 'docs.encounters' },
      { slug: 'studies', titleKey: 'docs.studies' },
      { slug: 'patients', titleKey: 'docs.patients' },
      { slug: 'prescriptions', titleKey: 'docs.prescriptions' },
      { slug: 'accounting', titleKey: 'docs.accounting' },
      { slug: 'users', titleKey: 'docs.users' },
      { slug: 'stats', titleKey: 'docs.stats' },
    ],
  },
  {
    titleKey: 'docs.section_settings',
    pages: [
      { slug: 'settings', titleKey: 'docs.settings' },
      { slug: 'security', titleKey: 'docs.security' },
      { slug: 'signature', titleKey: 'docs.signature' },
      { slug: 'id-verification', titleKey: 'docs.id_verification' },
      { slug: 'whatsapp', titleKey: 'docs.whatsapp' },
      { slug: 'practices', titleKey: 'docs.practices' },
      { slug: 'delegations', titleKey: 'docs.delegations' },
    ],
  },
];

const allSlugs = new Set(docsManifest.flatMap(s => s.pages.map(p => p.slug)));

export function isValidDocSlug(slug: string): boolean {
  return allSlugs.has(slug);
}

export function getFirstDocSlug(): string {
  return docsManifest[0].pages[0].slug;
}
