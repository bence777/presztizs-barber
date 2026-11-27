import { Html, Head, Main, NextScript } from 'next/document';
export default function Document(props) {
  const language = props.__NEXT_DATA__?.props?.pageProps?.language || (props.__NEXT_DATA__?.query?.lang === 'en' ? 'en' : 'hu');
  return <Html lang={language === 'en' ? 'en' : 'hu-HU'}><Head /><body><Main /><NextScript /></body></Html>;
}
