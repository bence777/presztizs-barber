import styles from '../styles/Editorial.module.css';
export default function Faq({ items, title }) {
  if (!items?.length) return null;
  return <section className={styles.faq} aria-labelledby="faq-title">
    <div><span className={styles.eyebrow}>FAQ / DEMETERS</span><h2 id="faq-title">{title}</h2></div>
    <div>{items.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div>
  </section>;
}
