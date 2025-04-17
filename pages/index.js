import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // This is just a fallback - most requests should be handled by our static files
    // or API routes for content negotiation
    router.push('/');
  }, []);
  
  return null;
}

// This tells Next.js to use the statically generated HTML from our Gulp build
export async function getStaticProps() {
  return {
    // Will be passed to the page component as props
    props: {},
  };
}