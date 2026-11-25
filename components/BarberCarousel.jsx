import { useEffect, useRef, useState } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { barberBookingHref } from '../data/team.mjs';
import { useLanguage } from './LanguageProvider';
import styles from "../styles/BarberStack.module.css";

// Wrap positions so the composition stays balanced at either end of the team.
const wrap = (value, count) => ((value % count) + count) % count;
const relativeTo = (index, position, count) => wrap(index - position + count / 2, count) - count / 2;

function Card({ barber, index, count, position, layout, activeIndex, animating, onSelect, onChoose }) {
  const { t, language } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [barber.image]);
  const hasPortrait = barber.image && !imageFailed;
  const active = index === activeIndex;
  const inView = Math.abs(relativeTo(index, activeIndex, count)) <= layout.sides;
  const relative = useTransform(position, value => relativeTo(index, value, count));
  const x = useTransform(relative, value => {
    return Math.sign(value) * Math.min(Math.abs(value), layout.sides) * layout.firstOffset;
  });
  const rotateY = useTransform(relative, value => -Math.sign(value) * Math.min(Math.abs(value), 1) * layout.angle);
  const z = useTransform(relative, value => -Math.min(Math.abs(value), 1.5) * layout.depth);
  const y = useTransform(relative, value => Math.min(Math.abs(value), 1) * 10);
  const opacity = useTransform(relative, value => 1 - Math.min(Math.abs(value), 1) * .42);
  const scale = useTransform(relative, value => {
    const distance = Math.abs(value);
    const base = 1 - Math.min(distance, 2) * .08;
    const edgeProgress = Math.max(0, 1 - Math.max(0, distance - layout.sides) * 2);
    return base * edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
  });
  const filter = useTransform(relative, value => {
    const depth = Math.min(Math.abs(value), 1);
    return `brightness(${1 - depth * .04}) blur(${depth * .6}px)`;
  });
  const zIndex = useTransform(relative, value => 20 - Math.round(Math.abs(value) * 5));
  // Neighbours recede behind the selected card; only the front card stays sharp.
  const visibility = useTransform(relative, value => Math.abs(value) < layout.sides + .5 ? 'visible' : 'hidden');

  return (
    <motion.article
      className={`${styles.card} ${active ? styles.activeCard : ''}`}
      aria-hidden={!inView}
      aria-label={barber.name}
      style={{ x, y, z, rotateY, scale, opacity, filter, zIndex, visibility, width: layout.cardWidth, height: layout.cardHeight }}
    >
      {hasPortrait ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.portrait} src={barber.image} alt="" loading="lazy" draggable="false" onError={() => setImageFailed(true)} />
        <div className={styles.portraitShade} aria-hidden="true" />
      </> : <span className={styles.initials} aria-hidden="true">{barber.symbol || barber.name.split(" ").map(part => part[0]).join("")}</span>}
      {!active && <button className={styles.cardSelect} type="button" disabled={animating} tabIndex={inView && !animating ? 0 : -1} aria-label={`${t("VÁLASSZ FODRÁSZT")}: ${barber.name}`} onClick={() => onSelect(index)} />}
      <div className={styles.cardContent}>
        <span className={styles.role}>{t(barber.role || "Fodrász")}</span>
        <h3>{barber.name}</h3>
        {onChoose ? <button
          type="button" className={styles.cardAction}
          tabIndex={active && !animating ? 0 : -1} disabled={animating}
          onClick={() => { if (!active) onSelect(index); else onChoose(barber); }}
        >{language === 'hu' ? <>IDŐPONT<wbr />FOGLALÁS</> : t("IDŐPONTFOGLALÁS")}</button> : <a
          className={styles.cardAction}
          href={barberBookingHref(barber)}
          tabIndex={active && !animating ? 0 : -1}
          aria-disabled={animating || undefined}
          draggable="false"
          onClick={event => { if (animating) event.preventDefault(); else if (!active) { event.preventDefault(); onSelect(index); } }}
        >{language === 'hu' ? <>IDŐPONT<wbr />FOGLALÁS</> : t("IDŐPONTFOGLALÁS")}</a>}
      </div>
    </motion.article>
  );
}

