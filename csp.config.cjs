// Pages Router uses external runtime scripts; JSON-LD and __NEXT_DATA__ are inert
// data blocks. No blanket unsafe-inline script permission is required.
const csp=[
 "default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
 "script-src 'self' https://challenges.cloudflare.com",
 "style-src 'self' 'unsafe-inline'", // React/Framer Motion apply inline styles.
 "img-src 'self' data: https:",
 "media-src 'self'", "font-src 'self' data:",
 "connect-src 'self' https://challenges.cloudflare.com", "frame-src https://challenges.cloudflare.com https://www.google.com",
 "report-uri /api/csp-report",
].join('; ');
module.exports={csp};
