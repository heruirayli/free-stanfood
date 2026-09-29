/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly HOST_REMOVAL_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
