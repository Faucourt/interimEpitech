import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Status,
} from "../../src/designSystem";
import { Container, Section, Stack } from "../../src/designSystem";
export function FeedbackShowcase() {
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Feedback
        </Heading>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card variant="outlined">
            <p className="mb-3 font-bold">Badges</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="error">Error</Badge>
              <Badge tone="info">Info</Badge>
              <Badge tone="neutral">Neutral</Badge>
              <Badge tone="secondary">Secondary</Badge>
            </div>
          </Card>
          <Card variant="outlined">
            <p className="mb-3 font-bold">Status</p>
            <Stack gap="sm">
              <Status status="success">Disponible</Status>
              <Status status="warning">En attente</Status>
              <Status status="error">Action requise</Status>
              <Status status="info">Information</Status>
            </Stack>
          </Card>
        </div>
        <div className="mt-4">
          <EmptyState
            title="Aucun résultat"
            description="Les éléments correspondant à votre recherche apparaîtront ici."
            action={
              <Button variant="outline" size="1">
                Réinitialiser
              </Button>
            }
          />
        </div>
      </Container>
    </Section>
  );
}
