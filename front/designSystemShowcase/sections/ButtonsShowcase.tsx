import { Button, Heading, Text } from "../../src/designSystem";
import { Container, Section, Stack } from "../../src/designSystem";
const variants = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "danger",
] as const;
const sizes = ["1", "2", "3", "4"] as const;
export function ButtonsShowcase() {
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Buttons
        </Heading>
        <Stack gap="lg" className="mt-6">
          <div>
            <Text className="mb-3 font-bold">Variants</Text>
            <div className="flex flex-wrap gap-3">
              {variants.map((variant) => (
                <Button key={variant} variant={variant} size="2">
                  {variant}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Text className="mb-3 font-bold">Sizes</Text>
            <div className="flex flex-wrap items-center gap-3">
              {sizes.map((size) => (
                <Button key={size} size={size}>
                  Size {size}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Text className="mb-3 font-bold">États</Text>
            <div className="flex flex-wrap gap-3">
              <Button>Default</Button>
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
              <Button variant="outline">Focus visible au clavier</Button>
            </div>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
