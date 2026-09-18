import { Badge, Heading, Text } from "../src/designSystem";
import { Container } from "../src/designSystem";
import {
  FoundationsShowcase,
  ButtonsShowcase,
  ButtonCardsShowcase,
  CardsShowcase,
  TypographyShowcase,
  FormsShowcase,
  FeedbackShowcase,
  LayoutShowcase,
  LogoShowcase,
} from "./sections";
export function DesignSystemShowcase() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <Container className="flex min-h-16 items-center justify-between gap-4">
          <div>
            <Text
              size="sm"
              className="font-bold uppercase tracking-wider text-secondary-700"
            >
              CleanMatch
            </Text>
            <Heading as="h1" size="md" className="mt-0.5">
              Design System
            </Heading>
          </div>
          <Badge tone="info">Catalogue interne</Badge>
        </Container>
      </header>
      <main>
        <FoundationsShowcase />
        <LogoShowcase />
        <TypographyShowcase />
        <ButtonsShowcase />
        <ButtonCardsShowcase />
        <CardsShowcase />
        <FormsShowcase />
        <FeedbackShowcase />
        <LayoutShowcase />
      </main>
    </div>
  );
}
