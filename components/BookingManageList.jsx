import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/router';
import styles from '../styles/BookingManage.module.css';
const fmt = iso=>new Intl.DateTimeFormat('hu-HU',{timeZone:'Europe/Budapest',dateStyle:'full',timeStyle:'short'}).format(new Date(iso));
const money=n=>new Intl.NumberFormat('hu-HU').format(n)+' Ft';
const statusLabel={confirmed:'Megerősítve',cancelled:'Lemondva',completed:'Teljesítve',no_show:'Nem jelent meg'};
const api=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Szerverhiba');return data};
export default function BookingManageList({admin=false}) {
  const router=useRouter();
  const [items,setItems]=useState([]);
  const [page,setPage]=useState(0);
  const [more,setMore]=useState(false);
  const [filter,setFilter]=useState('upcoming');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  const [manager,setManager]=useState(null);
  const [emailResult,setEmailResult]=useState('');
  const focus=typeof router.query.booking==='string'?router.query.booking:'';
  useEffect(()=>{if(focus)setFilter('all')},[focus]);
  const load=useCallback(async(nextPage=0)=>{
    setLoading(true);setError('');
    try {
      const base=admin?'/api/admin/bookings':'/api/booking/mine';
      const data=await api(`${base}?page=${nextPage}`);
      let bookings=data.bookings;
      if(nextPage===0 && focus && !bookings.some(b=>b.id===focus)) {
        // Look up the emailed booking securely, including when it falls outside page one.
        try {
          const found=await api(`${base}?booking=${encodeURIComponent(focus)}`);
          bookings=[...found.bookings,...bookings];
        } catch(e) {console.warn('[booking/manage] Could not load linked booking:',e.message)}
      }
      setItems(prev=>{
        const merged=nextPage===0?bookings:[...prev,...bookings];
        return [...new Map(merged.map(b=>[b.id,b])).values()];
      });
      setMore(data.hasMore);setPage(nextPage);if(admin)setManager(data.manager);
    }
    catch(e){setError(e.message)}finally{setLoading(false)}
  },[admin,focus]);
  useEffect(()=>{load(0)},[load]);
  const now=Date.now();
  const shown=items.filter(b=>filter==='all'||(filter==='upcoming'?b.status==='confirmed'&&new Date(b.ends_at).getTime()>=now:!(b.status==='confirmed'&&new Date(b.ends_at).getTime()>=now)));
  async function change(b,status) {
    if(!window.confirm(status==='cancelled'?'Biztosan lemondod ezt a foglalást?':status==='completed'?'Teljesítettnek jelölöd az időpontot?':'Nem jelent meg a vendég?'))return;
    setBusy(b.id);setError('');setEmailResult('');
    try {const result=await api(admin?'/api/admin/change-status':'/api/booking/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.id,...(admin?{status}:{})})});setItems(prev=>prev.map(item=>item.id===b.id?{...item,...result.booking}:item));if(result.emailSent&&(!result.emailSent.guest||!result.emailSent.staff))setEmailResult('A foglalás módosult, de egy vagy több értesítő e-mail küldése nem sikerült. Ellenőrizd a Resend beállításokat.');}
    catch(e){setError(e.message)}finally{setBusy('')}
  }
  return <div className={styles.panel}>
    <div className={styles.bar}><div className={styles.tabs}>{[['upcoming','Közelgő'],['past','Korábbi'],['all','Összes']].map(([id,title])=><button key={id} type="button" className={filter===id?styles.active:''} onClick={()=>setFilter(id)}>{title}</button>)}</div><button className={styles.refresh} type="button" onClick={()=>load(0)} disabled={loading}>↻ FRISSÍTÉS</button></div>
    {admin&&manager&&<p className={styles.hint}>{manager.role==='owner'?'Szalonkezelői hozzáférés – minden barber foglalása':'Barber hozzáférés – kizárólag a saját foglalásaid'}</p>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}{emailResult&&<p role="status" className={styles.error}>{emailResult}</p>}
    <div className={styles.list}>
      {shown.map(b=><article id={b.id===focus?'kiemelt-foglalas':undefined} key={b.id} className={`${styles.item} ${b.id===focus?styles.highlight:''}`}>
        <div className={styles.itemTop}><span className={styles.status}>{statusLabel[b.status]||b.status}</span><span className={styles.id}>#{b.id.slice(0,8)}</span></div>
        <h3>{b.service_name}</h3><p className={styles.date}>{fmt(b.starts_at)}</p>
        <div className={styles.details}><span>BARBER <strong>{b.staff_name}</strong></span><span>ÁR <strong>{money(b.price_huf)}</strong></span></div>
        {admin&&<div className={styles.guest}><strong>{b.guest_name}</strong><span>{b.guest_email || 'Nincs tárolt e-mail'}</span><span>{b.guest_phone}</span></div>}
        <div className={styles.actions}>
          {b.status==='confirmed'&&(!admin?new Date(b.starts_at).getTime()>now:true)&&<button disabled={!!busy} type="button" onClick={()=>change(b,'cancelled')}>{busy===b.id?'MENTÉS…':'IDŐPONT LEMONDÁSA'}</button>}
          {admin&&b.status==='confirmed'&&new Date(b.starts_at).getTime()<=now&&<><button disabled={!!busy} type="button" onClick={()=>change(b,'completed')}>TELJESÍTVE</button><button disabled={!!busy} type="button" onClick={()=>change(b,'no_show')}>NEM JELENT MEG</button></>}
          {!admin&&<a href={`/idopontfoglalas?service=${encodeURIComponent(b.service_id)}&barber=${encodeURIComponent(b.staff_id)}`}>ÚJ IDŐPONT →</a>}
        </div>
      </article>)}
      {!loading&&!shown.length&&<div className={styles.empty}><h3>Nincs itt foglalás.</h3><p>{filter==='upcoming'?'A következő időpontjaid itt jelennek majd meg.':'Ebben a nézetben egyelőre nincs találat.'}</p>{!admin&&<a href="/idopontfoglalas">ÚJ FOGLALÁS →</a>}</div>}
    </div>
    {loading&&<p className={styles.hint}>Foglalások betöltése…</p>}
    {more&&<button className={styles.more} disabled={loading} onClick={()=>load(page+1)}>TOVÁBBI FOGLALÁSOK BETÖLTÉSE</button>}
  </div>;
}
