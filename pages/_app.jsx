import '../styles/globals.css';
import { LanguageProvider } from '../components/LanguageProvider';
export default function App({ Component, pageProps }) { return <LanguageProvider initialLanguage={pageProps.language} availableLanguages={pageProps.availableLanguages}><Component {...pageProps} /></LanguageProvider>; }
