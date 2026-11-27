import { SITE, route, profilePath, absoluteUrl, isPreview } from '../data/site.mjs';
import { publicPaths } from '../lib/seo/catalog.mjs';
import { getPublicCatalog } from '../lib/server/publicCatalog';
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export default function Sitemap() { return null; }
export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  if (isPreview()) {
    res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    return { props: {} };
  }
  try {
    const catalog = await getPublicCatalog();
    const paths = publicPaths(catalog);
    const rows = paths.map(page => {
      const path = page.key === 'profile' ? profilePath(page.slug, page.language) : route(page.key, page.language);
      const alternates = paths.filter(other => other.key === page.key && other.slug === page.slug);
      const huPage = alternates.find(other => other.language === 'hu');
      const links = alternates.map(other => `<xhtml:link rel="alternate" hreflang="${other.language === 'hu' ? 'hu-HU' : 'en'}" href="${xml(absoluteUrl(other.key === 'profile' ? profilePath(other.slug, other.language) : route(other.key, other.language)))}"/>`).join('');
      const defaultLink = huPage ? `<xhtml:link rel="alternate" hreflang="x-default" href="${xml(absoluteUrl(huPage.key === 'profile' ? profilePath(huPage.slug, 'hu') : route(huPage.key, 'hu')))}"/>` : '';
      // No artificial "today" dates. Only a profile's actual public content timestamp.
      const lastmod = page.updatedAt ? `<lastmod>${xml(new Date(page.updatedAt).toISOString())}</lastmod>` : '';
      return `<url><loc>${xml(absoluteUrl(path))}</loc>${lastmod}${links}${defaultLink}</url>`;
    });
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${rows.join('')}</urlset>`);
  } catch (error) {
    console.error('[seo/sitemap]', error.code || 'catalog_unavailable');
    res.statusCode = 503; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Retry-After', '60'); res.end('Service unavailable');
  }
  return { props: {} };
}
