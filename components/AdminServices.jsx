import {useEffect,useState} from 'react';
import {useLanguage} from './LanguageProvider';
import styles from '../styles/AdminServices.module.css';
const api=async(url,options={})=>{const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...options});const data=await response.json();if(!response.ok)throw new Error(data.error||'Sikertelen mentés.');return data};
const empty=order=>({name:'',description:'',price_huf:0,duration_minutes:30,sort_order:order,active:true,counts_as_haircut:false});
const weekdays=['Vasárnap','Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat'];
export default function AdminServices({mode,staff,manager,onSaved}){
 const {t}=useLanguage();
 const [staffId,setStaffId]=useState(manager?.staff_id||staff[0]?.id||'');
 const [services,setServices]=useState([]),[profile,setProfile]=useState(null),[hours,setHours]=useState([]);
 const [draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(!staffId&&staff.length)setStaffId(manager?.staff_id||staff[0].id)},[staff,manager,staffId]);
 useEffect(()=>{
  let live=true;if(!staffId)return;setLoading(true);setDraft(null);setError('');setMessage('');
  Promise.all([api(`/api/admin/services?staffId=${encodeURIComponent(staffId)}`),api(`/api/admin/settings?staffId=${encodeURIComponent(staffId)}`)]).then(([a,b])=>{if(live){setServices(a.services);setProfile(b.profile);setHours(b.hours.map(h=>({...h,opens:h.opens.slice(0,5),closes:h.closes.slice(0,5)})))}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[staffId,mode]);
 async function mutate(url,method,data){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{await api(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,staffId})});const [a,b]=await Promise.all([api(`/api/admin/services?staffId=${encodeURIComponent(staffId)}`),api(`/api/admin/settings?staffId=${encodeURIComponent(staffId)}`)]);setServices(a.services);setProfile(b.profile);setHours(b.hours.map(h=>({...h,opens:h.opens.slice(0,5),closes:h.closes.slice(0,5)})));setDraft(null);setMessage(t('Módosítások mentve.'));onSaved?.();}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 function change(key,value){setDraft(d=>({...d,[key]:value}))}
 return <section className={styles.panel} aria-busy={busy||loading}>
  {manager?.role==='owner'&&<label className={styles.staffPicker}>{t('Fodrász')}<select disabled={busy} value={staffId} onChange={e=>setStaffId(e.target.value)}>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {error&&<p role="alert" className={styles.error}>{t(error)}</p>}{message&&<p role="status">{message}</p>}
  {loading?<p role="status">{t('Betöltés…')}</p>:mode==='services'?<>
   <div className={styles.heading}><p>{t('Saját szolgáltatások, saját árak és időtartamok.')}</p><button disabled={busy||!staffId} type="button" onClick={()=>setDraft(empty(Math.max(-1,...services.map(s=>s.sort_order))+1))}>{t('Új szolgáltatás')}</button></div>
   <div className={styles.list}>{services.map(s=><article key={s.id} className={styles.service}>
    <div><h2>{s.name}</h2>{s.description&&<p>{s.description}</p>}<span>{s.active?t('Aktív'):t('Kikapcsolva')}{profile?.default_manual_service_id===s.id?` · ${t('Alapértelmezett')}`:''}</span></div>
    <strong>{new Intl.NumberFormat('hu-HU').format(s.price_huf)} Ft <small>{s.duration_minutes} {t('perc')}</small></strong>
    <div className={styles.actions}><button disabled={busy} type="button" onClick={()=>setDraft({...s})}>{t('Szerkesztés')}</button><button disabled={busy} type="button" onClick={()=>mutate('/api/admin/services','PATCH',{...s,active:!s.active})}>{s.active?t('Kikapcsolás'):t('Bekapcsolás')}</button><button disabled={busy} type="button" onClick={()=>{if(window.confirm(t('Archiválod a szolgáltatást? A meglévő foglalások megmaradnak.')))mutate('/api/admin/services','DELETE',{id:s.id})}}>{t('Archiválás')}</button></div>
   </article>)}</div>
   {!services.length&&<p>{t('Még nincs szolgáltatásod. Hozd létre az elsőt.')}</p>}
   {draft&&<form className={styles.form} onSubmit={e=>{e.preventDefault();mutate('/api/admin/services',draft.id?'PATCH':'POST',draft)}}>
    <h2>{draft.id?t('Szolgáltatás szerkesztése'):t('Új szolgáltatás')}</h2>
    <label>{t('Szolgáltatás neve')}<input required minLength={2} maxLength={100} value={draft.name} onChange={e=>change('name',e.target.value)}/></label>
    <label>{t('Leírás (opcionális)')}<textarea maxLength={2000} value={draft.description} onChange={e=>change('description',e.target.value)}/></label>
    <div className={styles.grid}><label>{t('Ár (Ft)')}<input required type="number" min={0} max={2147483647} step={1} value={draft.price_huf} onChange={e=>change('price_huf',Number(e.target.value))}/></label>
    <label>{t('Időtartam (perc)')}<input required type="number" min={1} max={2147483647} step={1} value={draft.duration_minutes} onChange={e=>change('duration_minutes',Number(e.target.value))}/></label></div>
    <div className={styles.presets}>{[15,30,45,60,90,120].map(n=><button type="button" key={n} aria-pressed={draft.duration_minutes===n} onClick={()=>change('duration_minutes',n)}>{n} {t('perc')}</button>)}</div>
    <label>{t('Megjelenési sorrend')}<input required type="number" min={0} max={2147483647} step={1} value={draft.sort_order} onChange={e=>change('sort_order',Number(e.target.value))}/></label>
    <label className={styles.check}><input type="checkbox" checked={draft.active} onChange={e=>change('active',e.target.checked)}/>{t('Aktív, nyilvánosan foglalható')}</label>
    <label className={styles.check}><input type="checkbox" checked={draft.counts_as_haircut} onChange={e=>change('counts_as_haircut',e.target.checked)}/>{t('Hajvágásként szerepeljen a statisztikában')}</label>
    <div className={styles.actions}><button disabled={busy} type="submit">{busy?t('Mentés…'):t('Mentés')}</button><button type="button" disabled={busy} onClick={()=>setDraft(null)}>{t('Mégse')}</button></div>
   </form>}
  </>:profile&&<>
   <form className={styles.form} onSubmit={e=>{e.preventDefault();mutate('/api/admin/settings','PATCH',profile)}}>
    <h2>{t('Saját beállítások')}</h2>
    <label>{t('Megjelenített név')}<input required minLength={2} maxLength={100} value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/></label>
    <label>{t('Profilkép hivatkozása')}<input maxLength={2000} placeholder="https://…" value={profile.image_url||''} onChange={e=>setProfile(p=>({...p,image_url:e.target.value}))}/></label>
    {profile.image_url&&<img className={styles.preview} src={profile.image_url} alt={profile.name}/>}
    <label>{t('Nyilvános telefonszám')}<input type="tel" maxLength={24} value={profile.public_phone||''} onChange={e=>setProfile(p=>({...p,public_phone:e.target.value}))}/><small>{t('Ez jelenik meg a vendégoldalon. A belépési adataid külön maradnak.')}</small></label>
    <label>{t('Foglalási kezdési lépésköz (perc)')}<input required type="number" min={1} max={1440} step={1} value={profile.booking_step_minutes} onChange={e=>setProfile(p=>({...p,booking_step_minutes:Number(e.target.value)}))}/><small>{t('A felkínált kezdések közötti idő. A foglalás hosszát a szolgáltatás határozza meg.')}</small></label>
    <label>{t('Alapértelmezett manuális szolgáltatás')}<select value={profile.default_manual_service_id||''} onChange={e=>setProfile(p=>({...p,default_manual_service_id:e.target.value||null}))}><option value="">{t('Nincs kiválasztva')}</option>{services.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} {t('perc')}</option>)}</select></label>
    <button disabled={busy} type="submit">{busy?t('Mentés…'):t('Beállítások mentése')}</button>
   </form>
   <form className={styles.form} onSubmit={e=>{e.preventDefault();mutate('/api/admin/settings','PATCH',{hours})}}>
    <h2>{t('Heti munkaidő')}</h2><p>{t('A szünethez külön idősávokat is megadhatsz. A szabadságokat és az eseti szüneteket a Szabadságok menüben kezelheted.')}</p>
    {hours.map((h,index)=><div className={styles.hourRow} key={index}><label>{t('Nap')}<select value={h.weekday} onChange={e=>setHours(rows=>rows.map((row,i)=>i===index?{...row,weekday:Number(e.target.value)}:row))}>{weekdays.map((d,n)=><option key={d} value={n}>{t(d)}</option>)}</select></label>{['opens','closes'].map((key,n)=><label key={key}>{t(n?'Zárás':'Nyitás')}<input type="time" required value={h[key]} onChange={e=>setHours(rows=>rows.map((row,i)=>i===index?{...row,[key]:e.target.value}:row))}/></label>)}<button type="button" aria-label={t('Idősáv törlése')} onClick={()=>setHours(rows=>rows.filter((_,i)=>i!==index))}>×</button></div>)}
    <div className={styles.actions}><button type="button" onClick={()=>setHours(rows=>[...rows,{weekday:1,opens:'09:00',closes:'17:00'}])}>{t('Idősáv hozzáadása')}</button><button disabled={busy} type="submit">{t('Munkaidő mentése')}</button></div>
   </form>
  </>}
 </section>;
}
