import { useEffect, useState } from "react";
import { formatPrice } from "../data/bookingConfig";
import styles from "../styles/Services.module.css";

export default function Services() {
  const [services, setServices] = useState([]);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    fetch("/api/booking/config", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Nem elérhető");
        return response.json();
      })
      .then(data => { if (active) { setServices((data.services || []).slice(0, 4));setState("ready"); } })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);
  return (
    <section className={styles.section} id="szolgaltatasok">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h2>A megszokott.<br /><em>Más szinten.</em></h2>
          </div>
        </div>
        <div className={styles.grid}>
          {services.map((service, index) => (
            <article className={styles.card} key={service.id}>
              <span className={styles.number}>0{index + 1}</span>
              <div className={styles.content}>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>
              <div className={styles.meta}>
                <strong>{formatPrice(service.price)}</strong>
                <span>{service.duration} perc</span>
              </div>
            </article>
          ))}
        </div>
        {state !== "ready" || services.length === 0 ? (
          <p className={styles.footnote} aria-live="polite">
            {state === "loading" ? "Szolgáltatások betöltése…" : state === "error" ? "A szolgáltatásokat most nem sikerült betölteni." : "A szolgáltatások hamarosan megjelennek."}
          </p>
        ) : <p className={styles.footnote}>Minden részlet számít.</p>}
      </div>
    </section>
  );
}
