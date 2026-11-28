const {csp}=require('./csp.config.cjs');
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep browser QA builds separate from a running local development server.
  distDir: process.env.DEMETERS_BUILD_DIR || (process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'),
  images: { formats: ['image/avif', 'image/webp'],maximumResponseBody:8_000_000,remotePatterns:[] },
  async redirects() {
    return [
      { source: '/ferfi-fodraszat-debrecen', destination: '/ferfi-hajvagas-debrecen', permanent: true },
      { source: '/en/mens-hairdresser-debrecen', destination: '/en/mens-haircut-debrecen', permanent: true },
    ];
  },
  async headers() {
    const common = [
      // Next dev injects scripts and opens HMR connections absent from production.
      ...(process.env.NODE_ENV==='production'?[{key:process.env.CSP_MODE==='enforce'?'Content-Security-Policy':'Content-Security-Policy-Report-Only',value:csp}]:[]),
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
      {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
      ...(process.env.NODE_ENV==='production'?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[]),
    ];
    return [
      {source:'/:path*',headers:common},
      {source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store, max-age=0'}]},
    ];
  },
};
module.exports = nextConfig;
