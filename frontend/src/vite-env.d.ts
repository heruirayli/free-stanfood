/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly HOST_REMOVAL_EMAIL?: string;
  // True in the static build (GitHub Pages), where there's no API.
  readonly STATIC_DATA?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
