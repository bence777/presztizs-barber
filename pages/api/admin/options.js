import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {calendarOptions,adminMutationError} from '../../../lib/server/adminCalendar';
export default async function handler(req,res){
  if(!jsonOnly(req,res,'GET'))return;
  try {const session=await requireManager(req,res);if(!session)return;
    return res.status(200).json(await calendarOptions(session.manager));
  } catch(e){return adminMutationError(res,e)}
}
