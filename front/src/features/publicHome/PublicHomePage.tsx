import { Footer, Header, Hero, Process, RoleCards } from './sections';

export function PublicHomePage({ onAuth }: { onAuth: (mode: 'login' | 'register') => void }) {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <Header onAuth={onAuth} />
      <Hero />
      <RoleCards />
      <Process />
      <Footer />
    </main>
  );
}
