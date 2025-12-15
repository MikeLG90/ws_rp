const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
app.use(express.json());

// ===== API REST =====
app.post("/broadcast/incidente", (req, res) => {
  const incidente = req.body;
  console.log("Incidente recibido:", incidente);
  broadcast({ event: "incidente.creado", data: incidente });
  res.json({ success: true });
});

app.post("/broadcast/asignacion-ambulancia", (req, res) => {
  const payload = req.body;
  console.log("Asignación enviada:", payload);
  broadcast(payload);
  res.json({ success: true });
});

app.post("/broadcast/incidente-actualizado", (req, res) => {
  const incidenteCompleto = req.body;

  console.log("Actualización recibida. ID:", incidenteCompleto.id);
  console.log("Datos nuevos (ejemplo):", incidenteCompleto.descripcion);
  console.log("--- ACTUALIZACIÓN COMPLETA RECIBIDA ---");
  console.dir(incidenteCompleto, { depth: null, colors: true });

  broadcast({
    event: "incidente.actualizado",
    data: incidenteCompleto
  });

  res.json({ success: true, message: "Datos actualizados enviados" });
});

// ===== HTTP SERVER =====
const server = http.createServer(app);

// ===== WEBSOCKET =====
const wss = new WebSocketServer({ server });
let clients = [];

wss.on("connection", (ws) => {
  console.log("Cliente conectado");
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});

// ===== BROADCAST =====
function broadcast(jsonData) {
  const msg = JSON.stringify(jsonData);
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(msg);
    }
  });
}

// ===== INICIO DEL WS =====
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`API REST escuchando en http://localhost:${PORT}`);
  console.log(`Servidor WebSocket activo en ws://localhost:${PORT}`);
});
