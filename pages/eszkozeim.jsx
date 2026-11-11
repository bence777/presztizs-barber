import Head from 'next/head';
import BookingIdentityGate from '../components/BookingIdentityGate';
import TrustedDevices from '../components/TrustedDevices';
export default function GuestDevices(){return <><Head><title>Megbízható eszközeim | Presztízs Barber</title><meta name="robots" content="noindex,nofollow,noarchive"/></Head>
  <main style={{background:'#080808',minHeight:'100svh',color:'#fff'}}>
    <nav style={{maxWidth:1200,margin:'auto',padding:'22px 20px',display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',fontFamily:'Arial,sans-serif'}}>
      <a href="/" style={{color:'#fff',fontWeight:700,textDecoration:'none'}}>PRESZTÍZS BARBER</a>
      <a href="/foglalasaim" style={{color:'#ddd',textDecoration:'none'}}>← Foglalásaim</a>
    </nav>
    <BookingIdentityGate><TrustedDevices scope="guest"/></BookingIdentityGate>
  </main></>}
