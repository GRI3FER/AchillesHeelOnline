import http from "http";
import { WebSocketServer } from "ws";
import engine from "./achillesEngine.js";

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
// CREATE SERVER (FIXED for Render)
// ------------------------------------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Achilles server running");
});

// Attach WebSocket server to HTTP server
const wss = new WebSocketServer({ server });

// IMPORTANT: Fix WebSocket upgrade handling on Render
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// ------------------------------------------------------------
// GAME STATE
// ------------------------------------------------------------
let state = engine.createInitialState();

// ------------------------------------------------------------
// BROADCAST HELPER
// ------------------------------------------------------------
function broadcast(data) {
  const msg = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

// ------------------------------------------------------------
// CONNECTION HANDLER
// ------------------------------------------------------------
wss.on("connection", (ws) => {
  console.log("Client connected");

  // Send initial state
  ws.send(
    JSON.stringify({
      type: "init",
      state,
    })
  );

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // MOVE
      if (data.type === "move") {
        state = engine.applyMove(state, data.from, data.to);
      }

      // SET ACHILLES
      if (data.type === "achilles") {
        state = engine.setAchilles(
          state,
          data.color,
          data.row,
          data.col
        );
      }

      // PROMOTION
      if (data.type === "promotion") {
        state = engine.handlePromotion(
          state,
          data.color,
          data.option,
          data.newType,
          data.chosenRow,
          data.chosenCol
        );
      }

      // BROADCAST UPDATED STATE
      broadcast({
        type: "state",
        state,
      });

    } catch (err) {
      console.error("Message error:", err);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// ------------------------------------------------------------
// START SERVER
// ------------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});