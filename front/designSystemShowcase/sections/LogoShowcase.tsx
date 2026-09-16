import { Heading, Logo, Text } from "../../src/designSystem";
import { Card } from "../../src/designSystem";
import { Container, Section } from "../../src/designSystem";

const sizes = ["1", "2", "3", "4"] as const;

export function LogoShowcase() {
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Logo
        </Heading>
        <Text muted className="mt-2">
          Actif CleanMatch disponible dans les quatre tailles du système.
        </Text>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {sizes.map((size) => (
            <Card
              key={size}
              variant="outlined"
              size="md"
              className="grid justify-items-center gap-3"
            >
              <Logo size={size} />
              <Text size="sm" className="font-bold">
                Size {size}
              </Text>
              <Text size="sm" muted>
                {size === "1"
                  ? "32px"
                  : size === "2"
                    ? "48px"
                    : size === "3"
                      ? "64px"
                      : "96px"}
              </Text>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
