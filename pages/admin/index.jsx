// /admin is the entry point for the separate staff portal.
export async function getServerSideProps() {
  return {redirect:{destination:'/admin/foglalasok',permanent:false}};
}
export default function AdminRoot() {return null;}
