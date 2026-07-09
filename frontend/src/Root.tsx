import { useEffect, useState } from 'react';
import App from './App';
import WatchApp from './watch/WatchApp';

// Sentinel Watch is a deliberately separate app with its own design, so it
// gets its own hash route instead of pulling in a router dependency for one
// switch: '#/watch' -> monitoring dashboard, anything else -> the campaign.
function currentRoute(): 'watch' | 'app' {
  return window.location.hash === '#/watch' ? 'watch' : 'app';
}

export default function Root() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route === 'watch' ? <WatchApp /> : <App />;
}
