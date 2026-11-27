import { SITE, route } from './site.mjs';
import { priceRange, availableServiceKeys, servicesFor } from '../lib/seo/catalog.mjs';

export const COPY = {
  hu: {
    home: 'Főoldal', prices: 'Árak', team: 'Fodrászok', contact: 'Kapcsolat', book: 'Időpontfoglalás', allPrices: 'Teljes árlista', profile: 'Bemutatkozás', services: 'Szolgáltatások', duration: 'perc', related: 'Kapcsolódó szolgáltatások', faq: 'Amit érdemes tudnod.',
    priceNote: 'Minden fodrász egyéni árakon dolgozik. Az alábbi összegek az aktuális, online foglalható szolgáltatások árai.',
    unavailable: 'Az árlista jelenleg nem elérhető. Kérjük, próbáld újra később.',
    empty: 'Jelenleg nincs online foglalható szolgáltatás.',
    footerLine: 'Férfi fodrászat Debrecenben. Saját stílus, személyes figyelem.',
    closing: 'A következő vágásod.', closingText: 'Válassz fodrászt, nézd meg a saját szolgáltatásait, és keress egy időpontot.',
    portfolio: 'Válogatott munkák', specializations: 'Amivel szívesen foglalkozom', social: 'Kövess itt',
    localHeading: 'Találkozunk Debrecenben.', localCopy: 'DEMETERS barber szalon, Debrecen. A foglalás előtt válaszd ki, kihez szeretnél érkezni.',
    directions: 'Útvonaltervezés', openingHours: 'Nyitvatartás', parking: 'Parkolás', transit: 'Tömegközlekedés', google: 'Google Cégprofil',
    teamIntro: 'Nézd meg a csapatot, hasonlítsd össze a szolgáltatásokat, és válaszd ki a fodrászodat. Az aktuális árakat már a foglalás előtt megtalálod.',
    priceIntro: 'A szolgáltatás, az időtartam és az ár egy helyen. Fodrászonként, közvetlen foglalással.',
  },
  en: {
    home: 'Home', prices: 'Prices', team: 'Barbers', contact: 'Contact', book: 'Book an appointment', allPrices: 'Full price list', profile: 'Meet your barber', services: 'Services', duration: 'min', related: 'Explore other services', faq: 'Good to know.',
    priceNote: 'Each barber sets their own prices. The amounts below are the current prices of services available to book online.',
    unavailable: 'The price list is temporarily unavailable. Please try again later.',
    empty: 'There are currently no services available to book online.',
    footerLine: 'Men’s hairdressing in Debrecen. Personal style, personal attention.',
    closing: 'Your next cut.', closingText: 'Choose your barber, explore their services and find a time that works for you.',
    portfolio: 'Selected work', specializations: 'My focus', social: 'Find me here',
    localHeading: 'See you in Debrecen.', localCopy: 'DEMETERS barbershop, Debrecen. Choose who you would like to book with before picking a time.',
    directions: 'Get directions', openingHours: 'Opening hours', parking: 'Parking', transit: 'Public transport', google: 'Google Business Profile',
    teamIntro: 'Meet the team, compare services and choose your barber. You can see each barber’s current prices before starting a booking.',
    priceIntro: 'The service, the time and the price. Listed by barber, ready to book.',
  },
};

