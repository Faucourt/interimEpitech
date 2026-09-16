import { useEffect, useState } from 'react';
import { AuthPage } from './features/auth';
import { PublicHomePage } from './features/publicHome';

type AppView = { page: 'home' } | { page: 'auth'; mode: 'login' | 'register' };

function viewFromLocation(): AppView {
  const [page, mode] = window.location.hash.slice(1).split('/');

  if (page === 'auth' && (mode === 'login' || mode === 'register')) {
    return { page: 'auth', mode };
  }

  return { page: 'home' };
}

function App() {
  const [view, setView] = useState<AppView>(viewFromLocation);

  useEffect(() => {
    const syncViewWithLocation = () => setView(viewFromLocation());

    window.addEventListener('popstate', syncViewWithLocation);
    window.addEventListener('hashchange', syncViewWithLocation);

    return () => {
      window.removeEventListener('popstate', syncViewWithLocation);
      window.removeEventListener('hashchange', syncViewWithLocation);
    };
  }, []);

  function openAuth(mode: 'login' | 'register') {
    window.history.pushState(null, '', `#auth/${mode}`);
    setView({ page: 'auth', mode });
  }

  function goHome() {
    window.history.back();
  }

  if (view.page === 'auth') {
    return <AuthPage initialMode={view.mode} onBack={goHome} />;
  }

  return <PublicHomePage onAuth={openAuth} />;
}

export default App
