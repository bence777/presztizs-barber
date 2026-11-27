import { useEffect, useRef, useState } from "react";
import Link from 'next/link';
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import useCarouselHaptics from '../lib/client/useCarouselHaptics';
import { gestureAxis } from '../lib/client/carouselGesture.mjs';
import { releaseVelocity, momentumTarget } from '../lib/client/carouselMomentum.mjs';
import { trackEvent } from '../lib/client/analytics.mjs';
import { barberBookingHref } from '../data/team.mjs';
import { useLanguage } from './LanguageProvider';
import styles from "../styles/BarberStack.module.css";

// Wrap positions so the composition stays balanced at either end of the team.
const wrap = (value, count) => ((value % count) + count) % count;
const relativeTo = (index, position, count) => wrap(index - position + count / 2, count) - count / 2;

function Card({ barber, index, count, position, layout, activeIndex, animating, onSelect, onChoose, onBook }) {
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
      {/* Keep the touch target mounted while the active card changes mid-swipe. */}
      <button hidden={active} className={styles.cardSelect} type="button" aria-disabled={animating || undefined} tabIndex={!active && inView && !animating ? 0 : -1} aria-label={`${t("VÁLASSZ FODRÁSZT")}: ${barber.name}`} onClick={() => { if (!animating) onSelect(index); }} />
      <div className={styles.cardContent}>
        <div className={styles.cardHeading}>
          <span className={styles.role}>{t(barber.role || "Fodrász")}</span>
          <h3>{barber.name}</h3>
        </div>
        <div className={styles.avatar} aria-hidden="true">
          {hasPortrait ?
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className={styles.portrait} src={barber.image} alt="" loading="lazy" draggable="false" onError={() => setImageFailed(true)} />
            : <span className={styles.initials}>{barber.symbol || barber.name.split(" ").map(part => part[0]).join("")}</span>}
        </div>
        <div className={styles.cardFooter}>
          {barber.publicPhone&&<a data-carousel-control className={styles.publicPhone} href={`tel:${barber.publicPhone.replace(/[^+\d]/g,'')}`} tabIndex={active?0:-1} onClick={event=>{event.stopPropagation();trackEvent('phone_clicked',{placement:'barber_carousel',barber_id:barber.id});}}>{barber.publicPhone}</a>}
          {onChoose ? <button
            type="button" className={styles.cardAction}
            tabIndex={active && !animating ? 0 : -1} aria-disabled={animating || undefined}
            onClick={() => { if (animating) return; if (!active) onSelect(index); else onChoose(barber); }}
          >{language === 'hu' ? <>IDŐPONT<wbr />FOGLALÁS</> : t("IDŐPONTFOGLALÁS")}</button> : <Link
            className={styles.cardAction}
            href={barberBookingHref(barber, language)}
            shallow
            tabIndex={active && !animating ? 0 : -1}
            aria-disabled={animating || undefined}
            draggable="false"
            onClick={event => { if (animating) event.preventDefault(); else if (!active) { event.preventDefault(); onSelect(index); } else if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onBook?.(barber); }}
          >{language === 'hu' ? <>IDŐPONT<wbr />FOGLALÁS</> : t("IDŐPONTFOGLALÁS")}</Link>}
        </div>
      </div>
    </motion.article>
  );
}

