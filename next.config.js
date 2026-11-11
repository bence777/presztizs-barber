/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const common = [
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
