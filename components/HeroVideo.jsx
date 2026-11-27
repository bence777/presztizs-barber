import { useEffect, useRef, useState } from 'react';
export default function HeroVideo() {
  const video = useRef(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPlay(!motion.matches && !navigator.connection?.saveData);
    update(); motion.addEventListener('change', update);
    return () => motion.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (play) void video.current?.play().catch(() => {}); else video.current?.pause(); }, [play]);
  return <div className="heroVideoWrap" aria-hidden="true"><video ref={video} className="heroVideo" autoPlay={play} muted loop playsInline preload="none" poster="/hero-poster.jpg">{play && <source src="/hero-loop.mp4" type="video/mp4" />}</video></div>;
}