export const SERVICE_CONTENT = {
  haircut: {
    hu: { label: 'Férfi hajvágás', title: 'Férfi hajvágás Debrecen – Szolgáltatások és árak | DEMETERS', h1: 'Férfi hajvágás. A te ritmusodban.', description: 'Férfi hajvágás Debrecenben a DEMETERS szalonban. Aktuális árak és időtartamok fodrászonként, közvetlen online időpontfoglalással.', intro: 'Egy frissítés a megszokott fazonon, vagy egy új irány. Itt előbb kiválaszthatod, kihez érkezel, majd azt a hajvágást, amelyikre szükséged van.', detail: 'A gépi és az egyéb hajvágások külön szolgáltatásként szerepelnek az árlistában. A pontos megnevezést, az időtartamot és az árat minden fodrásznál külön látod.', audience: 'Ha rendbe tennéd a jelenlegi fazonodat, rövidebbre váltanál, vagy rendszeresen karbantartanád a frizurádat, itt tudod összehasonlítani a hajvágási lehetőségeket.', question: 'Melyik hajvágást válasszam?', answer: 'Nézd meg a kiválasztott fodrász szolgáltatásainak nevét és leírását. A gépi hajvágás és a hajvágás külön tétel lehet; a foglalásban mindig a kiválasztott szolgáltatás időtartama és ára szerepel.' },
    en: { label: 'Men’s haircut', title: 'Men’s Haircut in Debrecen – Prices & Booking | DEMETERS', h1: 'A fresh cut. Your own pace.', description: 'Men’s haircuts at DEMETERS barbershop in Debrecen. Compare current prices and appointment lengths by barber, then book online.', intro: 'A tidy-up of your usual style or a change of direction. Choose your barber first, then find the haircut and appointment that suit you.', detail: 'Clipper cuts and other haircuts appear as separate services. Each barber’s list shows the exact service, appointment length and price.', audience: 'For keeping your current style in shape, going shorter or making a regular haircut part of your routine. Compare the available options below.', question: 'Which haircut should I book?', answer: 'Check your barber’s service names and descriptions. A clipper cut and a haircut may be separate options. Your booking always shows the price and length of the service you select.' },
  },
  combo: {
    hu: { label: 'Haj és szakáll', title: 'Haj és szakáll Debrecen – Árak és foglalás | DEMETERS', h1: 'Haj és szakáll. Egy időpont.', description: 'Haj- és szakállszolgáltatás a DEMETERS debreceni barber szalonban. Nézd meg a fodrászok aktuális kombinált szolgáltatásait, árait és szabad időpontjait.', intro: 'Amikor a hajadat és a szakálladat is rendbe tennéd, válassz egy kombinált időpontot. Egy szolgáltatás, előre látható időtartammal és árral.', detail: 'Az alábbi tételek kifejezetten a fodrászok saját „Haj és szakáll” szolgáltatásai. Az ár és az időtartam a teljes kombinált foglalásra vonatkozik.', audience: 'Ha egy alkalommal foglalkoznál a frizuráddal és a szakálladdal is. Külön időpontok keresése helyett a kombinált szolgáltatást választhatod.', question: 'Külön kell lefoglalnom a hajvágást és a szakállat?', answer: 'A „Haj és szakáll” szolgáltatáshoz egyetlen időpontot foglalsz. A listában a kombinált szolgáltatás teljes ára és időtartama látható.' },
    en: { label: 'Hair & beard', title: 'Haircut & Beard in Debrecen – Prices & Booking | DEMETERS', h1: 'Hair and beard. One appointment.', description: 'Book a combined hair and beard appointment at DEMETERS in Debrecen. See each barber’s current services, prices and appointment lengths.', intro: 'Get your hair and beard in shape in one visit. Choose a combined service with the full appointment length and price shown upfront.', detail: 'The options below are each barber’s own combined hair and beard services. The listed price and time cover the whole appointment.', audience: 'For taking care of your haircut and beard in the same visit. Book one combined service instead of finding two separate appointments.', question: 'Do I need to book my haircut and beard separately?', answer: 'The hair and beard service is a single booking. Its listed price and appointment length cover the combined service.' },
  },
  beard: {
    hu: { label: 'Szakállformázás', title: 'Szakállformázás Debrecen – Aktuális árak | DEMETERS', h1: 'Szakáll. Formában.', description: 'Szakálligazítás és szakállformázás Debrecenben. A DEMETERS aktuális szakállszolgáltatásai, árai és az azokat nyújtó fodrászok egy helyen.', intro: 'Egy rendezettebb forma vagy a megszokott szakáll karbantartása. Az alábbi listában az önálló szakállszolgáltatásokat találod.', detail: 'Minden fodrász saját szolgáltatásokkal és árakkal dolgozik. A pontos részleteket az adott tétel mellett látod; innen közvetlenül is foglalhatsz.', audience: 'Ha most a szakálladra szánnál időt, hajvágás nélkül. A hajvágással együtt foglalható lehetőségeket a kapcsolódó szolgáltatásoknál találod.', question: 'Hajvágás nélkül is foglalhatok szakállszolgáltatást?', answer: 'Az ezen az oldalon felsorolt tételek önálló szakállszolgáltatások. A hajvágást is tartalmazó szolgáltatások külön szerepelnek.' },
    en: { label: 'Beard trim', title: 'Beard Trim in Debrecen – Prices & Barbers | DEMETERS', h1: 'Your beard. In shape.', description: 'Beard services at DEMETERS barbershop in Debrecen. See current beard trim options, prices and the barbers who offer them, then book online.', intro: 'Maintain your usual beard or give it a cleaner shape. Below you will find standalone beard appointments.', detail: 'Each barber offers their own services and sets their own prices. Check the details beside each option and book directly from the list.', audience: 'For looking after your beard without booking a haircut. Combined hair and beard appointments are listed under related services.', question: 'Can I book a beard service without a haircut?', answer: 'The services listed on this page are standalone beard appointments. Services that also include a haircut are listed separately.' },
  },
  fade: {
    hu: { label: 'Fade hajvágás', title: 'Fade hajvágás Debrecen – Fodrászok és árak | DEMETERS', h1: 'Fade. Tiszta átmenet.', description: 'Fade hajvágás Debrecenben a DEMETERS szalonban. Kifejezetten fade-ként foglalható szolgáltatások, aktuális árak és közvetlen időpontfoglalás.', intro: 'A fade fokozatos átmenetet alakít ki a rövidebb és hosszabb hajrészek között. Itt azokat a szolgáltatásokat látod, amelyeket a fodrászok kifejezetten fade-ként kínálnak.', detail: 'A fade elnevezés nem jelent mindenkinél azonos szolgáltatást. A választott fodrász saját megnevezése, leírása és időtartama segít a foglalásban.', audience: 'Ha az oldalsó és hátsó hajrészeken fokozatos, határozott átmenetet szeretnél. A konkrét lehetőségeket az alábbi szolgáltatásoknál találod.', question: 'Mit jelent a fade hajvágás?', answer: 'A fade a rövidebb és hosszabb hajrészek közötti fokozatos átmenet. Foglaláskor az adott fodrász saját fade szolgáltatásának leírását és időtartamát vedd alapul.' },
    en: { label: 'Fade haircut', title: 'Fade Haircut in Debrecen – Prices & Booking | DEMETERS', h1: 'Fade. A clean transition.', description: 'Fade haircuts at DEMETERS in Debrecen. Explore services explicitly offered as fades, compare current prices and book your barber online.', intro: 'A fade creates a gradual transition between shorter and longer sections of hair. This page lists the services our barbers specifically offer as fades.', detail: 'Fade services can differ between barbers. Check the name, description and appointment length of the option you choose.', audience: 'For a gradual transition on the sides and back. Explore the individual fade options available below.', question: 'What is a fade haircut?', answer: 'A fade is a gradual transition between shorter and longer hair. When booking, check your chosen barber’s own fade service description and appointment length.' },
  },
};

