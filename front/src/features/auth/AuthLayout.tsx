import type { ReactNode } from 'react';
import { Card, Container, Logo } from '../../designSystem';

type AuthMode = 'login' | 'register';

type AuthLayoutProps = {
  mode: AuthMode;
  onBack: () => void;
  onModeChange: (mode: AuthMode) => void;
  children: ReactNode;
};

export function AuthLayout({ mode, onBack, onModeChange, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-neutral-50 py-8 sm:py-12">
      <Container>
        <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8 sm:gap-4">
          <button type="button" onClick={onBack} className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="Retour à l'accueil">
            <Logo size="1" alt="CleanMatch" />
            <span className="truncate font-display text-base font-extrabold text-neutral-900 sm:text-lg">CleanMatch</span>
          </button>
          <button type="button" onClick={onBack} className="shrink-0 text-right text-xs font-bold text-primary-700 hover:text-primary-900 sm:text-sm">
            Retour à l'accueil
          </button>
        </div>
        <Card variant="elevated" size="lg" className="auth-card mx-auto max-w-xl !p-4 sm:!p-8">
          <div className="grid grid-cols-2 rounded-md bg-neutral-100 p-1" role="tablist" aria-label="Choisir une action">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => onModeChange('login')} className={`rounded-md px-2 py-2.5 text-xs font-bold sm:px-3 sm:text-sm ${mode === 'login' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600'}`}>Se connecter</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => onModeChange('register')} className={`rounded-md px-2 py-2.5 text-xs font-bold sm:px-3 sm:text-sm ${mode === 'register' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600'}`}>S'inscrire</button>
          </div>
          {children}
        </Card>
      </Container>
    </main>
  );
}
