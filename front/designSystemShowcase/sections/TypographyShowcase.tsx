import { Heading, Text } from "../../src/designSystem";
import { Container, Section, Stack } from "../../src/designSystem";
export function TypographyShowcase() {
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Typography
        </Heading>
        <Stack gap="md" className="mt-6">
          <div>
            <Text size="sm" muted>
              H1 · 32px mobile / 40px desktop
            </Text>
            <Heading as="h1" size="xl">
              Titre principal
            </Heading>
          </div>
          <div>
            <Text size="sm" muted>
              H2 · 24px mobile / 32px desktop
            </Text>
            <Heading as="h2" size="lg">
              Titre de section
            </Heading>
          </div>
          <div>
            <Text size="sm" muted>
              H3 · 20px
            </Text>
            <Heading as="h3" size="md">
              Titre de composant
            </Heading>
          </div>
          <Text>Body · Texte courant confortable et lisible.</Text>
          <Text muted>Muted · Information secondaire accessible.</Text>
          <Text size="sm">Small · Indications et descriptions.</Text>
          <Text size="sm" muted>
            Caption · Métadonnées.
          </Text>
        </Stack>
      </Container>
    </Section>
  );
}
