import Image from 'next/image';
// Only local assets use the server image optimizer. Remote staff-owned photos load
// in the browser so arbitrary profile URLs cannot make the server fetch private hosts.
export default function PublicImage({ src, alt, sizes = '(max-width: 700px) 100vw, 50vw', className, priority = false }) {
  if (!src) return null;
  if (src.startsWith('/images/')) return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />;
  // eslint-disable-next-line @next/next/no-img-element -- External URLs deliberately bypass server fetching.
  return <img src={src} alt={alt} width="800" height="1000" loading={priority ? 'eager' : 'lazy'} decoding="async" className={className} />;
}
