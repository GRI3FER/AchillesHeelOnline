import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import engine from "./achillesEngine.js";

const PORT = process.env.PORT || 10000;

const app = express();

// ───────────────────────────────
// BASIC ROUTE
// ───────────────────────────────
app.get("/", (req, res) => {
  res.status(200).send("⚔ Achilles Heel backend running");
});

// ───────────────────────────────
// CREATE HTTP SERVER (IMPORTANT)
// ───────────────────────────────
const server = http.createServer(app);

// ONLY ONE LISTEN CALL (FIX)
server.listen(PORT, "0.0.0.0", () => {
  console.log("⚔ Achilles Backend Running on", PORT);
});

// ───────────────────────────────
// WEBSOCKET SERVER
// ───────────────────────────────
const wss = new WebSocketServer({ server });

// ───────────────────────────────
// HEARTBEAT (Render keep-alive)
// ───────────────────────────────
setInterval(() => {
  console.log("heartbeat", Date.now());
}, 30000);

// ───────────────────────────────
// ROOM STORAGE
// ───────────────────────────────
const rooms = new Map();

function getRoom(code) {
  if (!code) return null;
  if (!rooms.has(code)) {
    rooms.set(code, engine.createInitialState());
  }
  return rooms.get(code);
}

function setRoom(code, state) {
  rooms.set(code, state);
}

function broadcastRoom(code, data) {
  const msg = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.roomCode === code) {
      client.send(msg);
    }
  });
}

// ───────────────────────────────
// CONNECTION HANDLER
// ───────────────────────────────
wss.on("connection", (ws) => {
  console.log("CLIENT CONNECTED");

  ws.send(JSON.stringify({
    type: "sync",
    gameState: {
      board: engine.createInitialState(),
      turn: 0,
      achilles: { white: null, black: null },
      patroclus: { white: null, black: null },
      immortal: { white: false, black: false },
      immortalCountdown: { white: 0, black: 0 },
      revealedAchilles: { white: false, black: false },
      moveLog: []
    },
    myColor: "white"
  }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const { type } = data;

      const roomCode = data.roomCode || ws.roomCode;
      if (roomCode) ws.roomCode = roomCode;

      let state = getRoom(ws.roomCode);
      if (!state) return;

      // ───────── ROOM MGMT ─────────

      if (type === "create-room") {
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();

        ws.roomCode = code;
        ws.color = "white";

        setRoom(code, engine.createInitialState());

        ws.send(JSON.stringify({
          type: "room-created",
          roomCode: code
        }));

        ws.send(JSON.stringify({
          type: "sync",
          gameState: getRoom(code),
          myColor: "white"
        }));

        return;
      }

      if (type === "join-room") {
        const code = data.roomCode;

        ws.roomCode = code;
        ws.color = "black";

        state = getRoom(code);

        ws.send(JSON.stringify({
          type: "sync",
          gameState: state,
          myColor: "black"
        }));

        broadcastRoom(code, { type: "player-joined" });

        return;
      }

      // ───────── GAME ACTIONS ─────────

      if (type === "choose-achilles") {
        state = engine.setAchilles(state, ws.color, data.row, data.col);
      }

      if (type === "move") {
        state = engine.applyMove(state, data.from, data.to);
      }

      if (type === "promotion") {
        state = engine.handlePromotion(
          state,
          ws.color,
          data.option,
          data.newType,
          data.chosenRow,
          data.chosenCol
        );
      }

      setRoom(ws.roomCode, state);

      broadcastRoom(ws.roomCode, {
        type: "sync",
        gameState: state
      });

    } catch (err) {
      console.error("WS ERROR:", err);
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message"
      }));
    }
  });
});