// Transactional messages via Resend HTTP API; Auth OTP is separately delivered via Supabase SMTP.
import { notificationRecipients } from './bookingManagement';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = iso => new Intl.DateTimeFormat('hu-HU',{timeZone:'Europe/Budapest',dateStyle:'full',timeStyle:'short'}).format(new Date(iso));
const price = n => new Intl.NumberFormat('hu-HU').format(n)+' Ft';
const root = () => {const origin=process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;return origin && /^https?:\/\//.test(origin)?origin.replace(/\/$/,''):null;};
function card({title,intro,booking,link,label,extra}) {
  const fields=[['Szolgáltatás',booking.service_name],['Barber',booking.staff_name],['Időpont',fmt(booking.starts_at)],['Ár',price(booking.price_huf)]];
  if(extra) fields.unshift(...extra);
  const action=link?`<p style="margin:28px 0"><a href="${esc(link)}" style="display:inline-block;background:#111;color:white;padding:15px 21px;text-decoration:none;font:700 12px Arial;letter-spacing:.05em">${esc(label)}</a></p><p style="font:12px/1.6 Arial,sans-serif;color:#777">Ha a gomb nem működik, nyisd meg ezt a linket:<br><a href="${esc(link)}" style="overflow-wrap:anywhere;color:#111">${esc(link)}</a></p>`:'';
  return `<!doctype html><html lang="hu"><body style="margin:0;background:#eee;padding:36px 12px;color:#111"><main style="max-width:580px;margin:auto;background:white;padding:36px;font:15px/1.7 Arial,sans-serif"><h1 style="font:38px Georgia,serif;letter-spacing:-2px">PRESZTÍZS <i>Barber</i></h1><h2 style="font:32px Georgia,serif">${esc(title)}</h2><p>${esc(intro)}</p><table style="width:100%;border-collapse:collapse">${fields.map(([k,v])=>`<tr><td style="padding:12px 0;border-bottom:1px solid #ddd;color:#666">${esc(k)}</td><td style="text-align:right;padding:12px 0;border-bottom:1px solid #ddd">${esc(v)}</td></tr>`).join('')}</table>${action}<p style="color:#777;font-size:12px">A kezelőfelület belépéskor e-mailes azonosítást kérhet. A foglalási azonosító: ${esc(booking.id)}</p></main></body></html>`;
}
async function send(to, subject, html, text) {
  if(!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {console.warn('[booking/email] RESEND_API_KEY vagy RESEND_FROM hiányzik');return false;}
  if(!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {console.warn('[booking/email] Hiányzó célcím');return false;}
  try {
    const r=await fetch('https://api.resend.com/emails', {method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[to],subject,html,text})});
    if(!r.ok) {const raw=await r.text();console.error('[booking/email] Resend HTTP',r.status,raw.slice(0,250));return false;}
    return true;
  } catch(e) {console.error('[booking/email] network',e.message);return false;}
}
export async function emailBookingReceipt({email,name,booking}) {
  const url=root();
  if (!url) console.warn('[booking/email] NEXT_PUBLIC_SITE_URL vagy SITE_URL hiányzik; a kezelési link nem kerül az e-mailbe.');
  const guestLink=url?`${url}/foglalasaim?booking=${encodeURIComponent(booking.id)}`:null;
  const managerLink=url?`${url}/admin/foglalasok?booking=${encodeURIComponent(booking.id)}`:null;
  const guestHtml=card({title:'Sikeres időpontfoglalás',intro:`Szia ${name}! Rögzítettük az időpontodat.`,booking,link:guestLink,label:'FOGLALÁSAIM KEZELÉSE'});
  const staffEmail=await notificationRecipients(booking.staff_id);
  const staffHtml=card({title:'Új időpontfoglalás',intro:'Új foglalás érkezett a szalonba.',booking,link:managerLink,label:'FOGLALÁS MEGNYITÁSA',extra:[['Vendég',name],['E-mail',email]]});
  const results=await Promise.all([
    send(email,'Presztízs Barber – foglalás visszaigazolása',guestHtml,`Sikeres foglalás: ${booking.service_name}, ${fmt(booking.starts_at)}. Kezelés: ${guestLink||'A weboldalon, bejelentkezés után.'}`),
    send(staffEmail,'Presztízs Barber – új foglalás',staffHtml,`Új foglalás: ${name} (${email}), ${booking.service_name}, ${fmt(booking.starts_at)}. Kezelés: ${managerLink||'A weboldalon, kezelői belépés után.'}`),
  ]);
  return {guest:results[0],staff:results[1]};
}
export async function emailBookingChange({booking,guestEmail,guestName,changedBy}) {
  const url=root();
  if (!url) console.warn('[booking/email] NEXT_PUBLIC_SITE_URL vagy SITE_URL hiányzik; a kezelési link nem kerül az e-mailbe.');
  const guestLink=url?`${url}/foglalasaim?booking=${encodeURIComponent(booking.id)}`:null;
  const managerLink=url?`${url}/admin/foglalasok?booking=${encodeURIComponent(booking.id)}`:null;
  const label=booking.status==='cancelled'?'Lemondott időpont':booking.status==='completed'?'Teljesített időpont':'Nem megjelent vendég';
  const staffEmail=await notificationRecipients(booking.staff_id);
  const guestHtml=card({title:label,intro:`Szia ${guestName||'Vendég'}! A foglalásod állapota megváltozott.`,booking,link:guestLink,label:'FOGLALÁSAIM'});
  const staffHtml=card({title:label,intro:`A foglalás állapotát ${changedBy==='guest'?'a vendég':'a szalon'} módosította.`,booking,link:managerLink,label:'FOGLALÁSKEZELŐ',extra:[['Vendég',guestName||'Vendég']]});
  const [guest,staff]=await Promise.all([
    guestEmail?send(guestEmail,`Presztízs Barber – ${label.toLowerCase()}`,guestHtml,`${label}: ${fmt(booking.starts_at)}. ${guestLink||''}`):false,
    send(staffEmail,`Presztízs Barber – ${label.toLowerCase()}`,staffHtml,`${label}: ${fmt(booking.starts_at)}. ${managerLink||''}`),
  ]);
  return {guest,staff};
}

export async function emailBookingUpdate({booking}) {
  const url=root();
  const guestLink=url?`${url}/foglalasaim?booking=${encodeURIComponent(booking.id)}`:null;
  const staffLink=url?`${url}/admin/foglalasok?booking=${encodeURIComponent(booking.id)}`:null;
  const guestHtml=card({title:'A foglalásod módosult',intro:`Szia ${booking.guest_name||'Vendég'}! Frissítettük az időpontod adatait.`,booking,link:guestLink,label:'FOGLALÁSOM MEGNYITÁSA'});
  const staffHtml=card({title:'Foglalás módosítva',intro:'A kezelőfelületen módosult egy foglalás.',booking,link:staffLink,label:'FOGLALÁSKEZELŐ',extra:[['Vendég',booking.guest_name||'Vendég']]});
  const staff=await notificationRecipients(booking.staff_id);
  const [guest,manager]=await Promise.all([
    booking.guest_email?send(booking.guest_email,'Presztízs Barber – foglalás módosítása',guestHtml,`A foglalásod módosult: ${fmt(booking.starts_at)}. ${guestLink||''}`):false,
    send(staff,'Presztízs Barber – foglalás módosítva',staffHtml,`Foglalás módosítva: ${fmt(booking.starts_at)}. ${staffLink||''}`),
  ]);
  return {guest,staff:manager};
}
export async function emailBookingRemoved({booking}) {
  const intro='A foglalást a szalon véglegesen törölte a rendszerből.';
  const removed={...booking,status:'cancelled'};
  const html=card({title:'Foglalás törölve',intro,booking:removed,link:null,label:''});
  const staff=await notificationRecipients(booking.staff_id);
  const [guest,manager]=await Promise.all([
    booking.guest_email?send(booking.guest_email,'Presztízs Barber – foglalás törölve',html,`${intro} ${fmt(booking.starts_at)}`):false,
    send(staff,'Presztízs Barber – foglalás törölve',html,`${intro} ${fmt(booking.starts_at)}`),
  ]);
  return {guest,staff:manager};
}
