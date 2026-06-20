import { WebSocketServer } from "ws";

export const clients = new Map();

export function initWS(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("🔌 WebSocket connected");

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);

      if (data.type === "register") {
        clients.set(data.user_id, ws);
      }
    });

    ws.on("close", () => {
      for (const [id, socket] of clients.entries()) {
        if (socket === ws) {
          clients.delete(id);
        }
      }
    });
  });
}

export function sendProgress(user_id, payload) {
  const ws = clients.get(user_id);

  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}
