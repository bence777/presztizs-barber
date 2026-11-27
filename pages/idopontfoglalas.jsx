// Keep existing bookmarks and links working after moving booking to the home page.
export function getServerSideProps({ query }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  const search = params.toString();
  return {
    redirect: { destination: `/${search ? `?${search}` : ''}#foglalas`, permanent: false },
  };
}

export default function BookingRedirect() { return null; }
