import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {readCalendar,parseCalendarRange,adminMutationError} from '../../../lib/server/adminCalendar';
import {readTimeOff} from '../../../lib/server/timeOff';
import {bookingDb} from '../../../lib/server/bookingDb';
import {scopedStaff} from '../../../lib/server/bookingManagement';
export default async function handler(req,res) {
  if(!jsonOnly(req,res,'GET'))return;
  try {
    const session=await requireManager(req,res);if(!session)return;
    const {from,to}=req.query;
    if(typeof from!=='string'||typeof to!=='string')return res.status(400).json({error:'Hiányzó időszak.'});
    const staff=scopedStaff(session.manager,req.query.staffId);
    const [bookings,timeOff,hours]=await Promise.all([
      readCalendar({manager:session.manager,from,to,staffId:staff}),
      readTimeOff(session.manager,parseCalendarRange(from,to),staff),
      bookingDb('booking_hours',{query:{select:'staff_id,weekday,opens,closes',...(staff?{staff_id:`eq.${staff}`}:{})}}),
    ]);
    res.status(200).json({bookings,timeOff,hours,manager:{role:session.manager.role,staff_id:session.manager.staff_id}});
  } catch(e){return adminMutationError(res,e)}
}
