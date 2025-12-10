// server.js - Node.js WebSocket relay
const WebSocket = require('ws');
const port = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port });
console.log('WS relay listening on port', port);

const clients = new Map(); // ws -> id

function broadcast(msg, except=null){
  const raw = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== except) {
      client.send(raw);
    }
  }
}

wss.on('connection', (ws) => {
  let myId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'join') {
        myId = msg.id;
        clients.set(ws, myId);

        // tell everyone else a new player joined
        broadcast({
          type: 'join',
          id: myId,
          x: msg.x ?? null,
          y: msg.y ?? null,
          color: msg.color ?? null
        }, ws);

        // send welcome with no peer list (simple mode)
        ws.send(JSON.stringify({
          type: 'welcome',
          id: myId,
          peers: []
        }));
      }

      else if (msg.type === 'state') {
        broadcast({
          type: 'state',
          id: msg.id,
          x: msg.x,
          y: msg.y,
          color: msg.color
        }, ws);
      }

    } catch (e) {
      console.error('bad message', e);
    }
  });

  ws.on('close', () => {
    const id = clients.get(ws);
    clients.delete(ws);
    if (id) broadcast({ type: 'leave', id });
  });
});
