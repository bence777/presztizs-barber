import Head from 'next/head';
import BookingIdentityGate from '../../components/BookingIdentityGate';
import AdminDashboard from '../../components/AdminDashboard';
export default function AdminBookings(){
  return <><Head><title>Foglaláskezelő · Presztízs Barber</title><meta name="robots" content="noindex,nofollow,noarchive"/></Head>
    <div style={{minHeight:'100svh',background:'#0b0b0b'}}>
      <BookingIdentityGate><AdminDashboard/></BookingIdentityGate>
    </div>
  </>;
}
