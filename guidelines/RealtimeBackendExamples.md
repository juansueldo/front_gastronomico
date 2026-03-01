# Realtime backend examples (compatible with frontend)

This guide shows backend templates that match the frontend contract used in:
- WS: `/realtime/ws`
- SSE: `/realtime/sse`
- Push token register: `POST /devices/push/register`

## Event payload contract

Send events with this shape:

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

Optional generic notification:

```json
{
  "type": "notification",
  "payload": {
    "title": "Campaña",
    "body": "Campaña enviada correctamente"
  }
}
```

---

## Option A: FastAPI (Python)

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
from datetime import datetime, timezone

app = FastAPI()

ws_clients: set[WebSocket] = set()
sse_queues: set[asyncio.Queue[str]] = set()

class DeviceRegister(BaseModel):
    token: str
    platform: str

@app.post("/devices/push/register")
async def register_device(payload: DeviceRegister):
    # TODO: persist token + platform + user_id in DB
    return {"ok": True}

@app.websocket("/realtime/ws")
async def realtime_ws(websocket: WebSocket):
    await websocket.accept()
    ws_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive / optional inbound
    except WebSocketDisconnect:
        pass
    finally:
        ws_clients.discard(websocket)

@app.get("/realtime/sse")
async def realtime_sse(request: Request):
    queue: asyncio.Queue[str] = asyncio.Queue()
    sse_queues.add(queue)

    async def event_stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                data = await queue.get()
                yield f"data: {data}\n\n"
        finally:
            sse_queues.discard(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

async def publish_event(event: dict):
    data = json.dumps(event)

    # WS broadcast
    stale = []
    for client in ws_clients:
        try:
            await client.send_text(data)
        except Exception:
            stale.append(client)
    for client in stale:
        ws_clients.discard(client)

    # SSE broadcast
    for queue in list(sse_queues):
        await queue.put(data)

@app.post("/debug/send-message")
async def debug_send_message():
    event = {
        "type": "message.created",
        "payload": {
            "conversationId": "123",
            "messageId": f"msg-{int(datetime.now().timestamp())}",
            "content": "Mensaje desde backend FastAPI",
            "sender": "contact",
            "contactName": "Juan",
            "channel": "whatsapp",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }
    await publish_event(event)
    return {"ok": True}
```

---

## Option B: Node.js + Express (JavaScript)

```js
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const wsClients = new Set();
const sseClients = new Set();

app.post('/devices/push/register', (req, res) => {
  const { token, platform } = req.body;
  // TODO: persist token + platform + user_id in DB
  res.json({ ok: true, token, platform });
});

app.get('/realtime/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

function publishEvent(event) {
  const data = JSON.stringify(event);

  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(data);
  }

  for (const res of sseClients) {
    res.write(`data: ${data}\n\n`);
  }
}

app.post('/debug/send-message', (_req, res) => {
  publishEvent({
    type: 'message.created',
    payload: {
      conversationId: '123',
      messageId: `msg-${Date.now()}`,
      content: 'Mensaje desde backend Node',
      sender: 'contact',
      contactName: 'Juan',
      channel: 'whatsapp',
      timestamp: new Date().toISOString(),
    },
  });

  res.json({ ok: true });
});

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/realtime/ws')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wsClients.add(ws);
      ws.on('close', () => wsClients.delete(ws));
    });
    return;
  }
  socket.destroy();
});

server.listen(8000, () => {
  console.log('Backend listening on http://localhost:8000');
});
```

---

## Push notification backend note

After storing device tokens from `POST /devices/push/register`, your backend can:
1. Save incoming message in DB.
2. Publish realtime event (`message.created`) to WS/SSE.
3. Send push (FCM/APNs) to offline devices.

This gives in-app live updates + push fallback.
