import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import { DesignSystemShowcase } from "./DesignSystemShowcase";

createRoot(document.getElementById("design-system-root")!).render(
  <StrictMode>
    <DesignSystemShowcase />
  </StrictMode>,
);
