import {secureHandler} from '../../lib/server/security';
/* eslint-disable @next/next/no-img-element -- ImageResponse renders a bitmap, not an HTML page. */
import DemetersLogo from '../../components/DemetersLogo';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {downloadPortrait,validateImage} from '../../lib/server/ogImage';
import { pageMetadata, SERVICE_CONTENT } from '../../data/seoContent.mjs';
import { getPublicCatalog } from '../../lib/server/publicCatalog';
import { profileAvailable } from '../../lib/seo/catalog.mjs';

async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  const language = req.query.lang === 'en' ? 'en' : 'hu';
  const key = ['home', 'prices', 'team', 'contact', 'profile', ...Object.keys(SERVICE_CONTENT)].includes(req.query.page) ? req.query.page : 'home';
  let barber = null, portrait = null;
  try {
    if (key === 'profile') {
      const catalog = await getPublicCatalog();
      barber = catalog.barbers.find(member => member.slug === req.query.barber);
      if (!barber || !profileAvailable(barber, catalog, language)) return res.status(404).end();
      // Only local assets or this project’s public Storage can be fetched.
      // A missing portrait falls back to the branded name-based preview.
      try {
      if (/^\/images\/[a-z0-9_-]+\.(webp|png|jpe?g)$/i.test(barber.image || '')) {
        const bytes = await validateImage(await readFile(path.join(process.cwd(), 'public', barber.image)));
        const mime = barber.image.endsWith('.webp') ? 'image/webp' : barber.image.endsWith('.png') ? 'image/png' : 'image/jpeg';
        portrait = `data:${mime};base64,${bytes.toString('base64')}`;
      } else if (barber.image && process.env.SUPABASE_URL) {
        portrait = await downloadPortrait(barber.image);
      }
      } catch { portrait = null; }
    }
    const meta = pageMetadata(key, language, barber);
    const png = new ImageResponse(<div style={{ width: '100%', height: '100%', background: '#151515', color: '#f5f4f0', display: 'flex', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px', width: portrait ? '70%' : '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 16, letterSpacing: 3 }}><DemetersLogo width={350} height={45} /><span>DEBRECEN</span></div>
        <div style={{ display: 'flex', fontSize: barber ? 70 : 76, lineHeight: 1.05, letterSpacing: -3, maxWidth: 1020 }}>{barber?.name || meta.h1}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #60605e', paddingTop: 24, fontSize: 20 }}><span>demeters.hu</span><span>{language === 'en' ? 'BOOK YOUR BARBER' : 'IDŐPONTFOGLALÁS'}</span></div>
      </div>
      {portrait && <img alt="" src={portrait} width="360" height="630" style={{ objectFit: 'cover' }} />}
    </div>, { width: 1200, height: 630 });
    const body = Buffer.from(await png.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(body);
  } catch (error) {
    console.error('[seo/og]', error.code || 'render_failed');
    res.setHeader('Cache-Control', 'no-store'); return res.status(503).end();
  }
}

export default secureHandler(handler,{path:'/api/og'});
