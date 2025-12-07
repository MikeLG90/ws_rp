const net = require("net");
const crypto = require("crypto");
const express = require("express");
const http = require("http");

// -------------------------
//   PANEL ADMIN (Express)
// -------------------------
const app = express();
app.use(express.static("public"));

let serverHTTP = http.createServer(app);

// Endpoint para estadísticas
let stats = {
    clients: 0,
    lastMessages: []
};

app.get("/stats", (req, res) => {
    res.json(stats);
});

app.get("/admin", (req, res) => {
    res.sendFile(__dirname + "/public/admin.html");
});

// -------------------------
//   WEBSOCKET NATIVO
// -------------------------
let clients = [];
let handshaked = new WeakSet();

const wsServer = net.createServer((socket) => {
    socket.setNoDelay(true);
    socket.setEncoding("binary");

    clients.push(socket);
    stats.clients = clients.length;

    console.log("Cliente conectado");

    socket.on("data", (buffer) => {
        // Handshake
        if (!handshaked.has(socket)) {
            const request = buffer.toString();
            const keyMatch = request.match(/Sec-WebSocket-Key: (.*)\r\n/);

            if (keyMatch) {
                const key = keyMatch[1].trim();
                const acceptKey = crypto
                    .createHash("sha1")
                    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
                    .digest("base64");

                socket.write(
                    "HTTP/1.1 101 Switching Protocols\r\n" +
                    "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n" +
                    `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
                );

                handshaked.add(socket);
                console.log("Handshake completado");
            }
            return;
        }

        // Frame WebSocket decodificado
        const message = unmask(Buffer.from(buffer, "binary"));

        // Registrar solo los últimos 10 mensajes
        stats.lastMessages.unshift(message.slice(0, 120));
        stats.lastMessages = stats.lastMessages.slice(0, 10);

        // Identificar si es JSON (GPS) o binario/video
        let parsed;
        try {
            parsed = JSON.parse(message);
            console.log("GPS:", parsed);
        } catch {
            console.log("Frame VIDEO/BINARIO recibido (" + message.length + " bytes)");
        }

        // Reenviar a otros clientes
        for (const client of clients) {
            if (client !== socket && handshaked.has(client)) {
                client.write(mask(message));
            }
        }
    });

    socket.on("end", () => {
        clients = clients.filter(c => c !== socket);
        stats.clients = clients.length;
        console.log("Cliente desconectado");
    });

    socket.on("error", () => {
        clients = clients.filter(c => c !== socket);
        stats.clients = clients.length;
        console.log("Error: cliente desconectado");
    });
});

// ------------------------
//  INICIAR SERVIDORES
// ------------------------
const PORT_WS = 8080;
const PORT_HTTP = 3000;

wsServer.listen(PORT_WS, "0.0.0.0", () => {
    console.log("WebSocket en puerto:", PORT_WS);
});

serverHTTP.listen(PORT_HTTP, () => {
    console.log("Panel admin → http://localhost:" + PORT_HTTP + "/admin");
});

// ------------------------
// Funciones WS
// ------------------------
function unmask(buffer) {
    const secondByte = buffer[1];
    let length = secondByte & 127;
    let maskStart = 2;
    let dataStart = 6;

    if (length === 126) {
        maskStart = 4;
        dataStart = 8;
    } else if (length === 127) {
        maskStart = 10;
        dataStart = 14;
    }

    const masks = buffer.slice(maskStart, maskStart + 4);
    const data = buffer.slice(dataStart);
    const result = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ masks[i % 4];
    }

    return result.toString();
}

function mask(text) {
    const payload = Buffer.from(text);
    const length = payload.length;
    let header;

    if (length <= 125) {
        header = Buffer.from([0x81, length]);
    } else if (length <= 65535) {
        header = Buffer.from([0x81, 126, (length >> 8) & 255, length & 255]);
    } else {
        const lenBuffer = Buffer.alloc(8);
        lenBuffer.writeBigUInt64BE(BigInt(length));
        header = Buffer.concat([Buffer.from([0x81, 127]), lenBuffer]);
    }

    return Buffer.concat([header, payload]);
}
