import Head from 'next/head';
import { SITE, absoluteUrl, isPreview } from '../data/site.mjs';
import { serializeJsonLd } from '../lib/seo/schema.mjs';

export default function Seo({ title, description, path = '/', language = 'hu', alternates, schema, image, noindex = false }) {
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(image || `/api/og?lang=${language}`);
  const hidden = noindex || isPreview();
  return <Head>
    <title>{title}</title>
    <meta name="description" content={description} key="description" />
    <meta name="robots" content={hidden ? 'noindex,follow,noarchive' : 'index,follow,max-image-preview:large'} key="robots" />
    <link rel="canonical" href={url} key="canonical" />
    {!noindex && alternates && Object.entries(alternates).map(([lang, href]) => <link key={`alternate-${lang}`} rel="alternate" hrefLang={lang} href={absoluteUrl(href)} />)}
    <meta property="og:type" content="website" key="og:type" />
    <meta property="og:site_name" content={SITE.name} key="og:site_name" />
    <meta property="og:title" content={title} key="og:title" />
    <meta property="og:description" content={description} key="og:description" />
    <meta property="og:url" content={url} key="og:url" />
    <meta property="og:locale" content={language === 'en' ? 'en_GB' : 'hu_HU'} key="og:locale" />
    <meta property="og:locale:alternate" content={language === 'en' ? 'hu_HU' : 'en_GB'} key="og:locale:alternate" />
    <meta property="og:image" content={ogImage} key="og:image" />
    <meta property="og:image:width" content="1200" key="og:image:width" />
    <meta property="og:image:height" content="630" key="og:image:height" />
    <meta property="og:image:alt" content={`${SITE.name} — ${title}`} key="og:image:alt" />
    <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
    <meta name="twitter:title" content={title} key="twitter:title" />
    <meta name="twitter:description" content={description} key="twitter:description" />
    <meta name="twitter:image" content={ogImage} key="twitter:image" />
    {schema && <script key="jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
  </Head>;
}
