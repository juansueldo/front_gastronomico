
  # Mobile messaging app

  This is a code bundle for Mobile messaging app. The original project is available at https://www.figma.com/design/bGbsq997WbI9crcbgPo7X8/Mobile-messaging-app.

  ## Running the code

  Run `pnpm install` to install the dependencies.

  Run `pnpm run dev` to start the development server.

  ## Android (Capacitor)

  - Build and sync native project: `pnpm run android:sync`
  - Open Android Studio: `pnpm run android:open`
  - First time only (if needed): `pnpm run android:add`

  The Capacitor configuration is in [capacitor.config.json](capacitor.config.json).

  ## Push notifications + realtime update contract

  Frontend listens push events and emits internal app events to:
  - show toast notifications,
  - update conversation list,
  - append messages in active chat.

  Expected notification `data` payload from backend (FCM):

  ```json
  {
    "conversationId": "123",
    "messageId": "msg-456",
    "content": "Hola!",
    "sender": "contact",
    "contactName": "Juan",
    "channel": "whatsapp",
    "timestamp": "2026-02-28T18:10:00.000Z"
  }
  ```

  Token registration endpoint expected by frontend:
  - `POST /devices/push/register`
  - body: `{ "token": "...", "platform": "android" }`

  ## WebSocket / SSE channel

  Frontend opens a realtime channel automatically when user is authenticated.

  Optional env vars:
  - `VITE_REALTIME_MODE=auto|ws|sse` (default: `auto`)
  - `VITE_REALTIME_URL=...` (if omitted, frontend uses:
    - WS: `${VITE_API_URL}/realtime/ws`
    - SSE: `${VITE_API_URL}/realtime/sse`)
  - `VITE_GOOGLE_MAPS_API_KEY=...` (habilita Google Maps en pedidos de delivery y validación por Geocoding API)
  - `VITE_PUBLIC_FRONTEND_URL=...` (URL publica usada para generar links de tracking de pedidos; si se omite, usa el origen actual)

  Accepted realtime payload examples:

  ```json
  {
    "type": "message.created",
    "payload": {
      "conversationId": "123",
      "messageId": "msg-456",
      "content": "Hola!",
      "sender": "contact",
      "contactName": "Juan",
      "channel": "whatsapp",
      "timestamp": "2026-02-28T18:10:00.000Z"
    }
  }
  ```

  ```json
  {
    "type": "notification",
    "payload": {
      "title": "Campaña",
      "body": "Campaña enviada correctamente"
    }
  }
  ```

  Backend templates (FastAPI + Node):
  - [guidelines/RealtimeBackendExamples.md](guidelines/RealtimeBackendExamples.md)
  
