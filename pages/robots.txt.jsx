import { SITE, isPreview } from '../data/site.mjs';
export default function Robots() { return null; }
export function getServerSideProps({ res, req }) {
  const host = String(req.headers.host || '').split(':')[0];
  const productionHost = new URL(SITE.origin).hostname;
  const production = !isPreview() && [productionHost, `www.${productionHost}`].includes(host);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  // Pages remain crawlable so noindex headers can actually be read, including
  // preview hosts. Only production advertises the production sitemap.
  res.end(production ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n` : 'User-agent: *\nAllow: /\n');
  return { props: {} };
}