export function pageMetadata(key, language = 'hu', barber) {
  if (SERVICE_CONTENT[key]) return SERVICE_CONTENT[key][language];
  const en = language === 'en';
  if (key === 'profile') return { title: `${barber.name} – ${en ? 'Barber in Debrecen' : 'Barber Debrecen'} | DEMETERS`, h1: barber.name, description: en ? `Meet ${barber.name} at DEMETERS in Debrecen. Explore their introduction, current services, prices and appointment lengths, then book online.` : `${barber.name}, a DEMETERS fodrásza Debrecenben. Bemutatkozás, saját szolgáltatások, aktuális árak és időtartamok, közvetlen online foglalással.` };
  const metadata = {
    home: en ? ['Barber in Debrecen – Men’s Haircuts | DEMETERS', "PROFESSIONAL MEN'S HAIR STUDIO", 'Men’s haircuts and hair and beard appointments at DEMETERS in Debrecen. Meet the barbers, see current prices and book your appointment online.'] : ['Barber Debrecen – Prémium férfi fodrászat | DEMETERS', "PROFESSIONAL MEN'S HAIR STUDIO", 'Férfi hajvágás és szakállformázás Debrecenben, a DEMETERS barber szalonban. Ismerd meg fodrászainkat, és foglalj időpontot online!'],
    prices: en ? ['Barber Prices in Debrecen – Services by Barber | DEMETERS', 'Your barber. Your service.', 'Current DEMETERS barber prices in Debrecen, listed by barber. Compare services and appointment lengths and book online with your preferred barber.'] : ['Barber árak Debrecen – Árlista fodrászonként | DEMETERS', 'Saját fodrász. Saját árak.', 'A DEMETERS aktuális barber árlistája Debrecenben, fodrászonként. Szolgáltatások, időtartamok és közvetlen online foglalás egy helyen.'],
    team: en ? ['Meet the Barbers in Debrecen | DEMETERS', 'The people behind the cut.', 'Meet the DEMETERS barbers in Debrecen. Explore their services, compare current prices and choose who to book with online.'] : ['Fodrászok Debrecenben – A csapat | DEMETERS', 'A vágás mögött. A csapat.', 'Ismerd meg a DEMETERS fodrászait Debrecenben. Saját szolgáltatások, aktuális árak és közvetlen időpontfoglalás a választott barberhez.'],
    contact: en ? ['Contact & Online Booking – Debrecen | DEMETERS', 'DEMETERS. Debrecen.', 'Contact and booking information for DEMETERS barbershop in Debrecen. Meet the team, see current services and arrange your appointment online.'] : ['Kapcsolat és időpontfoglalás – Debrecen | DEMETERS', 'DEMETERS. Debrecen.', 'DEMETERS barber szalon Debrecenben. Elérhetőségek, fodrászok és online időpontfoglalás. Ismerd meg a csapatot, és válaszd ki a következő időpontodat.'],
  };
  const [title, h1, description] = metadata[key];
  return { title, h1, description };
}

