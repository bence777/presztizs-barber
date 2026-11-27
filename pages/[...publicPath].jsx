import EditorialPage from '../components/EditorialPage';
export default EditorialPage;
export async function getStaticPaths() { return { paths: [], fallback: 'blocking' }; }
export async function getStaticProps(context) {
  const { editorialProps } = await import('../lib/server/publicPages');
  return editorialProps(context);
}
