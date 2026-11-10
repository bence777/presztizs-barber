
import styles from "../styles/Services.module.css";

const services = [
  {
    name: "Férfi hajvágás",
    description: "Precíz vágás, személyre szabott forma és stílus.",
    price: "5 500 Ft",
    duration: "45 perc",
  },
  {
    name: "Skin fade",
    description: "Tökéletes átmenetek, aprólékos kidolgozás.",
    price: "6 000 Ft",
    duration: "45 perc",
  },
  {
    name: "Haj és szakáll",
    description: "Teljes megjelenés, az utolsó részletig.",
    price: "8 000 Ft",
    duration: "60 perc",
  },
  {
    name: "Szakálligazítás",
    description: "Határozott kontúrok és gondos formázás.",
    price: "3 500 Ft",
    duration: "30 perc",
  },
];

export default function Services() {
  return (
    <section className={styles.section} id="szolgaltatasok">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>


            <h2>
              A megszokott.
              <br />
              <em>Más szinten.</em>
            </h2>
          </div>


        </div>

        <div className={styles.grid}>
          {services.map((service, index) => (
            <article className={styles.card} key={service.name}>
              <span className={styles.number}>
                0{index + 1}
              </span>

              <div className={styles.content}>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>

              <div className={styles.meta}>
                <strong>{service.price}</strong>
                <span>{service.duration}</span>
              </div>
            </article>
          ))}
        </div>

        <p className={styles.footnote}>
          Minden részlet számít.
        </p>
      </div>
    </section>
  );
}
