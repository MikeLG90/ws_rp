const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;

let clients = [];
let handshaked = new WeakSet();
let lastMessages = [];

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    fs.readFile("./public/admin.html", (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("No se encontró admin.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } 
  else if (req.url === "/stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      clients: clients.length,
      lastMessages
    }));
  } 
  else {
    res.writeHead(404);
    res.end();
  }
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  const acceptKey = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(headers.join("\r\n") + "\r\n\r\n");
  clients.push(socket);
  handshaked.add(socket);

  socket.on("data", (buffer) => {
    const message = unmask(buffer);
    if (message) {
      lastMessages.push(message);
      if (lastMessages.length > 10) lastMessages.shift();
      console.log("Mensaje:", message);
    }

    // retransmitir
    for (const client of clients) {
      if (client !== socket) client.write(mask(message));
    }
  });

  socket.on("close", () => {
    clients = clients.filter(c => c !== socket);
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket + Panel en puerto: ${PORT}`);
});

// ===== FUNCIONES =====

function unmask(buffer) {
  const length = buffer[1] & 127;
  const mask = buffer.slice(2, 6);
  const data = buffer.slice(6);
  const result = Buffer.alloc(length);

  for (let i = 0; i < length; i++) {
    result[i] = data[i] ^ mask[i % 4];
  }

  return result.toString();
}

function mask(text) {
  const payload = Buffer.from(text);
  const length = payload.length;
  const header = Buffer.from([0x81, length]);
  return Buffer.concat([header, payload]);
}
