import styles from "../styles/TrustSection.module.css";

// Csak valódi, a szalontól ellenőrzött értékelések kerüljenek ide.
// Példa: { quote: "...", author: "Keresztnév", source: "Google" }
const REVIEWS = [];

const VALUES = [
  {
    index: "01",
    title: "Odafigyelés",
    description: "Először megértjük, mit szeretnél. A jó vágás itt kezdődik.",
  },
  {
    index: "02",
    title: "Precizitás",
    description: "Tiszta átmenetek, pontos formák. Semmi nem véletlen.",
  },
  {
    index: "03",
    title: "Karakter",
    description: "Nem egy sablon. Egy fazon, ami tényleg hozzád illik.",
  },
];

export default function TrustSection() {
  const hasReviews = REVIEWS.length > 0;

  return (
    <section id="velemenyek" className={styles.section} aria-labelledby="trust-title">
      <div className={styles.wrap}>
        <div className={styles.kicker}>
          <span>04 / {hasReviews ? "VENDÉGVÉLEMÉNYEK" : "AMIBEN HISZÜNK"}</span>
          <span>PRESZTÍZS BARBER — DEBRECEN</span>
        </div>

        <div className={styles.editorial}>
          <div className={styles.headline}>
            <span className={styles.smallLabel}>A RÉSZLETEK TESZIK AZ EGÉSZET.</span>
            <h2 id="trust-title">
              {hasReviews ? (
                <>A vendégeink<br /><em>mondták.</em></>
              ) : (
                <>Nem csak<br /><em>a végeredmény.</em></>
              )}
            </h2>
            <p className={styles.intro}>
              {hasReviews
                ? "Néhány szó azoktól, akik már ültek nálunk a székben."
                : "Az is számít, hogyan jutunk el odáig."}
            </p>
          </div>

          <div className={styles.entries}>
            {hasReviews
              ? REVIEWS.slice(0, 3).map((review, index) => (
                  <figure className={styles.entry} key={`${review.author}-${index}`}>
                    <span className={styles.number}>0{index + 1}</span>
                    <div className={styles.entryBody}>
                      <blockquote className={styles.reviewText}>“{review.quote}”</blockquote>
                      <figcaption className={styles.description}>
                        {review.author}{review.source ? ` · ${review.source}` : ""}
                      </figcaption>
                    </div>
                  </figure>
                ))
              : VALUES.map((value) => (
                  <div className={styles.entry} key={value.index}>
                    <span className={styles.number}>{value.index}</span>
                    <div className={styles.entryBody}>
                      <h3>{value.title}</h3>
                      <p className={styles.description}>{value.description}</p>
                    </div>
                  </div>
                ))}
          </div>
        </div>
        <div className={styles.signoff} aria-hidden="true">
          <span>PRECISION IS PERSONAL.</span>
          <span>EST. / PRESZTÍZS</span>
        </div>
      </div>
    </section>
  );
}
