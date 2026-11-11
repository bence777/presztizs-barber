import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/router';
import styles from '../styles/AdminDashboard.module.css';

const HOUR_START=8,HOUR_END=21,MINUTE_PX=1.26;
const ZONE='Europe/Budapest';
const WEEKDAYS=['H','K','Sze','Cs','P','Szo','V'];
const WEEK_NAMES=['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap'];
const STATUS={confirmed:'Megerősítve',cancelled:'Lemondva',completed:'Teljesítve',no_show:'Nem jelent meg'};
const ICONS={
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  list:<><path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/></>,
  plus:<path d="M12 5v14M5 12h14"/>,
  chevronLeft:<path d="m15 18-6-6 6-6"/>,
  chevronRight:<path d="m9 18 6-6-6-6"/>,
  refresh:<><path d="M20 11a8 8 0 0 0-14-5L4 8"/><path d="M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  scissors:<><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.2 8.2 12 12M14 10l6-6M8.2 15.8l4-4"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check:<path d="m5 12 4 4L19 6"/>,
  close:<path d="M18 6 6 18M6 6l12 12"/>,
  trash:<><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
  arrowUpRight:<path d="M7 17 17 7M7 7h10v10"/>,
  filter:<><path d="M4 7h16M7 12h10M10 17h4"/></>,
  users:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 3-5 6-5s6 2 6 5v2M16 5a3 3 0 0 1 0 6M17 13c2 0 4 2 4 5v2"/></>,
  edit:<><path d="M12 20h9M4 17.5V20h2.5L19 7.5 16.5 5 4 17.5Z"/></>,
  info:<><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></>,
};
function Icon({name,size=18,stroke=1.7}) {return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>}

