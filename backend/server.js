import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import engine from "./achillesEngine.js";

// ----------------------------------------------------
// CONFIG
// ----------------------------------------------------
const PORT = process.env.PORT || 10000;

// ----------------------------------------------------
// EXPRESS APP
// ----------------------------------------------------
const app = express();

// Health check (Render requires stable route)
app.get("/", (req, res) => {
  res.status(200).send("⚔ Achilles Heel backend running");
});

// Optional debug route
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    port: PORT,
    time: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// HTTP SERVER (IMPORTANT FOR WS)
// ----------------------------------------------------
const server = http.createServer(app);

// ----------------------------------------------------
// WEBSOCKET SERVER
// ----------------------------------------------------
const wss = new WebSocketServer({ server });

// ----------------------------------------------------
// GAME STATE
// ----------------------------------------------------
let state = engine.createInitialState();

// ----------------------------------------------------
// BROADCAST HELPERS
// ----------------------------------------------------
function broadcast(data) {
  const msg = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

// ----------------------------------------------------
// CONNECTION HANDLER
// ----------------------------------------------------
wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  // Send initial state immediately
  ws.send(
    JSON.stringify({
      type: "init",
      state,
    })
  );

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // ---------------- MOVE ----------------
      if (data.type === "move") {
        state = engine.applyMove(state, data.from, data.to);
      }

      // ---------------- ACHILLES ----------------
      if (data.type === "achilles") {
        state = engine.setAchilles(
          state,
          data.color,
          data.row,
          data.col
        );
      }

      // ---------------- PROMOTION ----------------
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
      console.error("❌ Message error:", err);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
  });
});

// ----------------------------------------------------
// START SERVER (CRITICAL FOR RENDER)
// ----------------------------------------------------
server.listen(PORT, () => {
  console.log("==================================");
  console.log("🚀 Achilles Backend Running");
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Health: /`);
  console.log("==================================");
});