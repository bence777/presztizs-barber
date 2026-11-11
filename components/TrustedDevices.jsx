import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/router';
import styles from '../styles/TrustedDevices.module.css';

const displayDate = iso => new Intl.DateTimeFormat('hu-HU', {
  dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Budapest',
}).format(new Date(iso));

async function request(url,body,method='GET') {
  const response = await fetch(url,{
    credentials:'same-origin',cache:'no-store',
    ...(method==='GET'?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) {const err=new Error(data.error||'Nem sikerült a művelet.');err.status=response.status;throw err;}
  return data;
}

export default function TrustedDevices({scope='guest'}) {
  const admin=scope==='admin';
  const router=useRouter();
  const endpoint=admin?'/api/admin/devices':'/api/guest/devices';
  const [devices,setDevices]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [editing,setEditing]=useState('');
  const [name,setName]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {const data=await request(endpoint);setDevices(data.devices||[]);}
    catch(e) {setError(e.message);if(e.status===401){router.replace(admin?'/admin':'/foglalasaim');}}
    finally {setLoading(false);}
  },[endpoint,router,admin]);
  useEffect(()=>{load();},[load]);

  async function remove(device) {
    const text=device.current?
      'Ez a jelenlegi eszközöd. A hozzáférés azonnal megszűnik, és újra be kell jelentkezned. Törlöd?':
      `Megszünteted a(z) „${device.device_name}” eszköz hozzáférését? Más eszközök bejelentkezése megmarad.`;
    if(!window.confirm(text))return;
    setBusy(device.id);setError('');setNotice('');
    try {
      const result=await request(endpoint,{id:device.id},'DELETE');
      if(result.current) {
        await router.replace(admin?'/admin/foglalasok':'/foglalasaim');
        // Reload ensures the old authenticated UI and in-memory personal data disappear.
        window.location.reload();
      } else {
        setDevices(prev=>prev.filter(x=>x.id!==device.id));
        setNotice('Az eszköz hozzáférését megszüntettük. Új belépéshez e-mail-kód szükséges.');
      }
    } catch(e) {setError(e.message);} finally {setBusy('');}
  }

  async function rename(e,device) {
    e.preventDefault();setBusy(device.id);setError('');setNotice('');
    try {
      await request(endpoint,{id:device.id,name},'PATCH');
      setDevices(prev=>prev.map(x=>x.id===device.id?{...x,device_name:name.trim()}:x));
      setEditing('');setName('');setNotice('Az eszköz neve frissült.');
    }catch(e){setError(e.message);}finally{setBusy('');}
  }

  return <section className={`${styles.panel} ${admin?styles.admin:styles.guest}`} aria-labelledby="device-title">
    <div className={styles.heading}>
      <div><span className={styles.eyebrow}>FIÓKBIZTONSÁG / MUNKAMENETEK</span>
        <h1 id="device-title">Megbízható eszközök</h1>
        <p>Itt azokat a böngészőket látod, ahol korábban e-mail-kóddal azonosítottad magad.
          Több eszközöd is lehet egyszerre. Az admin- és a vendégbelépések külön kezelhetők.</p></div>
      <button className={styles.secondary} type="button" disabled={loading||!!busy} onClick={load}>Frissítés</button>
    </div>
    <div className={styles.privacy}>
      <strong>Nincs eszközkövetés vagy fingerprint.</strong>
      {' '}Az eszközlistában nem tárolunk IP-címet, teljes böngészőazonosítót, helyadatot vagy hardverujjlenyomatot.
      Az itt szereplő név csak tájékoztatás; az azonosítást véletlenszerű, biztonságos cookie végzi.
    </div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {notice&&<p className={styles.success} role="status">{notice}</p>}
    <div className={styles.list} aria-busy={loading}>
      {loading?<p className={styles.empty}>Eszközök betöltése…</p>:
        devices.length===0?<p className={styles.empty}>Nem található aktív, megjegyzett munkamenet.</p>:
        devices.map(device=><article className={styles.device} key={device.id}>
          <div className={styles.symbol} aria-hidden="true">{device.device_name.includes('iOS')||device.device_name.includes('Android')?'▯':'▣'}</div>
          <div className={styles.data}>
            <div className={styles.name}><strong>{device.device_name}</strong>{device.current&&<span className={styles.current}>EZ AZ ESZKÖZ</span>}</div>
            <span className={styles.meta}>Hozzáadva: {displayDate(device.created_at)}</span>
            <span className={styles.meta}>Utolsó használat: {displayDate(device.last_seen_at)}</span>
            <span className={styles.meta}>Lejár: {displayDate(device.expires_at)}</span>
            {editing===device.id&&<form className={styles.rename} onSubmit={e=>rename(e,device)}>
              <label htmlFor={`device-name-${device.id}`}>Eszköz saját neve</label>
              <div><input id={`device-name-${device.id}`} type="text" minLength={2} maxLength={60} autoFocus value={name} onChange={e=>setName(e.target.value)} required placeholder="Pl. Saját MacBook"/>
                <button type="submit" disabled={busy===device.id||name.trim().length<2}>Mentés</button>
                <button type="button" onClick={()=>setEditing('')}>Mégse</button></div>
            </form>}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={!!busy} onClick={()=>{setEditing(device.id);setName(device.device_name)}}>Átnevezés</button>
            <button type="button" className={styles.danger} disabled={!!busy} onClick={()=>remove(device)}>
              {busy===device.id?'Folyamatban…':'Eltávolítás'}
            </button>
          </div>
        </article>)}
    </div>
    <div className={styles.foot}>
      <p>Az eltávolítás törli az eszköz szerveroldali munkamenet-adatait, és a hozzáférés a következő kérésnél megszűnik.
        A foglalásaid és a profilod nem törlődnek. Újra belépni mindig lehet e-mail-kóddal.</p>
      <a href={admin?'/admin/foglalasok':'/foglalasaim'}>Vissza a foglalásokhoz <span aria-hidden="true">→</span></a>
    </div>
  </section>;
}
