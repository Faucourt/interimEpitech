import { useState, type FormEvent } from 'react';
import { Badge, Button, FormField, Heading, Input, Text } from '../../designSystem';
import { AuthLayout } from './AuthLayout';
import { normalizePhoneInput, passwordPattern, phonePattern } from './authValidation';

type RegisterPageProps = { onBack: () => void; onLogin: () => void };

export function RegisterPage({ onBack, onLogin }: RegisterPageProps) {
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const phoneError = phone.length > 0 && !phonePattern.test(phone);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <AuthLayout mode="register" onBack={onBack} onModeChange={(mode) => mode === 'login' && onLogin()}>
      <Heading as="h1" size="md" className="mt-7">Créer mon compte intérimaire</Heading>
      <Text muted className="mt-2">L'inscription publique est réservée aux intérimaires.</Text>
      <div className="mt-6 rounded-md border border-secondary-200 bg-secondary-50 p-4" role="status">
        <Badge tone="secondary">Inscription intérimaire uniquement</Badge>
        <Text className="mt-3 text-sm text-secondary-900">Les entreprises doivent contacter CleanMatch pour qu'un administrateur crée et active leur compte.</Text>
        <a href="mailto:contact@cleanmatch.fr" className="mt-3 block break-words text-sm font-bold text-secondary-900 underline underline-offset-2">contact@cleanmatch.fr · 01 84 80 20 20</a>
      </div>
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2"><FormField id="register-prenom" label="Prénom"><Input name="prenom" type="text" autoComplete="given-name" required /></FormField><FormField id="register-nom" label="Nom"><Input name="nom" type="text" autoComplete="family-name" required /></FormField></div>
        <FormField id="register-email" label="Email"><Input name="email" type="email" autoComplete="email" placeholder="vous@exemple.fr" required /></FormField>
        <FormField id="register-telephone" label="Téléphone" hint="10 chiffres : 0612345678, 06 12 34 56 78 ou 06.12.34.56.78" error={phoneError ? 'Format attendu : 0612345678, 06 12 34 56 78 ou 06.12.34.56.78.' : undefined}><div className="flex min-w-0"><span className="inline-flex min-h-11 shrink-0 items-center rounded-l-md border border-r-0 border-neutral-200 bg-neutral-100 px-3 text-base font-bold text-neutral-700" aria-hidden="true">+33</span><Input name="telephone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(normalizePhoneInput(event.target.value))} pattern="(?:0[1-9]\d{8}|0[1-9](?: \d{2}){4}|0[1-9](?:\.\d{2}){4})" title="Saisissez 10 chiffres au format 0612345678, 06 12 34 56 78 ou 06.12.34.56.78." placeholder="06 12 34 56 78" className="rounded-l-none" required /></div></FormField>
        <FormField id="register-password" label="Mot de passe" hint="8 caractères minimum, 1 majuscule, 2 chiffres et 1 caractère spécial"><Input name="password" type="password" autoComplete="new-password" pattern={passwordPattern} title="Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 2 chiffres et 1 caractère spécial." required /></FormField>
        <Button type="submit" variant="primary" size="3" className="mt-2 w-full">Créer mon compte intérimaire</Button>
      </form>
      {submitted && <p className="mt-4 rounded-md bg-warning-100 p-3 text-sm font-semibold text-warning-900" role="status">Le formulaire est prêt à être relié à l'API d'authentification.</p>}
    </AuthLayout>
  );
}