export default function BarberCarousel({ barbers: BARBERS, initialBarberId, onChoose, onBook, heading, headingId, compact = false }) {
  const { t, language } = useLanguage();
  const initialIndex = Math.max(0, BARBERS.findIndex(barber => barber.id === initialBarberId));
  const sceneRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const activeRef = useRef(initialIndex);
  const animationRef = useRef(null);
  const animatingRef = useRef(false);
  const pendingRef = useRef(null);
  const layoutRef = useRef(null);
  const wheelTimerRef = useRef(null);
  const settleRef = useRef(null);
  const touchHandlersRef = useRef(null);
  const [animating, setAnimating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [dragging, setDragging] = useState(false);
  const [layout, setLayout] = useState({ cardWidth: 220, cardHeight: 335, firstOffset: 165, sides: 1, angle: 10, depth: 130 });
  layoutRef.current = layout;
  const reducedMotion = useReducedMotion();
  const position = useMotionValue(initialIndex);
  const hapticPositionRef = useRef(initialIndex);
  const haptics = useCarouselHaptics();
  const hapticController = haptics.controller;
  useEffect(() => () => { animationRef.current?.stop(); clearTimeout(wheelTimerRef.current); }, []);
  useEffect(() => position.on('change', value => {
    if (!BARBERS.length) return;
    const index = wrap(Math.round(value), BARBERS.length);
    if (index !== activeRef.current) {
      activeRef.current = index; setActiveIndex(index);
    }
    const previous = hapticPositionRef.current;
    hapticPositionRef.current = value;
    // Tick at the actual centre crossing, not halfway through a card change.
    const landing = pendingRef.current && Math.abs(value - pendingRef.current.target) < .008;
    if (!landing && (value > previous ? Math.floor(value) > Math.floor(previous) : Math.ceil(value) < Math.ceil(previous))) {
      hapticController.current.tick(position.getVelocity());
    }
  }), [position, BARBERS.length, hapticController]);

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
    hapticController.current.finish(index);
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
    if (!BARBERS.length || dragRef.current?.dragging) return;
    animationRef.current?.stop();
    const index = wrap(next, BARBERS.length);
    const current = position.get();
    const target = current + relativeTo(index, current, BARBERS.length);
    if (Math.abs(target - current) < .0001) { finishSelection(index, target); return; }
    if (reducedMotion) { finishSelection(index, target); return; }
    animatingRef.current = true;
    pendingRef.current = { index, target };
    setAnimating(true);
    animationRef.current = animate(position, target, {
      type: 'tween',
      duration: returning ? .22 : .42 + Math.max(0, Math.abs(target - current) - 1) * .08,
      ease: [.45, 0, .2, 1],
      onComplete: () => finishSelection(index, target),
    });
  }

  function settleWithMomentum(velocity = 0) {
    if (!BARBERS.length) return;
    animationRef.current?.stop();
    const current = position.get();
    const speed = reducedMotion ? 0 : velocity;
    const target = momentumTarget(current, speed);
    const index = wrap(target, BARBERS.length);
    if (reducedMotion || Math.abs(target - current) < .002) { finishSelection(index, target); return; }
    animatingRef.current = true;
    pendingRef.current = { index, target };
    setAnimating(true);
    animationRef.current = animate(position, target, {
      type: 'inertia', velocity: speed, power: .34, timeConstant: 270,
      restDelta: .008, modifyTarget: () => target,
      onComplete: () => finishSelection(index, target),
    });
  }
  settleRef.current = settleWithMomentum;


  useEffect(() => {
    const scene = sceneRef.current;
    let axis = null, lastInput = -Infinity, totalX = 0, totalY = 0;
    function horizontalWheel(event) {
      if (event.ctrlKey || dragRef.current?.dragging || BARBERS.length < 2) return;
      const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      const dy = event.shiftKey ? 0 : event.deltaY;
      const now = performance.now();
      if (now - lastInput > 220) { axis = null; totalX = 0; totalY = 0; }
      lastInput = now;
      totalX += dx; totalY += dy;
      axis = gestureAxis(totalX, totalY, axis, 1);
      if (axis !== 'x') return;
      event.preventDefault();
      hapticController.current.cancel();
      animationRef.current?.stop();
      animatingRef.current = false;
      pendingRef.current = null;
      setAnimating(false);
      const pixels = dx * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scene.clientWidth : 1);
      position.set(position.get() + pixels / layoutRef.current.firstOffset);
      clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => settleRef.current(0), 160);
    }
    scene.addEventListener('wheel', horizontalWheel, { passive: false });
    return () => { scene.removeEventListener('wheel', horizontalWheel); clearTimeout(wheelTimerRef.current); };
  }, [position, BARBERS.length, hapticController]);

  useEffect(() => {
    if (!reducedMotion) return;
    animationRef.current?.stop();
    const pending = pendingRef.current;
    if (pending) finishSelection(pending.index, pending.target);
  }, [reducedMotion]);

  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('[data-carousel-control]')) return;
    hapticController.current.cancel();
    suppressClickRef.current = animatingRef.current;
    clearTimeout(wheelTimerRef.current);
    animationRef.current?.stop();
    animatingRef.current = false;
    pendingRef.current = null;
    setAnimating(false);
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: position.get(), samples: [{ x: event.clientX, time: performance.now() }], dragging: false, vertical: false };
  }

  function pointerMove(event) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.id || drag.vertical) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.axis = gestureAxis(dx, dy, drag.axis);
    if (drag.axis === 'y') { drag.vertical = true; return; }
    if (!drag.dragging && drag.axis === 'x') {
      drag.dragging = true;
      if (event.pointerType === 'touch') hapticController.current.begin(activeRef.current);
      setDragging(true);
      if (event.pointerType !== 'touch') event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.dragging) {
      event.preventDefault();
      const now = performance.now();
      drag.samples.push({ x: event.clientX, time: now });
      drag.samples = drag.samples.filter(sample => now - sample.time <= 120);
      // Follow the hand one-to-one; inertia takes over only after release.
      position.set(drag.origin - dx / layout.firstOffset);
    }
  }

  function pointerEnd(event, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.id) return;
    dragRef.current = null;
    setDragging(false);
    if (!drag.dragging) return;
    suppressClickRef.current = true;
    // Cancellation/lost capture must settle from the current visual position,
    // never from where the gesture started.
    if (cancelled) hapticController.current.cancel();
    settleWithMomentum(cancelled ? 0 : releaseVelocity(drag.samples, performance.now(), layout.firstOffset));
  }

  touchHandlersRef.current = { down: pointerDown, move: pointerMove, end: pointerEnd };

  useEffect(() => {
    const scene = sceneRef.current;
    let touchId = null, lastTouch = null;
    const adapt = (event, touch) => ({
      pointerId: touch.identifier, pointerType: 'touch', isPrimary: true, button: 0,
      clientX: touch.clientX, clientY: touch.clientY, target: event.target, currentTarget: scene,
      preventDefault: () => { if (event.cancelable) event.preventDefault(); },
    });
    const cancel = event => {
      if (lastTouch) touchHandlersRef.current.end(adapt(event, lastTouch), true);
      touchId = null; lastTouch = null;
    };
    const start = event => {
      if (event.touches.length !== 1) { cancel(event); return; }
      lastTouch = event.touches[0]; touchId = lastTouch.identifier;
      touchHandlersRef.current.down(adapt(event, lastTouch));
    };
    const move = event => {
      if (touchId === null) return;
      if (event.touches.length !== 1) { cancel(event); return; }
      const touch = Array.from(event.touches).find(item => item.identifier === touchId);
      if (!touch) return;
      lastTouch = touch;
      touchHandlersRef.current.move(adapt(event, touch));
    };
    const end = event => {
      if (touchId === null) return;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === touchId);
      if (!touch) return;
      touchHandlersRef.current.end(adapt(event, touch));
      touchId = null; lastTouch = null;
    };
    // A non-passive native listener owns a diagonal sideways gesture before
    // Safari/Chrome can turn it into page panning and cancel Pointer Events.
    scene.addEventListener('touchstart', start, { passive: true });
    scene.addEventListener('touchmove', move, { passive: false });
    scene.addEventListener('touchend', end, { passive: true });
    scene.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      scene.removeEventListener('touchstart', start); scene.removeEventListener('touchmove', move);
      scene.removeEventListener('touchend', end); scene.removeEventListener('touchcancel', cancel);
    };
  }, []);

  function keyboardNavigate(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const next = { ArrowLeft: activeIndex - 1, ArrowRight: activeIndex + 1, Home: 0, End: BARBERS.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectBarber(next);
  }

  return (
    <div className={`${styles.sticky} ${compact ? styles.compact : ''}`} onKeyDown={keyboardNavigate} data-barber-carousel>
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
          onPointerDown={event => { if (event.pointerType !== 'touch') pointerDown(event); }}
          onPointerMove={event => { if (event.pointerType !== 'touch') pointerMove(event); }}
          onPointerUp={event => { if (event.pointerType !== 'touch') pointerEnd(event); }}
          onPointerCancel={event => { if (event.pointerType !== 'touch') pointerEnd(event, true); }}
          onLostPointerCapture={event => { if (event.pointerType !== 'touch' && event.target === event.currentTarget) pointerEnd(event, true); }}
          onClickCapture={event => { if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); suppressClickRef.current = false; } }}
          onDragStart={event => event.preventDefault()}
        >
          {BARBERS.map((barber, index) => <Card key={barber.name} barber={barber} index={index} count={BARBERS.length} position={position} layout={layout} activeIndex={activeIndex} animating={animating} onChoose={onChoose} onBook={onBook} onSelect={next => { selectBarber(next); sceneRef.current?.focus({ preventScroll: true }); }} />)}
          <button type="button" data-carousel-control className={`${styles.arrow} ${styles.previousArrow}`} disabled={animating} aria-label={language === 'en' ? 'Previous barber' : 'Előző fodrász'} onClick={() => selectBarber(activeIndex - 1)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M19 12H5m6 6-6-6 6-6" /></svg>
          </button>
          <button type="button" data-carousel-control className={`${styles.arrow} ${styles.nextArrow}`} disabled={animating} aria-label={language === 'en' ? 'Next barber' : 'Következő fodrász'} onClick={() => selectBarber(activeIndex + 1)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </button>
        </div>
        <div className={styles.bottom}>
          <span className={styles.caption}>{language === 'en' ? 'Drag or scroll sideways to choose.' : 'Húzd vagy görgesd oldalra a választáshoz.'}</span>
          <div className={styles.selectionControls}><div className={styles.dots} role="group" aria-label={t("Fodrász kiválasztása")}>{BARBERS.map((barber,index)=><button data-carousel-control key={barber.id} type="button" aria-label={barber.name} aria-pressed={index===activeIndex} disabled={animating} onClick={()=>selectBarber(index)}><span/></button>)}</div>
          {haptics.available && <button type="button" data-carousel-control className={styles.hapticsButton} aria-pressed={haptics.enabled} aria-label={language === 'en' ? haptics.enabled ? 'Turn haptics off' : 'Turn haptics on' : haptics.enabled ? 'Rezgés kikapcsolása' : 'Rezgés bekapcsolása'} onClick={haptics.toggle}>{language === 'en' ? 'Haptics' : 'Rezgés'}</button>}</div>
        </div>
    </div>
  );
}
