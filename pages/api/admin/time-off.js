import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {parseCalendarRange,adminMutationError} from '../../../lib/server/adminCalendar';
import {readTimeOff,mutateTimeOff} from '../../../lib/server/timeOff';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res) {
  if(!['GET','POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'Nem támogatott művelet.'});
  if(!jsonOnly(req,res,req.method))return;
  try {
    const session=await requireManager(req,res);if(!session)return;
    if(req.method==='GET')return res.status(200).json({timeOff:await readTimeOff(session.manager,parseCalendarRange(req.query.from,req.query.to),req.query.staffId)});
    const timeOff=await mutateTimeOff(req.method,req.body||{},session.manager);
    return res.status(req.method==='POST'?201:200).json({timeOff});
  }catch(e){return adminMutationError(res,e)}
}
