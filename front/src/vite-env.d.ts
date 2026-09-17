/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de l'API back (ex: http://localhost:3000). Absente => valeur par défaut. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
