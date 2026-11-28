import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
// Scan every non-ignored tracked/untracked text file, including generated docs.
// Logs show only filename and detector name, never the matching credential.
const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[
 ['Supabase secret',/sb_secret_[A-Za-z0-9_-]{32,}/],
 ['Resend secret',/\bre_[A-Za-z0-9]{32,}/],
 ['GitHub token',/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/],
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['service-role JWT',/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{30,}/],
 ['AWS access key',/\bAKIA[A-Z0-9]{16}\b/],
];
let failed=false,count=0;
for(const file of files){if(file==='scripts/scan-secrets.mjs')continue;let bytes;try{bytes=readFileSync(file)}catch{continue}if(bytes.includes(0)||bytes.length>4_000_000)continue;count++;
 const text=bytes.toString('utf8');for(const [label,pattern] of patterns)if(pattern.test(text)){console.error(`${file}: ${label}`);failed=true;}}
const history=execFileSync('git',['log','--all','--format=','--patch','--no-ext-diff'],{encoding:'utf8',maxBuffer:64*1024*1024});
for(const [label,pattern] of patterns)if(pattern.test(history)){console.error(`Git history: ${label} detected (value redacted)`);failed=true;}
if(failed)process.exitCode=1;else console.log(`PASS credential patterns scanned in ${count} text files and local Git history`);
