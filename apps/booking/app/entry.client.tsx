import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n, { resources } from '~/i18n/i18n';

async function main() {
  await i18next.use(initReactI18next).init({
    ...i18n,
    resources,
    ns: i18n.defaultNS,
  });

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nextProvider i18n={i18next}>
          <RemixBrowser />
        </I18nextProvider>
      </StrictMode>
    );
  });
}

main();
