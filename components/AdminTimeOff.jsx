import {adminFetch} from '../lib/client/adminFetch';
import {useState} from 'react';
import useDialog from '../lib/client/useDialog';
import styles from '../styles/AdminDashboard.module.css';
const ZONE='Europe/Budapest';
const day=iso=>new Intl.DateTimeFormat('sv-SE',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const time=iso=>new Intl.DateTimeFormat('sv-SE',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));
export function absenceForm(row,date,staffId) {
  return row?.id?{id:row.id,revision:row.revision,staffId:row.staff_id,startDate:day(row.starts_at),endDate:day(row.all_day?new Date(Date.parse(row.ends_at)-1):row.ends_at),allDay:row.all_day,startTime:row.daily_start?.slice(0,5)||time(row.starts_at),endTime:row.daily_end?.slice(0,5)||time(row.ends_at),reason:row.reason||'',kind:row.kind||'leave'}:
    {staffId,startDate:date,endDate:date,allDay:true,startTime:'12:00',endTime:'13:00',reason:'',kind:'leave'};
}
export function AbsenceList({rows,staff,onEdit}) {
  return <section className={styles.absenceList} aria-label="Szabadságok és szünetek"><div className={styles.lowerTitle}><div><h2>Szabadságok és szünetek</h2><p>A kiválasztott hónap távollétei</p></div></div>
    {!rows.length&&<p className={styles.noResults}>Nincs rögzített távollét ebben az időszakban.</p>}
    {rows.map(row=><button key={row.id} className={styles.absenceRow} onClick={()=>onEdit(row)}><strong>{staff.find(s=>s.id===row.staff_id)?.name||'Fodrász'} · {row.kind==='break'?'Szünet':'Szabadság'}</strong><span>{day(row.starts_at)} – {day(row.all_day?new Date(Date.parse(row.ends_at)-1):row.ends_at)} · {row.all_day?'Egész nap':`${row.daily_start?.slice(0,5)||time(row.starts_at)}–${row.daily_end?.slice(0,5)||time(row.ends_at)}`}</span>{row.reason&&<small>{row.reason}</small>}<span>Szerkesztés</span></button>)}
  </section>;
}
export default function AdminTimeOff({initial,staff,manager,onClose,onSaved}) {
  const [form,setForm]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useDialog(true,()=>{if(!busy)onClose()});
  const field=(key,value)=>setForm(p=>({...p,[key]:value}));
  async function save(e,remove=false){e?.preventDefault();if(busy)return;
    if(remove&&!window.confirm('Törlöd a távollétet? Az érintett időpontok újra foglalhatóvá válhatnak.'))return;
    setBusy(true);setError('');
    try {const response=await adminFetch('/api/admin/time-off',{method:remove?'DELETE':form.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Nem sikerült menteni.');onSaved(remove?'Távollét törölve.':'Távollét elmentve.');}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div className={styles.drawerBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}><aside ref={dialog} tabIndex={-1} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="absence-title"><div className={styles.drawerHead}><h2 id="absence-title">{form.id?'Távollét szerkesztése':'Új távollét'}</h2><button type="button" className={styles.iconButton} disabled={busy} onClick={onClose} aria-label="Bezárás">×</button></div>
    <form className={styles.drawerForm} onSubmit={save}><div className={styles.formSection}><div className={styles.formGrid}>
      <label>Fodrász<select required disabled={manager?.role==='barber'||busy} value={form.staffId} onChange={e=>field('staffId',e.target.value)}><option value="">Válassz fodrászt</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Típus<select value={form.kind} onChange={e=>field('kind',e.target.value)}><option value="leave">Szabadság</option><option value="break">Szünet</option></select></label>
      <label>Kezdődátum<input required type="date" value={form.startDate} onChange={e=>field('startDate',e.target.value)}/></label>
      <label>Befejező dátum<input required type="date" min={form.startDate} value={form.endDate} onChange={e=>field('endDate',e.target.value)}/></label>
      <label className={styles.fullWidth}>Időtartam<select value={form.allDay?'all':'partial'} onChange={e=>field('allDay',e.target.value==='all')}><option value="all">Egész napos</option><option value="partial">Részleges, minden kiválasztott napon</option></select></label>
      {!form.allDay&&<><label>Kezdés<input required type="time" value={form.startTime} onChange={e=>field('startTime',e.target.value)}/></label><label>Befejezés<input required type="time" min={form.startTime} value={form.endTime} onChange={e=>field('endTime',e.target.value)}/></label></>}
      <label className={styles.fullWidth}>Megjegyzés (opcionális)<textarea maxLength={500} rows={3} value={form.reason} onChange={e=>field('reason',e.target.value)}/></label>
    </div></div><p className={styles.helpText}>A mentés az online foglalást is letiltja erre az időszakra. Ha meglévő foglalással ütközik, a rendszer figyelmeztet; a foglalások megmaradnak.</p>
      {error&&<p role="alert" className={styles.drawerError}>{error}</p>}<div className={styles.formActions}><button type="button" className={styles.cancelButton} disabled={busy} onClick={onClose}>Mégse</button><button type="submit" className={styles.primaryButton} disabled={busy}>{busy?'Mentés…':'Távollét mentése'}</button></div>
      {form.id&&<button type="button" className={styles.deleteButton} disabled={busy} onClick={()=>save(null,true)}>Távollét törlése</button>}
    </form></aside></div>;
}
