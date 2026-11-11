
import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import styles from "../styles/BarberStack.module.css";

const BARBERS = [
  {
    name: "Márk",
    role: "Senior Barber",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&q=85",
  },
  {
    name: "Dávid",
    role: "Barber",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900&q=85",
  },
  {
    name: "Bence",
    role: "Barber",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=900&q=85",
  },
  {
    name: "Ádám",
    role: "Barber",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=85",
  },
  {
    name: "Patrik",
    role: "Barber",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&q=85",
  },
];

function Card({ barber, index, position, reducedMotion }) {
  // A position 0 = első kártya középen,
  // 1 = második kártya középen stb.
  const relative = useTransform(position, (p) => index - p);

  const x = useTransform(relative, (r) => {
    const distance = Math.abs(r);
    const direction = Math.sign(r);
    return direction * (distance <= 1
      ? distance * 235
      : 235 + (distance - 1) * 155);
  });

  const rotateY = useTransform(
    relative,
    [-2, -1, 0, 1, 2],
    [52, 42, 0, -42, -52]
  );

  const scale = useTransform(relative, (r) =>
    Math.max(0.67, 1 - Math.abs(r) * 0.14)
  );

  const opacity = useTransform(relative, (r) =>
    Math.max(0.13, 1 - Math.abs(r) * 0.43)
  );

  const brightness = useTransform(relative, (r) =>
    Math.max(0.22, 1 - Math.abs(r) * 0.38)
  );

  const filter = useTransform(
    brightness,
    (b) => `grayscale(1) brightness(${b})`
  );

  const zIndex = useTransform(
    relative,
    (r) => 100 - Math.round(Math.abs(r) * 10)
  );

  return (
    <motion.article
      className={styles.card}
      style={{
        x: reducedMotion ? 0 : x,
        rotateY: reducedMotion ? 0 : rotateY,
        scale: reducedMotion ? 1 : scale,
        opacity: reducedMotion ? 1 : opacity,
        filter: reducedMotion ? "grayscale(1)" : filter,
        zIndex,
        backgroundImage: `linear-gradient(
          to top,
          rgba(0,0,0,.75),
          transparent 45%
        ), url("${barber.image}")`,
      }}
    >
      <div className={styles.cardContent}>
        <span>{barber.role}</span>
        <h3>{barber.name}</h3>
        <a href="/idopontfoglalas">
          IDŐPONTFOGLALÁS
        </a>
      </div>
    </motion.article>
  );
}

export default function BarberStack() {
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // A görgetés 0–1 tartományát
  // 0–4 kártyapozícióra alakítjuk.
  const rawPosition = useTransform(
    scrollYProgress,
    [0, 1],
    [0, BARBERS.length - 1]
  );

  const position = useSpring(rawPosition, {
    stiffness: 100,
    damping: 28,
    mass: 0.8,
  });

  const progressWidth = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", "100%"]
  );

  return (
    <section
      ref={sectionRef}
      id="csapat"
      className={styles.section}
    >
      <div className={styles.sticky}>


        <div className={styles.scene}>
          {BARBERS.map((barber, index) => (
            <Card
              key={barber.name}
              barber={barber}
              index={index}
              position={position}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>

        <div className={styles.bottom}>
          <span>ISMERD MEG A CSAPATOT</span>
        </div>

        <div className={styles.progressTrack}>
          <motion.div
            className={styles.progressFill}
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    </section>
  );
}
