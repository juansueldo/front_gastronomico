/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_REALTIME_URL?: string;
  readonly VITE_REALTIME_MODE?: 'auto' | 'ws' | 'sse';
  // otras variables de entorno si las necesitas
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
