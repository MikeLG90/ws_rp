const net = require("net");
const crypto = require("crypto");

const host = "0.0.0.0";
const port = 8080;

let clients = [];
let handshaked = new WeakSet();

console.log(`Servidor WebSocket iniciado en ${host}:${port}`);

const server = net.createServer((socket) => {
    socket.setNoDelay(true);
    clients.push(socket);

    console.log("Nuevo cliente conectado");

    socket.on("data", (buffer) => {
        if (!handshaked.has(socket)) {
            const request = buffer.toString();
            const keyMatch = request.match(/Sec-WebSocket-Key: (.*)\r\n/);

            if (keyMatch) {
                const key = keyMatch[1].trim();
                const acceptKey = crypto.createHash("sha1")
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

        const { opcode, payload } = decodeFrame(buffer);

        if (opcode === 0x1) {
            console.log("GPS:", payload.toString());
        }

        if (opcode === 0x2) {
            console.log("Video frame:", payload.length, "bytes");
        }

        for (const c of clients) {
            if (c !== socket && handshaked.has(c)) {
                c.write(encodeFrame(opcode, payload));
            }
        }
    });

    socket.on("end", () => {
        clients = clients.filter((c) => c !== socket);
    });
    socket.on("error", () => {
        clients = clients.filter((c) => c !== socket);
    });
});

server.listen(port, host);

// --- WebSocket decode/encode --- //

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

    let mask = masked ? buffer.slice(idx, idx + 4) : null;
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
