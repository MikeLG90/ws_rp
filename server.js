const WebSocket = require("ws");
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Servir carpeta public (admin.html)
app.use(express.static("public"));

const server = app.listen(PORT, () => {
  console.log("✅ WebSocket + Panel en puerto:", PORT);
});

const wss = new WebSocket.Server({ server });

let clients = 0;
let lastMessages = [];

wss.on("connection", (ws) => {
  clients++;
  console.log("✅ Cliente conectado. Total:", clients);

  // 🔹 Enviar estado inicial al admin
  ws.send(JSON.stringify({
    type: "stats",
    clients,
    lastMessages
  }));

  ws.on("message", (msg) => {
    console.log("Mensaje:", msg.toString());

    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    lastMessages.unshift(data);
    if (lastMessages.length > 10) lastMessages.pop();

    // ✅ ENVIAR ACTUALIZACIÓN A TODOS (INCLUYE ADMIN)
    const payload = JSON.stringify({
      type: "stats",
      clients,
      lastMessages
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  ws.on("close", () => {
    clients--;
    console.log("❌ Cliente desconectado. Total:", clients);

    const payload = JSON.stringify({
      type: "stats",
      clients,
      lastMessages
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });
});
