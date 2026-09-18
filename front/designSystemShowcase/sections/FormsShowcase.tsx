import { useState } from "react";
import {
  Card,
  FormField,
  Heading,
  Input,
  SearchBar,
  Select,
  Section,
  Stack,
  Textarea,
} from "../../src/designSystem";
import { Container } from "../../src/designSystem";
export function FormsShowcase() {
  const [value, setValue] = useState("");
  const [select, setSelect] = useState("Option sélectionnée");
  return (
    <Section className="border-t border-neutral-200">
      <Container>
        <Heading as="h2" size="lg">
          Forms
        </Heading>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card variant="outlined">
            <Stack gap="md">
              <FormField id="showcase-name" label="Input">
                <Input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Votre nom"
                />
              </FormField>
              <FormField id="showcase-select" label="Select">
                <Select
                  value={select}
                  onChange={(event) => setSelect(event.target.value)}
                >
                  <option>Option sélectionnée</option>
                  <option>Autre option</option>
                </Select>
              </FormField>
              <FormField
                id="showcase-message"
                label="Textarea"
                hint="500 caractères maximum"
              >
                <Textarea placeholder="Votre message" />
              </FormField>
              <FormField
                id="showcase-required"
                label="Erreur"
                error="Ce champ est obligatoire"
              >
                <Input placeholder="Valeur requise" />
              </FormField>
            </Stack>
          </Card>
          <Card variant="outlined">
            <Stack gap="md">
              <FormField id="showcase-disabled" label="Disabled">
                <Input disabled placeholder="Indisponible" />
              </FormField>
              <FormField id="showcase-focus" label="Focus visible">
                <Input autoFocus value="Focus actif" readOnly />
              </FormField>
              <SearchBar value={value} onChange={setValue} />
            </Stack>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
