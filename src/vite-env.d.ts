/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_REALTIME_URL?: string;
  readonly VITE_REALTIME_MODE?: 'auto' | 'ws' | 'sse';
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  // otras variables de entorno si las necesitas
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
