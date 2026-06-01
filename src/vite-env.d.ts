/// <reference types="vite/client" />

// Extiende las interfaces globales de Vite para variables de entorno
export {};
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_REALTIME_URL?: string;
    readonly VITE_REALTIME_MODE?: 'auto' | 'ws' | 'sse';
    readonly VITE_GOOGLE_MAPS_API_KEY?: string;
    readonly VITE_PUBLIC_FRONTEND_URL?: string;
    // otras variables de entorno si las necesitas
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
