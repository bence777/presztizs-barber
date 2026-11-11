// Transactional booking emails via Resend. Auth OTP is sent separately by Supabase SMTP.
import { notificationRecipients, DEFAULT_SALON_EMAIL } from './bookingManagement.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = iso => new Intl.DateTimeFormat('hu-HU', {timeZone:'Europe/Budapest', dateStyle:'full', timeStyle:'short'}).format(new Date(iso));
const price = n => new Intl.NumberFormat('hu-HU').format(n) + ' Ft';

// URLs must come from trusted server configuration, never from a request Host header.
export function bookingSiteUrl(env = process.env) {
  const vercel = (env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL || '').trim();
  const port = /^\d{2,5}$/.test(String(env.PORT || '')) ? env.PORT : '3000';
  const candidates = [env.SITE_URL, env.NEXT_PUBLIC_SITE_URL,
    vercel ? `https://${vercel}` : null,
    env.NODE_ENV !== 'production' ? `http://localhost:${port}` : null,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    try {
      const parsed = new URL(candidate.trim());
      if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) continue;
      if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') continue;
      return parsed.origin; // Ignore accidental trailing paths in env vars.
    } catch { /* Try the next trusted configuration source. */ }
  }
  return null;
}

export function bookingLinks(id, env = process.env) {
  const site = bookingSiteUrl(env);
  if (!site || typeof id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)) return null;
  const booking = encodeURIComponent(id);
  return {
    guest: `${site}/foglalasaim?booking=${booking}`,
    staff: `${site}/admin/foglalasok?booking=${booking}`,
    guestOverview: `${site}/foglalasaim`,
    staffOverview: `${site}/admin/foglalasok`,
  };
}

function card({title, intro, booking, link, label, extra=[]}) {
  const fields = [
    ['Szolgáltatás',booking.service_name], ['Barber',booking.staff_name],
    ['Időpont',fmt(booking.starts_at)], ['Ár',price(booking.price_huf)],
  ];
  fields.unshift(...extra);
  // Do not send transactional booking emails without the management action.
  if (!link) throw new Error('A foglaláskezelő e-mailhez kötelező a kezelési link.');
  const action = `<p style="margin:28px 0"><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;padding:15px 21px;text-decoration:none;font:700 12px Arial,sans-serif;letter-spacing:.05em">${esc(label)}</a></p><p style="font:12px/1.6 Arial,sans-serif;color:#666">Ha a gomb nem működik, nyisd meg ezt a linket:<br><a href="${esc(link)}" style="overflow-wrap:anywhere;color:#111">${esc(link)}</a></p>`;
  return `<!doctype html><html lang="hu"><body style="margin:0;background:#eee;padding:36px 12px;color:#111"><main style="max-width:580px;margin:auto;background:white;padding:36px;font:15px/1.7 Arial,sans-serif"><h1 style="font:38px Georgia,serif;letter-spacing:-2px">PRESZTÍZS <i>Barber</i></h1><h2 style="font:32px Georgia,serif">${esc(title)}</h2><p>${esc(intro)}</p><table style="width:100%;border-collapse:collapse">${fields.map(([k,v])=>`<tr><td style="padding:12px 0;border-bottom:1px solid #ddd;color:#666">${esc(k)}</td><td style="text-align:right;padding:12px 0;border-bottom:1px solid #ddd">${esc(v)}</td></tr>`).join('')}</table>${action}<p style="color:#777;font-size:12px">A kezelőfelület bejelentkezéskor e-mailes azonosítást kérhet. Foglalási azonosító: ${esc(booking.id)}</p></main></body></html>`;
}

async function send(to, subject, html, text) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    console.warn('[booking/email] RESEND_API_KEY vagy RESEND_FROM hiányzik');
    return false;
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn('[booking/email] Hiányzó vagy hibás címzett');
    return false;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json'},
      body:JSON.stringify({from:process.env.RESEND_FROM, to:[to], subject, html, text}),
    });
    if (!response.ok) {
      const raw = await response.text();
      console.error('[booking/email] Resend HTTP', response.status, raw.slice(0,250));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[booking/email] network',error.message);
    return false;
  }
}

async function staffRecipient(staffId) {
  try { return await notificationRecipients(staffId); }
  catch (error) {
    console.error('[booking/email] Nem sikerült a barber e-mail-címét lekérni; szalon címére küldünk:', error.code || error.message);
    return DEFAULT_SALON_EMAIL;
  }
}

function requiredLinks(id) {
  const links = bookingLinks(id);
  if (!links) {
    console.error('[booking/email] Nincs érvényes SITE_URL / NEXT_PUBLIC_SITE_URL; link nélküli értesítést nem küldünk.');
    return null;
  }
  return links;
}

