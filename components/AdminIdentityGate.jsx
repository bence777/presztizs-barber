import {cloneElement, useCallback, useEffect, useState} from 'react';
import styles from '../styles/AdminAccess.module.css';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function adminApi(url, body) {
  const response = await fetch(`/api/admin/auth/${url}`, {
    credentials:'same-origin', cache:'no-store',
    ...(body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) {
    const error = new Error(data.error||'Nem sikerült a kapcsolódás.');
    error.status = response.status;
    error.email = data.email;
    throw error;
  }
  return data;
}

export default function AdminIdentityGate({children}) {
  const [phase,setPhase] = useState('loading');
  const [email,setEmail] = useState('');
  const [code,setCode] = useState('');
  const [remember,setRemember] = useState(false);
  const [manager,setManager] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [cooldown,setCooldown] = useState(0);

  const checkSession=useCallback(async()=>{
    setPhase('loading');setError('');
    try {
      const session=await adminApi('session');
      if(session.authenticated && session.manager){setManager(session.manager);setPhase('ready');}
      else {setManager(null);setPhase('email');}
    } catch(e) {
      if(e.status===403){setEmail(e.email||'');setManager(null);setPhase('denied');}
      else {setError(e.message);setPhase('unavailable');}
    }
  },[]);
  useEffect(()=>{checkSession()},[checkSession]);
  // A távolról visszavont eszköz már megnyitott felületét is zárjuk le.
  // A tényleges védelem továbbra is minden szerveroldali API-kérésnél történik.
  useEffect(()=>{
    if(phase!=='ready')return;
    let active=true;
    const check=async()=>{
      try {
        const state=await adminApi('session');
        if(active&&!state.authenticated){setManager(null);setPhase('email');}
        else if(active&&!state.manager){setManager(null);setPhase('denied');}
      }catch(e){
        if(active&&(e.status===401||e.status===403)){setManager(null);setPhase(e.status===403?'denied':'email');}
      }
    };
    const onFocus=()=>{void check()};
    const onVisible=()=>{if(document.visibilityState==='visible')void check()};
    const interval=setInterval(check,60000);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)};
  },[phase]);
  useEffect(()=>{
    if(cooldown<=0)return;
    const t=setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);
    return()=>clearTimeout(t);
  },[cooldown]);

  async function action(operation){
    if(busy)return;
    setBusy(true);setError('');
    try {await operation();}catch(e){
      setError(e.message);
      if(e.status===403) setPhase('denied');
    }finally{setBusy(false);}
  }
  const logout=useCallback(async()=>{
    await adminApi('logout',{});
    setManager(null);setCode('');setCooldown(0);setEmail('');setError('');setPhase('email');
  },[]);
  function sendCode(event){
    event?.preventDefault();
    if(!EMAIL_OK.test(email.trim())){setError('Érvényes e-mail-címet adj meg.');return;}
    action(async()=>{
      const normalized=email.trim().toLowerCase();
      await adminApi('send-code',{email:normalized});
      setEmail(normalized);setCode('');setCooldown(60);setPhase('code');
    });
  }
  function verifyCode(event){
    event.preventDefault();
    if(!/^\d{6,10}$/.test(code)){setError('6–10 számjegyes kódot adj meg.');return;}
    action(async()=>{
      const result=await adminApi('verify-code',{email,code,remember});
      if(!result.manager)throw new Error('A belépés nem sikerült.');
      setManager(result.manager);setCode('');setPhase('ready');
    });
  }
  function switchAccount(){action(logout);}

  if(phase==='ready' && manager) return cloneElement(children,{onAdminLogout:async()=>{try{await logout();}catch(e){setError(e.message);setPhase('unavailable');}},adminManager:manager});
  return <main className={styles.screen}>
    <div className={styles.top}><a href="/" className={styles.brand}>P<span>.</span> <strong>Presztízs Barber</strong></a><span className={styles.topLabel}>STUDIO / MANAGEMENT</span></div>
    <section className={styles.panel} aria-live="polite">
      <div className={styles.mark}>PB <span>ADMIN</span></div>
      <div className={styles.eyebrow}>KEZELŐI FELÜLET</div>
      {phase==='loading' && <><h1>Azonosítás ellenőrzése</h1><p className={styles.sub}>Megnézzük, be vagy-e jelentkezve a szalon kezelői fiókjába.</p><div className={styles.progress}/></>}
      {phase==='email' && <><h1>Üdv újra.</h1><p className={styles.sub}>Lépj be a szalon kezelői e-mail-címével. Ez a vendégprofiltól független belépés.</p>
        <form onSubmit={sendCode} className={styles.form}>
          <label htmlFor="admin-auth-email">Kezelői e-mail-cím</label>
          <input id="admin-auth-email" type="email" autoComplete="email" value={email} placeholder="barber@email.hu" maxLength={254} onChange={e=>setEmail(e.target.value)} required autoFocus/>
          <button className={styles.primary} type="submit" disabled={busy||!EMAIL_OK.test(email.trim())}>{busy?'Kód küldése…':'Ellenőrző kód küldése'} <span aria-hidden="true">→</span></button>
        </form><p className={styles.note}>Csak előzetesen engedélyezett szalonkezelők és barberek kapnak kódot. A vendégbelépés nem ad kezelői hozzáférést.</p>
      </>}
      {phase==='code' && <><h1>Ellenőrizd az e-mailed.</h1><p className={styles.sub}>Ha a megadott címhez aktív kezelői jogosultság tartozik, elküldtük az egyszer használatos belépési kódot ide: <strong>{email}</strong></p>
        <form onSubmit={verifyCode} className={styles.form}>
          <label htmlFor="admin-auth-otp">Ellenőrző kód</label>
          <input id="admin-auth-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={10} pattern="[0-9]{6,10}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="E-mailben kapott kód" required autoFocus/>
          <label style={{display:"flex",alignItems:"center",gap:9,fontSize:12,color:"#666",margin:"14px 0"}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Megbízható eszköz 7 napra (opcionális)</label>
          <button className={styles.primary} type="submit" disabled={busy||code.length<6}>{busy?'Ellenőrzés…':'Bejelentkezés'} <span aria-hidden="true">→</span></button>
        </form><div className={styles.subActions}>
          <button type="button" disabled={busy||cooldown>0} onClick={()=>sendCode()}>{cooldown>0?`Új kód ${cooldown} mp múlva`:'Kód újraküldése'}</button>
          <button type="button" disabled={busy} onClick={()=>{setError('');setCode('');setPhase('email');}}>Másik e-mail-cím</button>
        </div>
      </>}
      {phase==='denied' && <><h1>Nincs kezelői hozzáférés.</h1><p className={styles.sub}>A megadott fiók nem szerepel az aktív szalonkezelők között. A hozzáférést a szalon tulajdonosa adhatja meg.</p>{email&&<p className={styles.verified}>{email}</p>}<button className={styles.primary} disabled={busy} onClick={switchAccount} type="button">Belépés másik e-maillel <span>→</span></button></>}
      {phase==='unavailable' && <><h1>Kapcsolódási hiba.</h1><p className={styles.sub}>Most nem sikerült ellenőrizni a kezelői munkamenetet.</p><button className={styles.primary} onClick={checkSession} type="button">Újrapróbálás →</button></>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.bottom}><span>SECURE ACCESS · SUPABASE AUTH</span><a href="/foglalasaim">Vendég vagyok ↗</a></div>
    </section>
    <footer className={styles.footer}>© PRESZTÍZS BARBER <span>SAJÁT KEZELŐI AZONOSÍTÁS</span></footer>
  </main>;
}
