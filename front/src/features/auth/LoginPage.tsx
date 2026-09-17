import { useState, type FormEvent } from 'react';
import { Button, FormField, Heading, Input, Text } from '../../designSystem';
import { AuthLayout } from './AuthLayout';

type Audience = 'interimaire' | 'entreprise';

type LoginPageProps = { onBack: () => void; onRegister: () => void };

export function LoginPage({ onBack, onRegister }: LoginPageProps) {
  const [audience, setAudience] = useState<Audience>('interimaire');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <AuthLayout mode="login" onBack={onBack} onModeChange={(mode) => mode === 'register' && onRegister()}>
      <Heading as="h1" size="md" className="mt-7">Accéder à mon espace</Heading>
      <Text muted className="mt-2">Le même accès pour les intérimaires et les entreprises.</Text>
      <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Type de compte">
        {(['interimaire', 'entreprise'] as Audience[]).map((option) => (
          <button key={option} type="button" role="radio" aria-checked={audience === option} onClick={() => { setAudience(option); setSubmitted(false); }} className={`rounded-md border p-3 text-left text-sm font-bold transition-colors ${audience === option ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'}`}>
            <span className="block">{option === 'interimaire' ? 'Intérimaire' : 'Entreprise'}</span>
            <span className="mt-1 block text-xs font-medium text-neutral-500">{option === 'interimaire' ? 'Profil et missions' : 'Missions et candidats'}</span>
          </button>
        ))}
      </div>
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <FormField id="login-email" label="Email"><Input name="email" type="email" autoComplete="email" placeholder="vous@exemple.fr" required /></FormField>
        <FormField id="login-password" label="Mot de passe" hint="8 caractères minimum, 1 majuscule, 2 chiffres et 1 caractère spécial"><Input name="password" type="password" autoComplete="current-password" pattern="^(?=.*[A-Z])(?=(?:.*\\d){2,})(?=.*[^A-Za-z0-9]).{8,}$" title="Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 2 chiffres et 1 caractère spécial." required /></FormField>
        <Button type="submit" variant="primary" size="3" className="mt-2 w-full">{`Se connecter en tant qu'${audience}`}</Button>
      </form>
      {submitted && <p className="mt-4 rounded-md bg-warning-100 p-3 text-sm font-semibold text-warning-900" role="status">Le formulaire est prêt à être relié à l'API d'authentification.</p>}
    </AuthLayout>
  );
}
