import {secureHandler} from '../../../lib/server/security';
import {jsonOnly} from '../../../lib/server/guestAuth';
import {requireManager} from '../../../lib/server/bookingManagement';
import {adminMutationError,readStatistics} from '../../../lib/server/adminCalendar';
async function handler(req,res) {
  if(!jsonOnly(req,res,'GET'))return;
  try {const session=await requireManager(req,res);if(!session)return;
    return res.status(200).json({statistics:await readStatistics(session.manager,req.query.month,req.query.staffId)});
  }catch(e){return adminMutationError(res,e)}
}

export default secureHandler(handler,{path:'/api/admin/statistics'});
