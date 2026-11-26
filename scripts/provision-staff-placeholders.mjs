// Preview by default. Applies only with --apply; never sends mail or sets passwords.
// node --experimental-default-type=module --env-file=.env.local scripts/provision-staff-placeholders.mjs --apply
import {provisionStaffPlaceholders} from '../lib/server/staffAccounts.js';
const apply=process.argv.includes('--apply');
const accounts=await provisionStaffPlaceholders({role:'owner'},{apply});
console.log(JSON.stringify({mode:apply?'apply':'preview',accounts},null,2));
