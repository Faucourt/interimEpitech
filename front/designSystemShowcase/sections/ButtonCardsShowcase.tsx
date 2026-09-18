import { useState } from "react";
import { Badge, ButtonCard, Heading, Text } from "../../src/designSystem";
import { Container, Section } from "../../src/designSystem";
const colors = ["primary", "secondary", "accent", "neutral"] as const;
const sizes = ["1", "2", "3", "4"] as const;
export function ButtonCardsShowcase() {
  const [selected, setSelected] = useState("secondary");
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Button Cards
        </Heading>
        <Text muted className="mt-2">
          Grande zone tactile, contenu scannable et état sélectionné.
        </Text>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {colors.map((color) => (
            <ButtonCard
              key={color}
              color={color}
              size="2"
              title={`Color ${color}`}
              description="Titre et description optionnelle"
              icon={color === "neutral" ? undefined : "＋"}
              badge={
                color === "secondary" ? (
                  <Badge tone="secondary">Badge</Badge>
                ) : undefined
              }
              selected={selected === color}
              disabled={color === "accent"}
              onClick={() => setSelected(color)}
            />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {sizes.map((size) => (
            <ButtonCard
              key={size}
              size={size}
              color="primary"
              title={`Size ${size}`}
              description="Taille tactile"
              icon="◎"
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
