import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {readCalendar,adminMutationError} from '../../../lib/server/adminCalendar';
export default async function handler(req,res) {
  if(!jsonOnly(req,res,'GET'))return;
  try {
    const session=await requireManager(req,res);if(!session)return;
    const {from,to}=req.query;
    if(typeof from!=='string'||typeof to!=='string')return res.status(400).json({error:'Hiányzó időszak.'});
    const bookings=await readCalendar({manager:session.manager,from,to});
    res.status(200).json({bookings,manager:{role:session.manager.role,staff_id:session.manager.staff_id}});
  } catch(e){return adminMutationError(res,e)}
}
