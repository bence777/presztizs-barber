import styles from "../styles/SalonStory.module.css";

/**
 * The main photo is an editorial stock placeholder, NOT the salon's actual interior.
 * Replace the URL with /images/actual-salon.jpg when the real photos arrive.
 */
const SALON_IMAGE =
  "https://images.unsplash.com/photo-1702865272115-5afdbae975af?w=1400&q=82&fit=crop";

export default function SalonStory() {
  return (
    <section id="szalon" className={styles.section} aria-labelledby="salon-title">
      <div className={styles.wrap}>
        <div className={styles.overline}>
          <span>03 / A SZALON</span>
          <span>EGY HELY. SAJÁT KARAKTER.</span>
        </div>

        <div className={styles.layout}>
          <figure className={styles.heroPhoto}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SALON_IMAGE}
              alt="Hangulatkép egy sötét tónusú barbershop belső teréről"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/images/salon-chair.webp";
              }}
            />
            <figcaption className={styles.photoCaption}>
              <span>THE SPACE</span>
              <span>01 / 02</span>
            </figcaption>
          </figure>

          <div className={styles.content}>
            <span className={styles.smallLabel}>NEM CSAK EGY ÚJABB IDŐPONT.</span>
            <h2 id="salon-title">
              A jó stílusnak
              <em> helye van.</em>
            </h2>
            <p className={styles.lead}>
              Egy vágás nem attól lesz emlékezetes, hogy hangos. Hanem attól,
              hogy minden részlete a helyén van.
            </p>
            <p className={styles.copy}>
              A Presztízsben a figyelem, a precizitás és a karakteres végeredmény
              ugyanannak a történetnek a része.
            </p>

            <div className={styles.detailRow}>
              <div className={styles.detailPhoto}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/barber-detail.webp"
                  alt="Közeli részlet egy hajvágásról"
                  loading="lazy"
                />
              </div>
              <div className={styles.detailCopy}>
                <span>01 / A RÉSZLETEK</span>
                <strong>Nem véletlenül ilyen.</strong>
                <span>FORMA · RITMUS · PRECIZITÁS</span>
              </div>
            </div>
          </div>
        </div>
        <p className={styles.disclaimer}>
          A bemutatófotó hangulatkép; a szalon saját képeire cserélendő.
        </p>
      </div>
    </section>
  );
}
