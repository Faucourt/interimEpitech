import { Badge, Card, Heading, Stack, Text } from "../../src/designSystem";
import { Container, Section } from "../../src/designSystem";
export function LayoutShowcase() {
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Layout
        </Heading>
        <Card variant="outlined" className="mt-6">
          <Text muted>Container · Stack · Section</Text>
          <Stack direction="horizontal" gap="md" className="mt-4">
            <Badge tone="info">Container fluide</Badge>
            <Badge tone="secondary">Stack responsive</Badge>
            <Badge tone="neutral">Section espacée</Badge>
          </Stack>
        </Card>
      </Container>
    </Section>
  );
}
