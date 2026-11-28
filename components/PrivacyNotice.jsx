import Link from 'next/link';
import PublicLayout from './PublicLayout';
import Seo from './Seo';
import {route} from '../data/site.mjs';
import {PRIVACY,PRIVACY_COPY,privacyPublishable} from '../data/privacy.mjs';
import editorial from '../styles/Editorial.module.css';
import styles from '../styles/PrivacyNotice.module.css';

export default function PrivacyNotice({language='hu'}) {
  const c=PRIVACY_COPY[language],approved=privacyPublishable(),en=language==='en';
  return <PublicLayout language={language}>
    <Seo title={`${c.title} | DEMETERS`} description={c.description} path={route('privacy',language)} language={language} noindex={!approved} alternates={{'hu-HU':route('privacy','hu'),en:route('privacy','en'),'x-default':route('privacy','hu')}} />
    <article className={`${editorial.pageWrap} ${styles.notice}`}>
      <nav className={editorial.breadcrumb} aria-label={en?'Breadcrumb':'Morzsanavigáció'}><Link href={route('home',language)}>{en?'Home':'Főoldal'}</Link><span aria-hidden="true"> / </span><span aria-current="page">{c.title}</span></nav>
      <header className={styles.heading}><span className={editorial.eyebrow}>DEMETERS / {en?'PRIVACY':'ADATVÉDELEM'}</span><h1>{c.title}</h1><p>{c.description}</p><p className={styles.version}>{c.date}: <time dateTime={PRIVACY.version}>{PRIVACY.version}</time> · {c.effective}: {PRIVACY.effectiveDate||c.pending}</p>
        {!approved&&<p className={styles.draft} role="note">{c.draft}</p>}
        <button type="button" className={editorial.textLink} onClick={()=>window.print()}>{c.print}</button>
      </header>
      <nav className={styles.contents} aria-label={c.contents}><h2>{c.contents}</h2><ol><li><a href="#adatkezelo">{c.controllerTitle}</a></li>{c.sections.map(section=><li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav>
      <section id="adatkezelo" className={styles.section}><h2>{c.controllerTitle}</h2><p>{c.controllerIntro}</p><p>{c.controllerRole}</p>
        <h3>{c.directoryTitle}</h3><div className={styles.tableWrap} tabIndex={0} role="region" aria-label={c.directoryTitle}><table><thead><tr>{c.directoryHeadings.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{PRIVACY.barbers.map(b=><tr key={b.staffId}><th scope="row">{b.displayName}</th>{['name','address','email'].map(key=><td key={key}>{b[key]||c.pending}</td>)}</tr>)}</tbody></table></div>
        <h3>{c.operatorTitle}</h3><dl className={styles.controller}>{Object.entries(c.controllerLabels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{PRIVACY.controller[key]||c.pending}</dd></div>)}</dl>
      </section>
      {c.sections.map(section=><section id={section.id} key={section.id} className={styles.section}><h2>{section.title}</h2>{section.paragraphs?.map(text=><p key={text}>{text}</p>)}
        {section.table&&<div className={styles.tableWrap} tabIndex={0} role="region" aria-label={section.title}><table><thead><tr>{section.table.headings.map(heading=><th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{section.table.rows.map(row=><tr key={row[0]}>{row.map((cell,index)=>index===0?<th scope="row" key={index}>{cell}</th>:<td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>}
        {section.links&&<ul>{section.links.map(([label,url])=><li key={url}><a href={url} rel="noreferrer">{label}</a></li>)}</ul>}
      </section>)}
    </article>
  </PublicLayout>;
}
