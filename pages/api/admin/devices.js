import { deviceApiHandler } from '../../../lib/server/deviceApi';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default function handler(req,res){return deviceApiHandler(req,res,'admin');}
