import { identifyPath, profilePath } from '../../data/site.mjs';
import { servicesFor, profileAvailable } from '../seo/catalog.mjs';
import { getPublicAlias, getPublicCatalog } from './publicCatalog.js';
import { SERVICE_CONTENT } from '../../data/seoContent.mjs';

export const PUBLIC_REVALIDATE = 60;
export async function homeProps(language = 'hu') {
  // Fail generation on outages: ISR keeps the last successful, accurate catalog.
  return { props: { language, catalog: await getPublicCatalog() }, revalidate: PUBLIC_REVALIDATE };
}
export async function editorialProps({ params }) {
  const path = `/${(params.publicPath || []).join('/')}`;
  const page = identifyPath(path);
  if (!page || page.key === 'home') return { notFound: true, revalidate: PUBLIC_REVALIDATE };
  const catalog = await getPublicCatalog();
  if (SERVICE_CONTENT[page.key] && !servicesFor(catalog, page.key).length) return { notFound: true, revalidate: PUBLIC_REVALIDATE };
  if (page.key === 'profile') {
    let barber = catalog.barbers.find(member => member.slug === page.slug);
    if (!barber) {
      const id = await getPublicAlias(page.slug);
      barber = catalog.barbers.find(member => member.id === id);
      if (barber && profileAvailable(barber, catalog, page.language)) return { redirect: { destination: profilePath(barber.slug, page.language), permanent: true }, revalidate: PUBLIC_REVALIDATE };
    }
    if (!barber || !profileAvailable(barber, catalog, page.language)) return { notFound: true, revalidate: PUBLIC_REVALIDATE };
  }
  return { props: { pageKey: page.key, language: page.language, slug: page.slug || null, catalog, availableLanguages: page.key === 'profile' ? ['hu','en'].filter(lang => profileAvailable(catalog.barbers.find(member => member.slug === page.slug), catalog, lang)) : ['hu','en'] }, revalidate: PUBLIC_REVALIDATE };
}
