const { WebSocketServer } = require('ws'); 
const express = require("express");

const app = express();
const HTTP_PORT = 3000;

app.use(express.json());

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

function broadcast(jsonData) {
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(jsonData));
    }
  });
}


function broadcast(jsonData) {
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(jsonData));
    }
  });
}

app.listen(HTTP_PORT, () => {
    console.log(`API REST escuchando en http://localhost:${HTTP_PORT}`);
});

const wss = new WebSocketServer({ port: 8080 });
let clients = [];

wss.on('connection', (ws) => {
  console.log('Cliente conectado');
  clients.push(ws);
  
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

console.log('Servidor WebSocket activo en ws://localhost:8080');