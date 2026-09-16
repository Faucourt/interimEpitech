import { Card, Heading, Text } from "../../src/designSystem";
import { Container, Section } from "../../src/designSystem";
const colors = [
  { name: "Primary", className: "bg-primary-700", value: "#0757B8" },
  { name: "Secondary", className: "bg-secondary-500", value: "#06B6D4" },
  { name: "Accent", className: "bg-accent-500", value: "#06B6D4" },
  { name: "Neutral", className: "bg-neutral-200", value: "#E5EAF1" },
];
export function FoundationsShowcase() {
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Foundations
        </Heading>
        <Text muted className="mt-2">
          Les fondations visuelles du système CleanMatch.
        </Text>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {colors.map((item) => (
            <Card key={item.name} size="sm" variant="outlined">
              <div className={`mb-3 h-16 rounded-md ${item.className}`} />
              <Text className="font-bold">{item.name}</Text>
              <Text size="sm" muted>
                {item.value}
              </Text>
            </Card>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card variant="outlined" size="sm">
            <Text className="font-bold">Spacing · 4px</Text>
            <div className="mt-4 flex items-end gap-2">
              {[4, 8, 16, 24, 32, 48].map((space) => (
                <div key={space} className="grid justify-items-center gap-1">
                  <div
                    className="w-3 bg-secondary-500"
                    style={{ height: `${Math.max(space / 2, 4)}px` }}
                  />
                  <Text size="sm" muted>
                    {space}
                  </Text>
                </div>
              ))}
            </div>
          </Card>
          <Card variant="outlined" size="sm">
            <Text className="font-bold">Radius</Text>
            <div className="mt-4 flex gap-3">
              <span className="size-10 rounded-sm bg-primary-100" />
              <span className="size-10 rounded-md bg-primary-300" />
              <span className="size-10 rounded-lg bg-primary-500" />
              <span className="size-10 rounded-xl bg-primary-700" />
            </div>
            <Text size="sm" muted className="mt-2">
              6 · 10 · 14 · 18px
            </Text>
          </Card>
          <Card variant="elevated" size="sm">
            <Text className="font-bold">Shadow</Text>
            <div className="mt-4 h-12 rounded-lg bg-white shadow-soft" />
            <Text size="sm" muted className="mt-2">
              Soft et discrète
            </Text>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