const pad=n=>String(n).padStart(2,'0');
const offsetDay=(s,n)=>{const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)};
const startMonth=s=>s.slice(0,7)+'-01';
const endMonth=s=>{const [y,m]=s.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)};
const startWeek=s=>{const d=new Date(s+'T12:00:00Z').getUTCDay();return offsetDay(s,-((d+6)%7))};
const localStamp=(iso,parts)=>new Intl.DateTimeFormat('sv-SE',{timeZone:ZONE,...parts}).format(new Date(iso));
const dateKey=iso=>localStamp(iso,{year:'numeric',month:'2-digit',day:'2-digit'});
const timeKey=iso=>localStamp(iso,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const today=()=>dateKey(new Date().toISOString());
const shortDate=s=>new Intl.DateTimeFormat('hu-HU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
const fullDate=s=>new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
const dateDay=s=>new Date(s+'T12:00:00Z').getUTCDate();
const dayIdx=s=>(new Date(s+'T12:00:00Z').getUTCDay()+6)%7;
const formattedPrice=n=>new Intl.NumberFormat('hu-HU').format(n??0)+' Ft';
const minutes=iso=>{const [h,m]=timeKey(iso).split(':').map(Number);return h*60+m};
const duration=b=>Math.max(15,Math.round((new Date(b.ends_at)-new Date(b.starts_at))/60000));
const api=async(url,options={})=>{const r=await fetch(url,{cache:'no-store',credentials:'same-origin',...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Szerverhiba történt.');return d};
const forRange=(date,mode,tab)=>{
  if(tab==='list')return {from:offsetDay(date,-45),to:offsetDay(date,76)};
  if(mode==='day')return {from:date,to:offsetDay(date,1)};
  if(mode==='month'){const from=startWeek(startMonth(date));return {from,to:offsetDay(from,42)}};
  const from=startWeek(date);return {from,to:offsetDay(from,7)};
};
function parseBooking(b){return {staffId:b.staff_id,serviceId:b.service_id,date:dateKey(b.starts_at),time:timeKey(b.starts_at),guestName:b.guest_name||'',guestEmail:b.guest_email||'',guestPhone:b.guest_phone||'',status:b.status,notify:!b.is_demo};}
function emptyForm(date,time,staffId,services,staff){return {staffId:staffId||staff.find(x=>x.active)?.id||'',serviceId:services.find(x=>x.active)?.id||'',date:date||today(),time:time||'10:00',guestName:'',guestEmail:'',guestPhone:'',status:'confirmed',notify:true};}
function StatusTag({value}) {return <span className={`${styles.status} ${styles['status_'+value]||''}`}><span className={styles.statusDot}/>{STATUS[value]||value}</span>}

export default function AdminDashboard(){
  const router=useRouter();
  const [cursor,setCursor]=useState(today);
  const [view,setView]=useState('week');
  const [tab,setTab]=useState('calendar');
  const [bookings,setBookings]=useState([]);
  const [options,setOptions]=useState({services:[],staff:[],manager:null});
  const [loading,setLoading]=useState(true);
  const [refreshVersion,setRefreshVersion]=useState(0);
  const fetchSerial=useRef(0);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [toast,setToast]=useState('');
  const [filterStaff,setFilterStaff]=useState('all');
  const [filterStatus,setFilterStatus]=useState('all');
  const [search,setSearch]=useState('');
  const [form,setForm]=useState(null);
  const [selectedId,setSelectedId]=useState(null);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [isAdding,setIsAdding]=useState(false);
  const range=useMemo(()=>forRange(cursor,view,tab),[cursor,view,tab]);
  const todayKey=today();
  const load=useCallback(async()=>{
    const serial=++fetchSerial.current;
    setLoading(true);setError('');
    try {const data=await api(`/api/admin/calendar?from=${range.from}&to=${range.to}`);if(serial===fetchSerial.current)setBookings(data.bookings||[]);}
    catch(e){if(serial===fetchSerial.current)setError(e.message)}finally{if(serial===fetchSerial.current)setLoading(false)}
  },[range.from,range.to]);
  useEffect(()=>{let live=true;api('/api/admin/options').then(data=>{if(live)setOptions(data)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
  useEffect(()=>{load()},[load,refreshVersion]);
  useEffect(()=>{
    if(!router.isReady||typeof router.query.booking!=='string')return;
    let cancelled=false;
    api(`/api/admin/bookings?booking=${encodeURIComponent(router.query.booking)}`)
      .then(data=>{const b=data.bookings?.[0];if(!b||cancelled)return;setCursor(dateKey(b.starts_at));setTab('calendar');setSelectedId(b.id);setForm(parseBooking(b));setIsAdding(false);setDrawerOpen(true)})
      .catch(()=>{});
    return()=>{cancelled=true};
  },[router.isReady,router.query.booking]);
  useEffect(()=>{if(toast){const timeout=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timeout)}},[toast]);

  const filtered=useMemo(()=>bookings.filter(b=>{
    if(filterStaff!=='all'&&b.staff_id!==filterStaff)return false;
    if(filterStatus!=='all'&&b.status!==filterStatus)return false;
    if(search){const t=[b.guest_name,b.guest_email,b.guest_phone,b.service_name,b.staff_name].join(' ').toLocaleLowerCase('hu-HU');if(!t.includes(search.toLocaleLowerCase('hu-HU').trim()))return false;}
    return true;
  }),[bookings,filterStaff,filterStatus,search]);
  const counters=useMemo(()=>({all:filtered.length,confirmed:filtered.filter(b=>b.status==='confirmed').length,completed:filtered.filter(b=>b.status==='completed').length,cancelled:filtered.filter(b=>b.status==='cancelled').length}),[filtered]);
  const byDay=useMemo(()=>{const map=new Map();for(const b of filtered){const d=dateKey(b.starts_at);map.set(d,[...(map.get(d)||[]),b]);}for(const arr of map.values())arr.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));return map},[filtered]);
  const serviceOptions=options.services,staffOptions=options.staff;
  const currentBooking=selectedId?bookings.find(x=>x.id===selectedId):null;
  const heading=view==='day'?fullDate(cursor):view==='month'?new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long',timeZone:'UTC'}).format(new Date(cursor+'T12:00:00Z')):`${shortDate(startWeek(cursor))} – ${shortDate(offsetDay(startWeek(cursor),6))}, ${cursor.slice(0,4)}`;
  function move(direction){setCursor(old=>{if(tab==='list')return offsetDay(old,30*direction);if(view==='day')return offsetDay(old,direction);if(view==='week')return offsetDay(old,7*direction);const [y,m]=old.split('-').map(Number);return new Date(Date.UTC(y,m-1+direction,15)).toISOString().slice(0,10)})}
  function selectBooking(b){setSelectedId(b.id);setForm(parseBooking(b));setIsAdding(false);setDrawerOpen(true);window.history.replaceState({},'',`/admin/foglalasok?booking=${encodeURIComponent(b.id)}`)}
  function newBooking(day=cursor,time='10:00',staffId=filterStaff==='all'?'':filterStaff){if(!serviceOptions.length||!staffOptions.length){setError('A szolgáltatások és a barberek még nem töltődtek be.');return;}setSelectedId(null);setIsAdding(true);setForm(emptyForm(day,time,staffId,serviceOptions,staffOptions));setDrawerOpen(true);window.history.replaceState({},'','/admin/foglalasok')}
  function closeDrawer(){setDrawerOpen(false);setSelectedId(null);setIsAdding(false);setForm(null);window.history.replaceState({},'','/admin/foglalasok')}
  function setField(key,value){setForm(p=>({...p,[key]:value}))}
  async function saveBooking(event){event.preventDefault();if(!form||saving)return;setSaving(true);setError('');
    try{const result=await api('/api/admin/appointment',{method:isAdding?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,...(isAdding?{}:{id:selectedId})})});
      setToast(isAdding?'Foglalás sikeresen létrehozva.':'Módosítások sikeresen mentve.');
      if(form.notify&&result.emailSent&&(!result.emailSent.guest||!result.emailSent.staff))setToast('Mentve, de egy vagy több értesítő e-mail nem ment ki.');
      setCursor(form.date);closeDrawer();setRefreshVersion(x=>x+1);
    }catch(e){setError(e.message)}finally{setSaving(false)}
  }
  async function removeBooking(){if(!selectedId||!form||saving)return;
    if(!window.confirm(`VÉGLEG törlöd ezt a foglalást?\n\n${form.guestName} • ${form.date} ${form.time}\n\nA törölt foglalás nem állítható vissza.`))return;
    setSaving(true);setError('');try{
      await api('/api/admin/appointment',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selectedId,notify:form.notify})});
      setToast('A foglalást véglegesen törölted.');closeDrawer();setRefreshVersion(x=>x+1);
    }catch(e){setError(e.message)}finally{setSaving(false)}
  }
  const upcoming=filtered.filter(b=>b.status==='confirmed'&&new Date(b.starts_at)>=new Date()).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)).slice(0,5);

  function eventCard(b,layout={}) {const d=duration(b);return <button type="button" key={b.id} className={`${styles.calendarEvent} ${styles['event_'+b.status]||''}`} style={layout} title={`${timeKey(b.starts_at)} • ${b.guest_name} – ${b.service_name}`} onClick={e=>{e.stopPropagation();selectBooking(b)}}><span className={styles.eventTime}>{timeKey(b.starts_at)} · {d}p</span><strong>{b.guest_name||'Vendég'}</strong><span>{b.service_name}</span></button>}
  function dayColumn(day){const entries=(byDay.get(day)||[]).filter(b=>{const m=minutes(b.starts_at);return m>=HOUR_START*60&&m<HOUR_END*60});
    return <div className={styles.dayColumn} key={day} style={{height:(HOUR_END-HOUR_START)*60*MINUTE_PX}}>
      {Array.from({length:(HOUR_END-HOUR_START)*2},(_,i)=>{
        const minute=HOUR_START*60+i*30;
        return <button key={i} type="button" aria-label={`Új foglalás: ${day} ${pad(Math.floor(minute/60))}:${pad(minute%60)}`} className={styles.slot} style={{top:(minute-HOUR_START*60)*MINUTE_PX,height:30*MINUTE_PX}} onClick={()=>newBooking(day,`${pad(Math.floor(minute/60))}:${pad(minute%60)}`)}/>;
      })}
      {entries.map(b=>{
        const m=minutes(b.starts_at),overlapping=entries.filter(x=>x.id!==b.id&&minutes(x.starts_at)<m+duration(b)&&minutes(x.starts_at)+duration(x)>m);
        const group=[b,...overlapping].sort((a,c)=>a.id.localeCompare(c.id));const lane=group.findIndex(x=>x.id===b.id),count=group.length;
        const top=(m-HOUR_START*60)*MINUTE_PX+2, height=Math.max(30,Math.min(duration(b)*MINUTE_PX-4,(HOUR_END*60-m)*MINUTE_PX-4));
        return eventCard(b,{top,height,left:`calc(${lane*100/count}% + 3px)`,width:`calc(${100/count}% - 6px)`});
      })}
    </div>}
  const daysShown=view==='day'?[cursor]:Array.from({length:7},(_,i)=>offsetDay(startWeek(cursor),i));

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}><span className={styles.logo}>P<span>.</span></span><div><strong>PRESZTÍZS</strong><small>STUDIO MANAGEMENT</small></div></div>
      <div className={styles.navSection}>WORKSPACE</div>
      <nav className={styles.sideNav} aria-label="Kezelőfelület">
        <button type="button" className={tab==='calendar'?styles.navActive:''} onClick={()=>setTab('calendar')}><Icon name="calendar" size={17}/> Naptár</button>
        <button type="button" className={tab==='list'?styles.navActive:''} onClick={()=>setTab('list')}><Icon name="list" size={17}/> Foglalások <span className={styles.navCount}>{counters.all}</span></button>
      </nav>
      <div className={styles.sidebarDivider}/>
      <div className={styles.navSection}>GYORS MŰVELETEK</div>
      <button type="button" className={styles.navSimple} onClick={()=>newBooking()}><Icon name="plus" size={17}/> Új foglalás</button>
      <a className={styles.navSimple} href="/idopontfoglalas"><Icon name="arrowUpRight" size={17}/> Vendégoldal</a>
      <div className={styles.sidebarFoot}><div className={styles.onlineDot}/> <span>Adatkapcsolat · Supabase</span><small>EUROPE / BUDAPEST</small></div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}><div className={styles.breadcrumb}><span>Presztízs Barber</span><span className={styles.slash}>/</span><strong>{tab==='calendar'?'Naptár':'Foglalások'}</strong></div><div className={styles.topRight}><span className={styles.topTime}>MAGYARORSZÁG · GMT+1/+2</span><a href="/" title="Weboldal megnyitása"><Icon name="arrowUpRight" size={16}/></a><span className={styles.avatar}>PB</span></div></header>
      <div className={styles.content}>
        <div className={styles.headingRow}><div><div className={styles.overline}>FOGLALÁSKEZELŐ / ADMIN</div><h1>{tab==='calendar'?'Naptár':'Foglalások'}</h1><p>Az összes időpontod. Egy helyen, átláthatóan.</p></div><div className={styles.headingActions}><button type="button" className={styles.ghostButton} onClick={load} disabled={loading}><Icon name="refresh" size={16}/><span>Frissítés</span></button><button type="button" className={styles.primaryButton} onClick={()=>newBooking()}><Icon name="plus" size={17}/> Új foglalás</button></div></div>
        <div className={styles.stats}>
          {[['Összes foglalás',counters.all,'calendar'],['Megerősített',counters.confirmed,'clock'],['Teljesített',counters.completed,'check'],['Lemondott',counters.cancelled,'close']].map(([title,num,icon])=><div className={styles.statCard} key={title}><div className={styles.statLabel}><span>{title}</span><Icon name={icon} size={16}/></div><div className={styles.statValue}>{loading?'–':num}<span> / időszak</span></div></div>)}
        </div>
        {error&&<div role="alert" className={styles.error}><Icon name="info" size={17}/>{error}<button type="button" aria-label="Hiba bezárása" onClick={()=>setError('')}><Icon name="close" size={15}/></button></div>}
        <div className={styles.workspace}>
          <div className={styles.toolbar}><div className={styles.dateNav}><button type="button" className={styles.iconButton} aria-label="Előző" onClick={()=>move(-1)}><Icon name="chevronLeft"/></button><button type="button" className={styles.iconButton} aria-label="Következő" onClick={()=>move(1)}><Icon name="chevronRight"/></button><button type="button" className={styles.todayButton} onClick={()=>setCursor(today())}>Ma</button><strong>{tab==='list'?'Foglalási lista':heading}</strong></div>
            <div className={styles.toolbarRight}><div className={styles.mobileTabs}><button type="button" className={tab==='calendar'?styles.switchActive:''} onClick={()=>setTab('calendar')}>Naptár</button><button type="button" className={tab==='list'?styles.switchActive:''} onClick={()=>setTab('list')}>Lista</button></div><div className={styles.viewSwitch}>{tab==='calendar'&&[['day','Nap'],['week','Hét'],['month','Hónap']].map(([id,title])=><button type="button" key={id} className={view===id?styles.switchActive:''} onClick={()=>setView(id)}>{title}</button>)}</div></div>
          </div>
          <div className={styles.filters}><label className={styles.searchField}><Icon name="search" size={17}/><input type="search" placeholder="Vendég, e-mail, szolgáltatás keresése…" value={search} onChange={e=>setSearch(e.target.value)}/><span>⌘ K</span></label><div className={styles.filterRight}><span className={styles.filterIcon}><Icon name="filter" size={16}/></span><select aria-label="Barber szűrése" value={filterStaff} onChange={e=>setFilterStaff(e.target.value)}><option value="all">Összes barber</option>{staffOptions.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><select aria-label="Státusz szűrése" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">Minden állapot</option>{Object.entries(STATUS).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></div></div>
          <div className={styles.calendarContent}>
            {loading&&<div className={styles.loader} role="status">Foglalások betöltése…</div>}
            {tab==='list'?<div className={styles.tableWrap}><table className={styles.bookingsTable}><thead><tr><th>VENDÉG</th><th>IDŐPONT</th><th>SZOLGÁLTATÁS</th><th>BARBER</th><th>ÁR</th><th>ÁLLAPOT</th><th/></tr></thead><tbody>{[...filtered].sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at)).map(b=><tr key={b.id} onClick={()=>selectBooking(b)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')selectBooking(b)}}><td><strong>{b.guest_name||'Vendég'}</strong><span>{b.guest_email||'Nincs e-mail'}</span></td><td><strong>{fullDate(dateKey(b.starts_at))}</strong><span>{timeKey(b.starts_at)} – {timeKey(b.ends_at)}</span></td><td>{b.service_name}</td><td>{b.staff_name}</td><td>{formattedPrice(b.price_huf)}</td><td><StatusTag value={b.status}/></td><td><Icon name="chevronRight" size={16}/></td></tr>)}</tbody></table>{!loading&&!filtered.length&&<div className={styles.noResults}>Nincs találat ebben az időszakban.</div>}</div>
            :view==='month'?<div className={styles.monthCalendar}><div className={styles.monthHeader}>{WEEK_NAMES.map((name,i)=><div key={name}>{name}</div>)}</div><div className={styles.monthGrid}>{Array.from({length:42},(_,i)=>{const d=offsetDay(startWeek(startMonth(cursor)),i);const records=byDay.get(d)||[];return <div className={`${styles.monthCell} ${d.slice(0,7)!==cursor.slice(0,7)?styles.outsideMonth:''} ${d===todayKey?styles.isToday:''}`} key={d}><button type="button" className={styles.dayNumber} onClick={()=>{setCursor(d);setView('day')}}>{dateDay(d)}</button>{records.slice(0,3).map(b=><button key={b.id} className={`${styles.monthEvent} ${styles['month_'+b.status]||''}`} type="button" onClick={()=>selectBooking(b)}><span>{timeKey(b.starts_at)}</span> {b.guest_name||b.service_name}</button>)}{records.length>3&&<button type="button" className={styles.moreInDay} onClick={()=>{setCursor(d);setView('day')}}>+{records.length-3} további</button>}<button type="button" aria-label={`Új időpont ${d}`} className={styles.addInDay} onClick={()=>newBooking(d)}><Icon name="plus" size={14}/></button></div>})}</div></div>
            :<div className={`${styles.timeCalendar} ${view==='day'?styles.singleDay:''}`}><div className={styles.weekHeader}><div className={styles.corner}>GMT+1/+2</div>{daysShown.map(day=><button type="button" className={`${styles.dayHeading} ${day===todayKey?styles.todayHeading:''}`} onClick={()=>{setCursor(day);setView('day')}} key={day}><span>{WEEK_NAMES[dayIdx(day)]}</span><strong>{dateDay(day)}</strong></button>)}</div><div className={styles.timetable}><div className={styles.timeRail} style={{height:(HOUR_END-HOUR_START)*60*MINUTE_PX}}>{Array.from({length:HOUR_END-HOUR_START+1},(_,i)=><span key={i} style={{top:i*60*MINUTE_PX-7}}>{pad(HOUR_START+i)}:00</span>)}</div><div className={styles.daysGrid} style={{gridTemplateColumns:`repeat(${daysShown.length},minmax(0,1fr))`}}>{daysShown.map(day=>dayColumn(day))}</div></div></div>}
          </div>
          <div className={styles.bottomBar}><span><span className={styles.greenDot}/> {loading?'Betöltés…':`${filtered.length} foglalás`} · {view==='month'?'Havi':view==='week'?'Heti':'Napi'} nézet · Budapest</span><span>Kattints egy időpontra a szerkesztéshez, üres sávra az új foglaláshoz.</span></div>
        </div>
        <div className={styles.lowerPanel}><div className={styles.lowerTitle}><div><h2>Következő foglalások</h2><p>A kiválasztott időszakból</p></div><button type="button" onClick={()=>setTab('list')}>Összes megtekintése <Icon name="chevronRight" size={15}/></button></div><div className={styles.upcomingList}>{upcoming.length?upcoming.map(b=><button type="button" className={styles.upcomingRow} onClick={()=>selectBooking(b)} key={b.id}><div className={styles.upcomingDate}>{dateDay(dateKey(b.starts_at))}<span>{new Intl.DateTimeFormat('hu-HU',{month:'short',timeZone:'UTC'}).format(new Date(dateKey(b.starts_at)+'T12:00:00Z'))}</span></div><div className={styles.upcomingDesc}><strong>{b.guest_name||'Vendég'}</strong><span>{b.service_name} · {b.staff_name}</span></div><strong className={styles.upcomingTime}>{timeKey(b.starts_at)}</strong><Icon name="chevronRight" size={16}/></button>):<p className={styles.noUpcoming}>Nincs közelgő foglalás a kiválasztott időszakban.</p>}</div></div>
        <footer className={styles.footer}>PRESZTÍZS BARBER <span>ADMIN DASHBOARD / V1</span></footer>
      </div>
    </div>
    {drawerOpen&&form&&<div className={styles.drawerBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget)closeDrawer()}}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="booking-drawer-title"><div className={styles.drawerHead}><div><span className={styles.overline}>FOGLALÁS / {isAdding?'ÚJ':'SZERKESZTÉS'}</span><h2 id="booking-drawer-title">{isAdding?'Új foglalás':'Foglalás szerkesztése'}</h2></div><button type="button" className={styles.iconButton} aria-label="Bezárás" onClick={closeDrawer}><Icon name="close"/></button></div><form onSubmit={saveBooking} className={styles.drawerForm}>
      <div className={styles.formSection}><span className={styles.sectionLabel}>01 / IDŐPONT</span><div className={styles.formGrid}><label>Szolgáltatás<select required value={form.serviceId} onChange={e=>setField('serviceId',e.target.value)}>{serviceOptions.map(s=><option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}p · {formattedPrice(s.price_huf)}{!s.active?' (inaktív)':''}</option>)}</select></label><label>Barber<select required value={form.staffId} disabled={options.manager?.role==='barber'} onChange={e=>setField('staffId',e.target.value)}>{staffOptions.map(s=><option key={s.id} value={s.id}>{s.name}{!s.active?' (inaktív)':''}</option>)}</select></label><label>Dátum<input type="date" required value={form.date} onChange={e=>setField('date',e.target.value)}/></label><label>Kezdés<input type="time" step="900" required value={form.time} onChange={e=>setField('time',e.target.value)}/></label><label className={styles.fullWidth}>Állapot<select value={form.status} onChange={e=>setField('status',e.target.value)}>{Object.entries(STATUS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div></div>
      <div className={styles.formSection}><span className={styles.sectionLabel}>02 / VENDÉGADATOK</span><div className={styles.formGrid}><label className={styles.fullWidth}>Vendég neve<input required minLength={2} maxLength={120} value={form.guestName} onChange={e=>setField('guestName',e.target.value)} placeholder="Teljes név"/></label><label className={styles.fullWidth}>E-mail-cím<input type="email" maxLength={254} value={form.guestEmail} onChange={e=>setField('guestEmail',e.target.value)} placeholder="vendeg@email.hu"/></label><label className={styles.fullWidth}>Telefonszám<input type="tel" maxLength={24} value={form.guestPhone} onChange={e=>setField('guestPhone',e.target.value)} placeholder="+36 30 123 4567"/></label></div></div>
      <div className={styles.formSection}><span className={styles.sectionLabel}>03 / ÉRTESÍTÉS</span><label className={styles.notifyRow}><input type="checkbox" checked={form.notify} onChange={e=>setField('notify',e.target.checked)}/><span><strong>E-mailes értesítés küldése</strong><small>A levélben a vendég a saját foglalásához, a barber az adminnaptár adott foglalásához kap linket. Tesztadatoknál kapcsold ki.</small></span></label></div>
      {!isAdding&&<p className={styles.bookingMeta}>Foglalási azonosító: {selectedId}{currentBooking?.is_demo?' · TESZTADAT':''}</p>}
      {error&&<p className={styles.drawerError} role="alert">{error}</p>}
      <div className={styles.formActions}><button type="button" className={styles.cancelButton} onClick={closeDrawer}>Mégse</button><button type="submit" className={styles.primaryButton} disabled={saving||!form.staffId||!form.serviceId}>{saving?'Mentés…':isAdding?'Foglalás hozzáadása':'Módosítások mentése'}</button></div>
      {!isAdding&&<button type="button" className={styles.deleteButton} disabled={saving} onClick={removeBooking}><Icon name="trash" size={16}/> Foglalás végleges törlése</button>}
    </form></aside></div>}
    {toast&&<div className={styles.toast} role="status"><Icon name="check" size={16}/>{toast}<button type="button" aria-label="Értesítés bezárása" onClick={()=>setToast('')}><Icon name="close" size={13}/></button></div>}
  </div>;
}
