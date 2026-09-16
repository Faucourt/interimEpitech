import { Card, Heading, Text } from "../../src/designSystem";
import { Container, Section } from "../../src/designSystem";
const variants = ["default", "outlined", "elevated", "interactive"] as const;
const sizes = ["sm", "md", "lg"] as const;
export function CardsShowcase() {
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Cards
        </Heading>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {variants.map((variant) => (
            <Card key={variant} variant={variant} size="md">
              <Text size="sm" className="font-bold uppercase text-primary-700">
                {variant}
              </Text>
              <Heading as="h3" size="md" className="mt-2">
                Card CleanMatch
              </Heading>
              <Text muted className="mt-2">
                Structure légère et contenu respirant.
              </Text>
            </Card>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {sizes.map((size) => (
            <Card key={size} variant="outlined" size={size}>
              <Text className="font-bold">Card {size}</Text>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