export default function BarberCarousel({ barbers: BARBERS, initialBarberId, onChoose, heading, headingId }) {
  const { t, language } = useLanguage();
  const initialIndex = Math.max(0, BARBERS.findIndex(barber => barber.id === initialBarberId));
  const sceneRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const activeRef = useRef(initialIndex);
  const animationRef = useRef(null);
  const animatingRef = useRef(false);
  const pendingRef = useRef(null);
  const selectRef = useRef(null);
  const [animating, setAnimating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [dragging, setDragging] = useState(false);
  const [layout, setLayout] = useState({ cardWidth: 220, cardHeight: 335, firstOffset: 165, sides: 1, angle: 10, depth: 130 });
  const reducedMotion = useReducedMotion();
  const position = useMotionValue(initialIndex);
  useEffect(() => () => animationRef.current?.stop(), []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      const { width, height } = scene.getBoundingClientRect();
      if (!width || !height) return;
      const mobile = width < 600;
      const sides = 1;
      const preferredWidth = mobile ? Math.min(240, width * .68) : Math.min(290, (width - 112) / 2);
      const cardWidth = Math.min(preferredWidth, Math.max(100, height - 32) / 1.52);
      setLayout({
        cardWidth, cardHeight: cardWidth * 1.52,
        firstOffset: cardWidth * (mobile ? .76 : .7),
        sides, angle: mobile ? 9 : 14, depth: mobile ? 110 : 160,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  function finishSelection(index, target) {
    position.set(target);
    activeRef.current = index;
    setActiveIndex(index);
    animatingRef.current = false;
    pendingRef.current = null;
    setAnimating(false);
  }

  function selectBarber(next, returning = false) {
    // One deliberate action produces one complete transition. Repeated clicks
    // and held keys cannot build up velocity or queue a series of selections.
    if (!BARBERS.length || animatingRef.current || dragRef.current?.dragging) return;
    const index = wrap(next, BARBERS.length);
    const current = position.get();
    const target = current + relativeTo(index, current, BARBERS.length);
    if (Math.abs(target - current) < .0001) return;
    if (reducedMotion) { finishSelection(index, target); return; }
    animatingRef.current = true;
    pendingRef.current = { index, target };
    setAnimating(true);
    animationRef.current = animate(position, target, {
      type: 'tween',
      duration: returning ? .45 : 1.15 + Math.max(0, Math.abs(target - current) - 1) * .2,
      ease: [.45, 0, .2, 1],
      onComplete: () => finishSelection(index, target),
    });
  }
  selectRef.current = selectBarber;

  useEffect(() => {
    const scene = sceneRef.current;
    let total = 0, lastInput = 0, consumed = false;
    function horizontalWheel(event) {
      if (event.ctrlKey) return;
      const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      const dy = event.shiftKey ? 0 : event.deltaY;
      if (Math.abs(dx) <= Math.abs(dy) * 1.2 || Math.abs(dx) < 1) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastInput > 240) { total = 0; consumed = false; }
      lastInput = now;
      if (animatingRef.current || dragRef.current?.dragging || consumed) return;
      const pixels = dx * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scene.clientWidth : 1);
      if (Math.sign(total) !== Math.sign(pixels)) total = 0;
      total += pixels;
      if (Math.abs(total) >= 55) {
        consumed = true;
        selectRef.current(activeRef.current + Math.sign(total));
      }
    }
    scene.addEventListener('wheel', horizontalWheel, { passive: false });
    return () => scene.removeEventListener('wheel', horizontalWheel);
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    animationRef.current?.stop();
    const pending = pendingRef.current;
    if (pending) finishSelection(pending.index, pending.target);
  }, [reducedMotion]);

  function pointerDown(event) {
    suppressClickRef.current = false;
    if (!event.isPrimary || event.button !== 0 || animatingRef.current || event.target.closest('[data-carousel-control]')) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: position.get(), index: activeRef.current, dragging: false, vertical: false };
  }

  function pointerMove(event) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.id || drag.vertical) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.dragging && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      drag.vertical = true;
      return;
    }
    if (!drag.dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      drag.dragging = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.dragging) {
      event.preventDefault();
      // A small, bounded preview follows the hand directly, without spring lag.
      if (!reducedMotion) position.set(drag.origin - Math.max(-.48, Math.min(.48, dx / layout.firstOffset * .65)));
    }
  }

  function pointerEnd(event, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.id) return;
    dragRef.current = null;
    setDragging(false);
    if (!drag.dragging) return;
    suppressClickRef.current = true;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    const threshold = Math.max(36, Math.min(64, layout.cardWidth * .18));
    const deliberate = !cancelled && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.2;
    selectBarber(drag.index + (deliberate ? -Math.sign(dx) : 0), !deliberate);
  }

  function keyboardNavigate(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const next = { ArrowLeft: activeIndex - 1, ArrowRight: activeIndex + 1, Home: 0, End: BARBERS.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectBarber(next);
  }

  return (
    <div className={styles.sticky} onKeyDown={keyboardNavigate} data-barber-carousel>
        {heading && <div className={styles.top}>
          <h2 id={headingId}>{heading}</h2>
          <span>{t("VÁLASSZ FODRÁSZT")}</span>
        </div>}
        <div
          ref={sceneRef}
          className={`${styles.scene} ${dragging ? styles.dragging : ''}`}
          style={{ '--card-width': `${layout.cardWidth}px` }}
          role="region"
          aria-roledescription="carousel"
          aria-busy={animating}
          aria-label={t("A csapat")}
          tabIndex={0}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={event => pointerEnd(event, true)}
          onLostPointerCapture={event => { if (event.target === event.currentTarget) pointerEnd(event, true); }}
          onClickCapture={event => { if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); suppressClickRef.current = false; } }}
          onDragStart={event => event.preventDefault()}
        >
          {BARBERS.map((barber, index) => <Card key={barber.name} barber={barber} index={index} count={BARBERS.length} position={position} layout={layout} activeIndex={activeIndex} animating={animating} onChoose={onChoose} onSelect={next => { selectBarber(next); sceneRef.current?.focus({ preventScroll: true }); }} />)}
          <button type="button" data-carousel-control className={`${styles.arrow} ${styles.previousArrow}`} disabled={animating} aria-label={language === 'en' ? 'Previous barber' : 'Előző fodrász'} onClick={() => selectBarber(activeIndex - 1)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M19 12H5m6 6-6-6 6-6" /></svg>
          </button>
          <button type="button" data-carousel-control className={`${styles.arrow} ${styles.nextArrow}`} disabled={animating} aria-label={language === 'en' ? 'Next barber' : 'Következő fodrász'} onClick={() => selectBarber(activeIndex + 1)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </button>
        </div>
        <div className={styles.bottom}>
          <span className={styles.caption}>{language === 'en' ? 'Swipe or use the arrows to choose.' : 'Húzással vagy a nyilakkal választhatsz.'}</span>
          <span className={styles.counter} aria-live="polite" aria-atomic="true">{String(activeIndex + 1).padStart(2, '0')} <span>/ {String(BARBERS.length).padStart(2, '0')}</span></span>
        </div>
    </div>
  );
}
