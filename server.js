// server.js - Node.js WebSocket relay
const WebSocket = require("ws");
const port = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port });
console.log("WS relay listening on port", port);

const clients = new Map(); // ws -> id
const players = new Map(); // id -> { x, y, color }

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

      if (msg.type === "join") {
        myId = msg.id;
        clients.set(ws, myId);

        // save state
        players.set(myId, {
          x: msg.x ?? 1500,
          y: msg.y ?? 1500,
          color: msg.color ?? "#ffffff"
        });

        // notify others
        broadcast(
          {
            type: "join",
            id: myId,
            x: msg.x ?? 1500,
            y: msg.y ?? 1500,
            color: msg.color ?? "#ffffff"
          },
          ws
        );

        // send full peer list to this player
        ws.send(
          JSON.stringify({
            type: "welcome",
            id: myId,
            peers: Array.from(players.entries()).map(([id, p]) => ({
              id,
              x: p.x,
              y: p.y,
              color: p.color
            }))
          })
        );
      }

      else if (msg.type === "state") {
        // update saved
        players.set(msg.id, {
          x: msg.x,
          y: msg.y,
          color: msg.color
        });

        // broadcast to others
        broadcast(
          {
            type: "state",
            id: msg.id,
            x: msg.x,
            y: msg.y,
            color: msg.color
          },
          ws
        );
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
