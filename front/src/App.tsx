import { Container, Heading, Text } from './designSystem'

function App() {
  return <main className="min-h-screen bg-neutral-50"><Container className="py-12 sm:py-16"><Heading as="h1" size="xl">CleanMatch</Heading><Text size="lg" muted className="mt-4 max-w-xl">L'application est prête à accueillir les interfaces produit. Le catalogue du Design System est disponible avec la commande dédiée.</Text></Container></main>
}

export default App
