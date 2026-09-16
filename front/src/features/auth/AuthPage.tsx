import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, Container, FormField, Heading, Input, Logo, Text } from '../../designSystem';

type AuthMode = 'login' | 'register';
type Audience = 'interimaire' | 'entreprise';

const passwordPattern = '^(?=.*[A-Z])(?=(?:.*\\d){2,})(?=.*[^A-Za-z0-9]).{8,}$';

function normalizePhoneInput(value: string) {
  return value
    .trim()
    .replace(/^(?:\+33|0033)[ .-]?/, '0')
    .replace(/[^0-9 .]/g, '')
    .slice(0, 14);
}

type AuthPageProps = {
  initialMode?: AuthMode;
  onBack: () => void;
};

export function AuthPage({ initialMode = 'login', onBack }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [audience, setAudience] = useState<Audience>('interimaire');
  const [submitted, setSubmitted] = useState(false);
  const [phone, setPhone] = useState('');
  const phonePattern = /^(?:0[1-9]\d{8}|0[1-9](?: \d{2}){4}|0[1-9](?:\.\d{2}){4})$/;
  const phoneError = phone.length > 0 && !phonePattern.test(phone);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setSubmitted(false);
    setPhone('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

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
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')} className={`rounded-md px-2 py-2.5 text-xs font-bold sm:px-3 sm:text-sm ${mode === 'login' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600'}`}>
              Se connecter
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')} className={`rounded-md px-2 py-2.5 text-xs font-bold sm:px-3 sm:text-sm ${mode === 'register' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600'}`}>
              S'inscrire
            </button>
          </div>

          <Heading as="h1" size="md" className="mt-7">
            {mode === 'login' ? 'Accéder à mon espace' : 'Créer mon compte'}
          </Heading>
          <Text muted className="mt-2">
            {mode === 'login' ? 'Le même accès pour les intérimaires et les entreprises.' : 'Choisissez le parcours qui correspond à votre situation.'}
          </Text>

          {mode === 'login' && (
            <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Type de compte">
              {(['interimaire', 'entreprise'] as Audience[]).map((option) => (
                <button key={option} type="button" role="radio" aria-checked={audience === option} onClick={() => { setAudience(option); setSubmitted(false); }} className={`rounded-md border p-3 text-left text-sm font-bold transition-colors ${audience === option ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'}`}>
                  <span className="block">{option === 'interimaire' ? 'Intérimaire' : 'Entreprise'}</span>
                  <span className="mt-1 block text-xs font-medium text-neutral-500">{option === 'interimaire' ? 'Profil et missions' : 'Missions et candidats'}</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'register' && (
            <div className="mt-6 rounded-md border border-secondary-200 bg-secondary-50 p-4" role="status">
              <Badge tone="secondary">Inscription intérimaire uniquement</Badge>
              <Text className="mt-3 text-sm text-secondary-900">
                L'inscription publique est réservée aux intérimaires. Les entreprises doivent contacter CleanMatch pour qu'un administrateur crée et active leur compte.
              </Text>
              <a href="mailto:contact@cleanmatch.fr" className="mt-3 block break-words text-sm font-bold text-secondary-900 underline underline-offset-2">
                contact@cleanmatch.fr · 01 84 80 20 20
              </a>
            </div>
          )}

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="prenom" label="Prénom">
                    <Input name="prenom" type="text" autoComplete="given-name" required />
                  </FormField>
                  <FormField id="nom" label="Nom">
                    <Input name="nom" type="text" autoComplete="family-name" required />
                  </FormField>
                </div>
              )}
              <FormField id="email" label="Email">
                <Input name="email" type="email" autoComplete="email" placeholder="vous@exemple.fr" required />
              </FormField>
              {mode === 'register' && (
                <FormField
                  id="telephone"
                  label="Téléphone"
                  hint="10 chiffres : 0612345678, 06 12 34 56 78 ou 06.12.34.56.78"
                  error={phoneError ? 'Format attendu : 0612345678, 06 12 34 56 78 ou 06.12.34.56.78.' : undefined}
                >
                  <div className="flex min-w-0">
                    <span className="inline-flex min-h-11 shrink-0 items-center rounded-l-md border border-r-0 border-neutral-200 bg-neutral-100 px-3 text-base font-bold text-neutral-700" aria-hidden="true">
                      +33
                    </span>
                    <Input
                      name="telephone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(normalizePhoneInput(event.target.value))}
                      pattern="(?:0[1-9]\d{8}|0[1-9](?: \d{2}){4}|0[1-9](?:\.\d{2}){4})"
                      title="Saisissez 10 chiffres au format 0612345678, 06 12 34 56 78 ou 06.12.34.56.78."
                      placeholder="06 12 34 56 78"
                      className="rounded-l-none"
                    />
                  </div>
                </FormField>
              )}
              <FormField id="password" label="Mot de passe" hint="8 caractères minimum, 1 majuscule, 2 chiffres et 1 caractère spécial">
                <Input
                  name="password"
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  pattern={passwordPattern}
                  title="Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 2 chiffres et 1 caractère spécial."
                  required
                />
              </FormField>
              <Button type="submit" variant="primary" size="3" className="mt-2 w-full">
                {mode === 'register' ? 'Créer mon compte intérimaire' : `Se connecter en tant qu'${audience}`}
              </Button>
          </form>

          {submitted && (
            <p className="mt-4 rounded-md bg-warning-100 p-3 text-sm font-semibold text-warning-900" role="status">
              Le formulaire est prêt à être relié à l'API d'authentification.
            </p>
          )}
        </Card>
      </Container>
    </main>
  );
}
