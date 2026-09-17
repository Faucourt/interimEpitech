import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage, login, type Role } from '../../api/auth';
import './Login.css';

// Après connexion, chaque rôle atterrit sur son propre espace.
// À ajuster quand les routes /entreprise/dashboard et /missions existeront réellement.
function dashboardPathForRole(role: Role): string {
  return role === 'ENTREPRISE' ? '/entreprise/dashboard' : '/missions';
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { user } = await login({ email, password });
      navigate(dashboardPathForRole(user.role));
    } catch (err) {
      // Le back renvoie volontairement le même message pour "email inconnu" et
      // "mot de passe faux" (voir back/src/auth/routes.ts) : on le relaie tel quel.
      setError(getApiErrorMessage(err, 'Email ou mot de passe incorrect'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login">
      <h1>Connexion</h1>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p role="alert" className="login-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </section>
  );
}
