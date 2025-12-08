// server.js
const WebSocket = require("ws");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Servir carpeta public (donde puede estar tu panel de administración/admin.html)
app.use(express.static("public"));

const server = app.listen(PORT, () => {
    console.log("✅ WebSocket + Panel en puerto:", PORT);
});

const wss = new WebSocket.Server({ server });

let clients = 0;
let lastMessages = []; // Almacena el historial para el panel de administración

wss.on("connection", (ws) => {
    clients++;
    console.log("✅ Cliente conectado. Total:", clients);

    // 🔹 Enviar estado inicial al cliente (incluye el historial y el conteo de clientes)
    ws.send(JSON.stringify({
        type: "stats",
        clients,
        lastMessages
    }));

    ws.on("message", (msg) => {
        const msgString = msg.toString();
        let data;
        
        // Intenta parsear el mensaje
        try {
            data = JSON.parse(msgString);
        } catch {
            console.log("Mensaje recibido no es JSON:", msgString);
            return; // Ignorar si no es JSON válido
        }

        // --- 1. LÓGICA DE RETRANSMISIÓN DE VIDEO (NUEVA FUNCIÓN) ---
        if (data.tipo === "video" && data.frame) {
            // Reenviar el frame de video a TODOS los demás clientes conectados
            // Esto asegura que el Receptor HTML reciba el mensaje que espera.
            wss.clients.forEach(client => {
                // Condición: Reenviar a cualquier otro cliente LISTO
                // (Se puede añadir client !== ws si quieres que el emisor no se reciba a sí mismo,
                // pero generalmente se envía a todos para simplificar)
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msgString); // ⬅️ Envía el JSON ORIGINAL del video
                }
            });
        }
        // --- FIN DE LÓGICA DE VIDEO ---

        // 2. LÓGICA DE ACTUALIZACIÓN DEL PANEL DE ADMINISTRACIÓN (FUNCIONALIDAD ANTERIOR)
        
        // Actualizar historial de mensajes
        lastMessages.unshift(data);
        if (lastMessages.length > 10) lastMessages.pop();

        // Crear payload de estadísticas
        const payloadStats = JSON.stringify({
            type: "stats", // El tipo que usa tu panel de administración
            clients,
            lastMessages
        });

        // Enviar el payload de estadísticas a TODOS los clientes
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payloadStats);
            }
        });
    });

    ws.on("close", () => {
        clients--;
        console.log("❌ Cliente desconectado. Total:", clients);

        // Actualizar estadísticas de cierre
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