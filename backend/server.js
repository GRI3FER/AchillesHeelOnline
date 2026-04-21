import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import engine from "./achillesEngine.js";

// -------------------------
// CONFIG
// -------------------------
const PORT = process.env.PORT || 3000;

// -------------------------
// EXPRESS APP (IMPORTANT)
// -------------------------
const app = express();

// Optional: health check route (Render likes this)
app.get("/", (req, res) => {
  res.send("Achilles Heel backend running ⚔");
});

// -------------------------
// HTTP SERVER
// -------------------------
const server = http.createServer(app);

// -------------------------
// WEBSOCKET SERVER
// -------------------------
const wss = new WebSocketServer({ server });

// -------------------------
// GAME STATE
// -------------------------
let state = engine.createInitialState();

// -------------------------
// BROADCAST
// -------------------------
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

// -------------------------
// CONNECTIONS
// -------------------------
wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.send(
    JSON.stringify({
      type: "init",
      state,
    })
  );

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "move") {
        state = engine.applyMove(state, data.from, data.to);
      }

      if (data.type === "achilles") {
        state = engine.setAchilles(
          state,
          data.color,
          data.row,
          data.col
        );
      }

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

// -------------------------
// START SERVER (RENDER SAFE)
// -------------------------
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});