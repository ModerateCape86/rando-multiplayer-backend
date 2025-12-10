// server.js - Node.js WebSocket relay with chat
const WebSocket = require("ws");
const port = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port });
console.log("WS relay listening on port", port);

const clients = new Map(); // ws -> id
const players = new Map(); // id -> { x, y, color }
const chatHistory = []; // { username, message } up to N messages
const MAX_CHAT_MESSAGES = 50;

function broadcast(msg, except = null) {
  const raw = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== except) {
      client.send(raw);
    }
  }
}

wss.on("connection", ws => {
  let myId = null;

  ws.on("message", data => {
    try {
      const msg = JSON.parse(data);

      // ---- Join player ----
      if (msg.type === "join") {
        myId = msg.id;
        clients.set(ws, myId);

        players.set(myId, {
          x: msg.x ?? 1500,
          y: msg.y ?? 1500,
          color: msg.color ?? "#ffffff"
        });

        broadcast({
          type: "join",
          id: myId,
          x: msg.x ?? 1500,
          y: msg.y ?? 1500,
          color: msg.color ?? "#ffffff"
        }, ws);

        ws.send(JSON.stringify({
          type: "welcome",
          id: myId,
          peers: Array.from(players.entries()).map(([id, p]) => ({
            id, x: p.x, y: p.y, color: p.color
          })),
          chat: chatHistory
        }));
      }

      // ---- Update position ----
      else if (msg.type === "state") {
        players.set(msg.id, {
          x: msg.x,
          y: msg.y,
          color: msg.color
        });
        broadcast({
          type: "state",
          id: msg.id,
          x: msg.x,
          y: msg.y,
          color: msg.color
        }, ws);
      }

      // ---- Chat message ----
      else if (msg.type === "chat") {
        if (!msg.username || !msg.message) return;
        const chatMsg = {
          username: msg.username.slice(0,20),
          message: msg.message.slice(0,100) // char limit
        };
        chatHistory.push(chatMsg);
        if (chatHistory.length > MAX_CHAT_MESSAGES) chatHistory.shift();

        broadcast({ type: "chat", ...chatMsg });
      }

    } catch (e) {
      console.error("bad message", e);
    }
  });

  ws.on("close", () => {
    const id = clients.get(ws);
    clients.delete(ws);
    if (id) {
      players.delete(id);
      broadcast({ type: "leave", id });
    }
  });
});
