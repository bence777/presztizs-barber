import {AsyncLocalStorage} from 'node:async_hooks';
import {bookingDb} from './bookingDb.js';
import {authApi} from './guestAuth.js';
import {managerByEmail} from './bookingManagement.js';
import {emailBookingReminder,emailBookingReceipt,emailBookingUpdate,emailBookingChange,emailBookingRemoved} from './bookingEmail.js';
export const emailContext=new AsyncLocalStorage();
export async function drainOutbox(){
 const jobs=await bookingDb('rpc/booking_claim_outbox',{method:'POST',body:{p_limit:10}});
 let sent=0,failed=0;
 // Bounded concurrency keeps SMTP/API pressure and function duration predictable.
 await Promise.all(jobs.map(async job=>{
  let success=false,error=null;
  try {
   if(job.kind==='admin_otp'){
    const manager=await managerByEmail(job.payload.email);
    if(!manager||Date.now()-Date.parse(job.created_at)>300000)success=true;
    else{const result=await authApi('otp',{method:'POST',body:{email:job.payload.email,create_user:true}});success=result.ok;error=result.ok?null:`auth_${result.status}`;}
   }else{
    const booking=job.payload.booking;
    if(job.kind==='reminder'){
     const [current]=await bookingDb('booking_appointments',{query:{select:'status,starts_at,guest_email',id:`eq.${booking.id}`,limit:'1'}});
     if(!current||current.status!=='confirmed'||Date.parse(current.starts_at)!==Date.parse(booking.starts_at)||current.guest_email!==booking.guest_email||Date.parse(current.starts_at)<=Date.now()){
      await bookingDb('rpc/booking_finish_outbox',{method:'POST',body:{p_id:job.id,p_lease:job.lease_token,p_success:true,p_error:null}});return;
     }
    }
    const result=await emailContext.run({audience:job.audience,guestEmail:booking.guest_email,staffEmail:job.payload.staff_email,key:`demeters/${job.id}`},()=>{
     if(job.kind==='reminder')return emailBookingReminder({booking});
     if(job.kind==='receipt')return emailBookingReceipt({email:booking.guest_email,name:booking.guest_name,booking});
     if(job.kind==='removed')return emailBookingRemoved({booking});
     if(job.kind==='change')return emailBookingChange({booking,guestEmail:booking.guest_email,guestName:booking.guest_name,changedBy:'manager'});
     return emailBookingUpdate({booking});
    });
    success=result[job.audience]===true;if(!success)error='delivery_failed';
   }
  }catch(e){error=e.code||'upstream_error';}
  const committed=await bookingDb('rpc/booking_finish_outbox',{method:'POST',body:{p_id:job.id,p_lease:job.lease_token,p_success:success,p_error:error}});
  if(committed&&success)sent++;else failed++;
 }));
 return {claimed:jobs.length,sent,failed};
}
