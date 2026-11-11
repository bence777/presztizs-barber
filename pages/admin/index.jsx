export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/admin/foglalasok",
      permanent: false,
    },
  };
}

export default function AdminIndex() {
  return null;
}