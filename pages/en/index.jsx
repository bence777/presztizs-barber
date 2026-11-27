export { default } from '../index';
export async function getStaticProps() {
  const { homeProps } = await import('../../lib/server/publicPages');
  return homeProps('en');
}
