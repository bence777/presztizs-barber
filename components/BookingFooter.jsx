import styles from "../styles/BookingFooter.module.css";

export default function BookingFooter() {
  return (
    <>
      <section id="foglalas" className={styles.cta} aria-labelledby="booking-heading">
        <div className={styles.backdrop} aria-hidden="true" />
        <div className={styles.wrap}>
          <div className={styles.topline}>
            <span>05 / IDŐPONTFOGLALÁS</span>
            <span>PRESZTÍZS BARBER</span>
          </div>
          <div className={styles.center}>
            <span className={styles.overTitle}>A KÖVETKEZŐ VÁGÁSOD</span>
            <h2 id="booking-heading">A szék<br /><em>rád vár.</em></h2>
            <div className={styles.actionRow}>
              <p className={styles.intro}>
                Válassz szolgáltatást, barbert és időpontot.
                <br />Ennyi az egész.
              </p>
              <a className={styles.button} href="/idopontfoglalas">
                IDŐPONTOT FOGLALOK
              </a>
            </div>
          </div>
          <div className={styles.bottomline}>
            <span>MINDEN VÁGÁSNAK KARAKTERE VAN.</span>
            <span>01 — 05 / PRESZTÍZS</span>
          </div>
        </div>
      </section>
      <footer className={styles.footer} id="kapcsolat">
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <a className={styles.brand} href="#teteje" aria-label="Presztízs Barber – az oldal tetejére">
              PRESZTÍZS <em>Barber</em>
            </a>
            <nav aria-label="Lábléc navigáció" className={styles.links}>
              <a href="#szolgaltatasok">Szolgáltatások</a>
              <a href="#csapat">A csapat</a>
              <a href="#szalon">A szalon</a>
              <a href="/idopontfoglalas">Foglalás</a>
            </nav>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} PRESZTÍZS BARBER</span>
            <span>MINDEN VÁGÁSNAK KARAKTERE VAN.</span>
            <a href="#teteje">VISSZA AZ ELEJÉRE</a>
          </div>
        </div>
      </footer>
    </>
  );
}