export async function emailBookingReceipt({email,name,booking}) {
  const links = requiredLinks(booking.id);
  if (!links) return {guest:false,staff:false};
  const guestHtml = card({title:'Sikeres időpontfoglalás',intro:`Szia ${name || 'Vendég'}! Rögzítettük az időpontodat.`,booking,link:links.guest,label:'FOGLALÁSOM KEZELÉSE'});
  const staffHtml = card({title:'Új időpontfoglalás',intro:'Új foglalás érkezett a szalonba.',booking,link:links.staff,label:'FOGLALÁS KEZELÉSE',extra:[['Vendég',name],['E-mail',email]]});
  const staffEmail = await staffRecipient(booking.staff_id);
  const results = await Promise.all([
    send(email,'Presztízs Barber – foglalás visszaigazolása',guestHtml,`Sikeres foglalás: ${booking.service_name}, ${fmt(booking.starts_at)}. Foglalás kezelése: ${links.guest}`),
    send(staffEmail,'Presztízs Barber – új foglalás',staffHtml,`Új foglalás: ${name} (${email}), ${booking.service_name}, ${fmt(booking.starts_at)}. Foglalás kezelése: ${links.staff}`),
  ]);
  return {guest:results[0],staff:results[1]};
}

export async function emailBookingChange({booking,guestEmail,guestName,changedBy}) {
  const links = requiredLinks(booking.id);
  if (!links) return {guest:false,staff:false};
  const label = booking.status==='cancelled'?'Lemondott időpont':booking.status==='completed'?'Teljesített időpont':'Nem jelent meg a vendég';
  const staffEmail = await staffRecipient(booking.staff_id);
  const guestHtml = card({title:label,intro:`Szia ${guestName||'Vendég'}! A foglalásod állapota megváltozott.`,booking,link:links.guest,label:'FOGLALÁSOM KEZELÉSE'});
  const staffHtml = card({title:label,intro:`A foglalás állapotát ${changedBy==='guest'?'a vendég':'a szalon'} módosította.`,booking,link:links.staff,label:'FOGLALÁS KEZELÉSE',extra:[['Vendég',guestName||'Vendég']]});
  const [guest,staff] = await Promise.all([
    guestEmail ? send(guestEmail,`Presztízs Barber – ${label.toLowerCase()}`,guestHtml,`${label}: ${fmt(booking.starts_at)}. Foglalás kezelése: ${links.guest}`) : false,
    send(staffEmail,`Presztízs Barber – ${label.toLowerCase()}`,staffHtml,`${label}: ${fmt(booking.starts_at)}. Foglalás kezelése: ${links.staff}`),
  ]);
  return {guest,staff};
}

export async function emailBookingUpdate({booking}) {
  const links = requiredLinks(booking.id);
  if (!links) return {guest:false,staff:false};
  const guestHtml = card({title:'A foglalásod módosult',intro:`Szia ${booking.guest_name||'Vendég'}! Frissítettük az időpontod adatait.`,booking,link:links.guest,label:'FOGLALÁSOM KEZELÉSE'});
  const staffHtml = card({title:'Foglalás módosítva',intro:'A kezelőfelületen módosult egy foglalás.',booking,link:links.staff,label:'FOGLALÁS KEZELÉSE',extra:[['Vendég',booking.guest_name||'Vendég']]});
  const staffEmail = await staffRecipient(booking.staff_id);
  const [guest,staff] = await Promise.all([
    booking.guest_email ? send(booking.guest_email,'Presztízs Barber – foglalás módosítása',guestHtml,`A foglalásod módosult: ${fmt(booking.starts_at)}. Foglalás kezelése: ${links.guest}`) : false,
    send(staffEmail,'Presztízs Barber – foglalás módosítva',staffHtml,`Foglalás módosítva: ${fmt(booking.starts_at)}. Foglalás kezelése: ${links.staff}`),
  ]);
  return {guest,staff};
}

export async function emailBookingRemoved({booking}) {
  const links = requiredLinks(booking.id);
  if (!links) return {guest:false,staff:false};
  const intro = 'A foglalást a szalon véglegesen törölte a rendszerből.';
  // This individual booking no longer exists. Link to each overview, NOT a dead booking ID.
  const guestHtml = card({title:'Foglalás törölve',intro,booking,link:links.guestOverview,label:'FOGLALÁSAIM'});
  const staffHtml = card({title:'Foglalás törölve',intro,booking,link:links.staffOverview,label:'FOGLALÁSKEZELŐ'});
  const staffEmail = await staffRecipient(booking.staff_id);
  const [guest,staff] = await Promise.all([
    booking.guest_email ? send(booking.guest_email,'Presztízs Barber – foglalás törölve',guestHtml,`${intro} ${fmt(booking.starts_at)}. Foglalásaim: ${links.guestOverview}`) : false,
    send(staffEmail,'Presztízs Barber – foglalás törölve',staffHtml,`${intro} ${fmt(booking.starts_at)}. Foglaláskezelő: ${links.staffOverview}`),
  ]);
  return {guest,staff};
}
