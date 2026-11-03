import { useEffect, useState } from 'react';

/** Route simple basée sur l'ancre de l'URL : #/service, #/cuisine, #/reglages. */
export function useHashRoute(): string {
  const read = () => location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(route: string) {
  location.hash = `#/${route}`;
}
