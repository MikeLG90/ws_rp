const net = require("net");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;

let clients = [];
let handshaked = new WeakSet();

const server = net.createServer(socket => {
  clients.push(socket);

  socket.on("data", buffer => {

    if (!handshaked.has(socket)) {
      const req = buffer.toString();
      const keyMatch = req.match(/Sec-WebSocket-Key: (.*)\r\n/);

      if (keyMatch) {
        const key = keyMatch[1].trim();
        const accept = crypto
          .createHash("sha1")
          .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
          .digest("base64");

        const res =
          "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`;

        socket.write(res);
        handshaked.add(socket);
        console.log("Handshake OK");
      }
      return;
    }

    // Reenviar todo a todos
    for (const client of clients) {
      if (client !== socket && handshaked.has(client)) {
        client.write(buffer);
      }
    }
  });

  socket.on("close", () => {
    clients = clients.filter(c => c !== socket);
  });

  socket.on("error", () => {
    clients = clients.filter(c => c !== socket);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("✅ WebSocket activo en puerto:", PORT);
});
