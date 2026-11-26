// Reserved, non-deliverable addresses. Never treat these as verified staff identities.
const PLACEHOLDER_DOMAIN='pending.demeters.invalid';
export function isPlaceholderEmail(email){return typeof email==='string'&&email.toLowerCase().endsWith('@'+PLACEHOLDER_DOMAIN);}
export function placeholderStaffEmail(staffId){
 if(!/^[a-z0-9][a-z0-9-]{1,60}$/.test(staffId||''))throw new Error('invalid_placeholder_staff');
 return `${staffId}@${PLACEHOLDER_DOMAIN}`;
}
