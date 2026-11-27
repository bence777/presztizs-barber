import Image from 'next/image';
import { useLanguage } from './LanguageProvider';
import styles from "../styles/SalonStory.module.css";

/**
 * The main photo is an editorial stock placeholder, NOT the salon's actual interior.
 * Replace the URL with /images/actual-salon.jpg when the real photos arrive.
 */
const SALON_IMAGE =
  "https://images.unsplash.com/photo-1702865272115-5afdbae975af?w=1400&q=82&fit=crop";

export default function SalonStory() {
  const { t } = useLanguage();
  return (
    <section id="szalon" className={styles.section} aria-labelledby="salon-title">
      <div className={styles.wrap}>
        <div className={styles.overline}>
          <span>{t("A SZALON")}</span>
          <span>DEMETERS / DEBRECEN</span>
        </div>

        <div className={styles.layout}>
          <figure className={styles.heroPhoto}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SALON_IMAGE}
              alt={t("Hangulatkép egy sötét tónusú barbershop belső teréről")}
              loading="lazy"
              width="1400"
              height="1700"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/images/salon-chair.webp";
              }}
            />
            <figcaption className={styles.photoCaption}>
              <span>{t("HANGULATKÉP")}</span>
              <span>01 / 02</span>
            </figcaption>
          </figure>

          <div className={styles.content}>
            <span className={styles.smallLabel}>{t("DEMETER TAMÁS / ALAPÍTÓ")}</span>
            <h2 id="salon-title">{t("Egy saját hely.")}<em>{" "}{t("Közös szemlélet.")}</em>
            </h2>
            <p className={styles.lead}>{t("Demeter Tamás vagyok, a DEMETERS alapítója. A szalont azért hoztam létre, hogy legyen egy hely, ahol a hajvágás mellett a vendégre is jut idő és figyelem.")}</p>
            <p className={styles.copy}>{t("Olyan csapattal dolgozom, amelynek ugyanúgy fontos a precíz munka és a személyes odafigyelés. Ismerd meg a fodrászainkat, válaszd ki, kihez szeretnél érkezni, és találkozzunk a szalonban.")}</p>

            <div className={styles.detailRow}>
              <div className={styles.detailPhoto}>
                <Image src="/images/demetertamas.webp" alt="Demeter Tamás" width={400} height={500} sizes="(max-width: 700px) 28vw, 180px" />
              </div>
              <div className={styles.detailCopy}>
                <span>DEMETER TAMÁS</span>
                <strong>{t("A DEMETERS alapítója")}</strong>
                <span>DEBRECEN</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
