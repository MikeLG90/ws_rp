const net = require("net");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080; // 🔥 IMPORTANTE PARA AZURE

let clients = [];
let handshaked = new WeakSet();

console.log("Servidor WebSocket iniciando...");

const server = net.createServer((socket) => {
  socket.setNoDelay(true);
  clients.push(socket);
  console.log("Cliente conectado");

  socket.on("data", (buffer) => {

    // ---------- HANDSHAKE ----------
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

    // ---------- FRAME WS ----------
    const frame = decodeFrame(buffer);

    if (frame.opcode === 0x1) {
      console.log("GPS:", frame.payload.toString());
    }

    if (frame.opcode === 0x2) {
      console.log("VIDEO:", frame.payload.length, "bytes");
    }

    // ---------- BROADCAST ----------
    for (const client of clients) {
      if (client !== socket && handshaked.has(client)) {
        client.write(encodeFrame(frame.opcode, frame.payload));
      }
    }
  });

  socket.on("end", () => {
    clients = clients.filter(c => c !== socket);
    console.log("Cliente desconectado");
  });

  socket.on("error", () => {
    clients = clients.filter(c => c !== socket);
    console.log("Cliente desconectado por error");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("✅ WebSocket activo en puerto:", PORT);
});

// ----------------------
// FUNCIONES WS BINARIO
// ----------------------

function decodeFrame(buffer) {
  const opcode = buffer[0] & 0x0f;
  const masked = buffer[1] & 0x80;
  let length = buffer[1] & 0x7f;
  let idx = 2;

  if (length === 126) {
    length = buffer.readUInt16BE(2);
    idx = 4;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(2));
    idx = 10;
  }

  const mask = masked ? buffer.slice(idx, idx + 4) : null;
  idx += masked ? 4 : 0;

  const payload = buffer.slice(idx, idx + length);

  if (masked) {
    for (let i = 0; i < payload.length; i++)
      payload[i] ^= mask[i % 4];
  }

  return { opcode, payload };
}

function encodeFrame(opcode, payload) {
  const length = payload.length;
  let header;

  if (length <= 125) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length <= 65535) {
    header = Buffer.from([0x80 | opcode, 126, (length >> 8) & 255, length & 255]);
  } else {
    const len = Buffer.alloc(8);
    len.writeBigInt64BE(BigInt(length));
    header = Buffer.concat([Buffer.from([0x80 | opcode, 127]), len]);
  }

  return Buffer.concat([header, payload]);
}
