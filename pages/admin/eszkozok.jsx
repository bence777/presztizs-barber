import Head from 'next/head';
import AdminIdentityGate from '../../components/AdminIdentityGate';
import TrustedDevices from '../../components/TrustedDevices';
export default function AdminDevices(){return <><Head><title>Eszközök kezelése | Presztízs Barber Admin</title><meta name="robots" content="noindex,nofollow,noarchive"/></Head>
  <div style={{background:'#f6f6f6',minHeight:'100svh'}}>
    <nav style={{padding:'18px 5vw',background:'#fff',borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
      <a href="/admin/foglalasok" style={{color:'#111',fontWeight:700,textDecoration:'none'}}>PRESZTÍZS / ADMIN</a>
      <a href="/admin/foglalasok" style={{color:'#555',textDecoration:'none'}}>← Naptár</a>
    </nav>
    <AdminIdentityGate><TrustedDevices scope="admin"/></AdminIdentityGate>
  </div></>}