export function homeFaq(catalog, language = 'hu') {
  const en = language === 'en', prices = priceRange(servicesFor(catalog, 'haircut'), language);
  const items = [
    en ? ['How much is a men’s haircut at DEMETERS?', prices ? `Current haircut prices range from ${prices}. Each barber’s full service list shows the exact price and appointment length before you book.` : 'See the current price list for each barber’s services, prices and appointment lengths.'] : ['Mennyibe kerül egy férfi hajvágás a DEMETERS szalonban?', prices ? `A jelenleg foglalható hajvágások ára: ${prices}. A teljes árlistában fodrászonként látod a pontos szolgáltatást, árat és időtartamot.` : 'Az aktuális szolgáltatásokat, árakat és időtartamokat a fodrászonkénti árlistában találod.'],
    en ? ['How do I book an appointment?', 'Choose a barber, a service and an available time in the online booking form. Verify your email, enter your details and confirm the booking with the final confirmation button.'] : ['Hogyan tudok időpontot foglalni?', 'Az online foglalóban válassz fodrászt, szolgáltatást és szabad időpontot. Az e-mailes azonosítás és az adataid megadása után a véglegesítő gombbal tudod rögzíteni a foglalást.'],
    en ? ['Can I choose my barber?', 'Yes. Select a barber first to see their own services and prices. You can also choose the earliest appointment option.'] : ['Választhatok magamnak fodrászt?', 'Igen. A foglalás elején kiválaszthatod a fodrászt, majd a saját szolgáltatásait és árait látod. A leghamarabbi időpont lehetőségét is választhatod.'],
    en ? ['How can I manage or cancel my booking?', 'Open My bookings and sign in using your email code. You can cancel an appointment before it starts. To change the time, cancel the original booking and make a new one.'] : ['Hogyan módosíthatom vagy mondhatom le a foglalásomat?', 'A Foglalásaim oldalon e-mailes azonosítással éred el a foglalásaidat. A még el nem kezdődött időpontot lemondhatod. Másik időponthoz a korábbi foglalás lemondása után új foglalást indíthatsz.'],
  ];
  if (SITE.address) items.push(en ? ['Where is DEMETERS?', `${SITE.address.postalCode} ${SITE.address.addressLocality}, ${SITE.address.streetAddress}. See the contact page for directions.`] : ['Hol található a DEMETERS barber szalon?', `${SITE.address.postalCode} ${SITE.address.addressLocality}, ${SITE.address.streetAddress}. Az útvonaltervezést a Kapcsolat oldalon találod.`]);
  const labels = availableServiceKeys(catalog).map(key => SERVICE_CONTENT[key][language].label);
  if (labels.length) items.push(en ? ['What services can I book?', `Current service categories: ${labels.join(', ')}. Individual barbers may offer additional services; check the full price list.`] : ['Milyen szolgáltatásokat kínálnak a fodrászok?', `A jelenlegi szolgáltatáskategóriák: ${labels.join(', ')}. A fodrászok további egyedi szolgáltatásait is megtalálod a teljes árlistában.`]);
  return items.map(([question, answer]) => ({ question, answer }));
}

export function serviceFaq(key, catalog, language) {
  const copy = SERVICE_CONTENT[key][language];
  return [{ question: copy.question, answer: copy.answer }, ...homeFaq(catalog, language).slice(1, 3)];
}
