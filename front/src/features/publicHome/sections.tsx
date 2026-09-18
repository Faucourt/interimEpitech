import { Badge, Button, Card, Container, Heading, Logo, Text } from '../../designSystem';

type HeaderProps = {
  onAuth: (mode: 'login' | 'register') => void;
};

export function Header({ onAuth }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <Container className="flex items-center justify-between gap-2 py-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo size="1" alt="CleanMatch logo" />
          <p className="truncate font-display text-base font-extrabold text-neutral-900 sm:text-lg">CleanMatch</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button type="button" variant="secondary" size="2" className="px-2 text-xs sm:px-4 sm:text-base" onClick={() => onAuth('register')}>
            S’inscrire
          </Button>
          <Button type="button" variant="primary" size="2" className="px-2 text-xs sm:px-4 sm:text-base" onClick={() => onAuth('login')}>
            Se connecter
          </Button>
        </div>
      </Container>
    </header>
  );
}

export function Hero() {
  return (
    <section className="home-hero bg-[linear-gradient(180deg,#ffffff_0%,#f5f8fc_100%)] py-12 sm:py-24">
      <Container>
        <div className="home-hero-content mx-auto max-w-3xl text-center">
          <Badge tone="secondary">Mise en relation professionnelle</Badge>
          <Heading as="h1" size="xl" className="mt-5">
            Trouvez la bonne mission. Trouvez le bon profil.
          </Heading>
          <Text size="lg" muted className="mx-auto mt-5 max-w-2xl">
            CleanMatch rapproche les intérimaires et les entreprises de propreté avec des informations claires et un matching utile.
          </Text>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <a href="#parcours" className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary-700 px-5 text-center text-base font-bold text-white hover:bg-primary-800">
              Découvrir les parcours
            </a>
            <a href="#fonctionnement" className="inline-flex min-h-12 items-center justify-center rounded-md border border-primary-200 bg-white px-5 text-center text-base font-bold text-primary-700 hover:bg-primary-50">
              Comment ça marche
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function RoleCards() {
  return (
    <section id="parcours" className="py-10 sm:py-16">
      <Container>
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <Badge tone="neutral">Deux parcours complémentaires</Badge>
          <Heading as="h2" size="lg" className="mt-3">Une expérience adaptée à chaque rôle</Heading>
          <Text muted className="mt-3">Les mêmes critères de confiance, avec des actions différentes selon que vous cherchez une mission ou un profil.</Text>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card variant="outlined" size="lg" className="home-card h-full">
            <Badge tone="info">Intérimaire</Badge>
            <Heading as="h2" size="md" className="mt-4">Accédez aux missions adaptées</Heading>
            <Text muted className="mt-3">Créez votre profil, indiquez vos disponibilités et suivez vos candidatures.</Text>
            <ul className="mt-5 space-y-3 text-sm font-medium text-neutral-700">
              <li className="flex gap-3"><span className="text-primary-700">01</span><span>Renseignez vos compétences et votre zone de recherche.</span></li>
              <li className="flex gap-3"><span className="text-primary-700">02</span><span>Consultez les missions compatibles avec vos disponibilités.</span></li>
              <li className="flex gap-3"><span className="text-primary-700">03</span><span>Candidez et suivez l'évolution de vos candidatures.</span></li>
            </ul>
          </Card>
          <Card variant="outlined" size="lg" className="home-card h-full">
            <Badge tone="secondary">Entreprise</Badge>
            <Heading as="h2" size="md" className="mt-4">Trouvez les bons profils</Heading>
            <Text muted className="mt-3">Les comptes entreprise sont créés et activés par l’administrateur avant connexion.</Text>
            <ul className="mt-5 space-y-3 text-sm font-medium text-neutral-700">
              <li className="flex gap-3"><span className="text-secondary-700">01</span><span>Contactez CleanMatch pour la création de votre compte.</span></li>
              <li className="flex gap-3"><span className="text-secondary-700">02</span><span>Décrivez une mission avec ses critères essentiels.</span></li>
              <li className="flex gap-3"><span className="text-secondary-700">03</span><span>Recevez des candidatures et choisissez votre profil.</span></li>
            </ul>
          </Card>
        </div>
      </Container>
    </section>
  );
}

export function Process() {
  return (
    <section id="fonctionnement" className="bg-white py-10 sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="secondary">Comment ça fonctionne</Badge>
          <Heading as="h2" size="lg" className="mt-3">Du besoin à la bonne mise en relation</Heading>
          <Text muted className="mt-3">CleanMatch s'appuie sur des informations concrètes pour éviter les mises en relation approximatives.</Text>
        </div>
        <div className="process-steps mt-8 grid gap-4 md:grid-cols-3">
          <Card variant="outlined" size="md" className="process-step">
            <span className="font-display text-3xl font-extrabold text-primary-200">01</span>
            <Heading as="h3" size="sm" className="mt-3">Décrire</Heading>
            <Text muted className="mt-2">Un profil ou une mission est renseigné avec les informations utiles au secteur.</Text>
          </Card>
          <Card variant="outlined" size="md" className="process-step">
            <span className="font-display text-3xl font-extrabold text-secondary-300">02</span>
            <Heading as="h3" size="sm" className="mt-3">Comparer</Heading>
            <Text muted className="mt-2">Compétences, expériences récentes, disponibilités et localisation sont pris en compte.</Text>
          </Card>
          <Card variant="outlined" size="md" className="process-step">
            <span className="font-display text-3xl font-extrabold text-accent-500">03</span>
            <Heading as="h3" size="sm" className="mt-3">Agir</Heading>
            <Text muted className="mt-2">Les recommandations ou candidatures pertinentes facilitent la décision.</Text>
          </Card>
        </div>
      </Container>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo size="1" alt="CleanMatch" />
          <div>
            <p className="font-display text-lg font-extrabold text-neutral-900">CleanMatch</p>
            <p className="text-sm text-neutral-500">Mise en relation professionnelle</p>
          </div>
        </div>

        <p className="text-sm text-neutral-500">Mise en relation professionnelle</p>
      </Container>
    </footer>
  );
}
