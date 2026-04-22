import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import engine from "./achillesEngine.js";

const PORT = process.env.PORT || 10000;

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("⚔ Achilles Heel backend running");
});

// IMPORTANT: single HTTP server
const server = http.createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log("⚔ Achilles Backend Running on", PORT);
});

const wss = new WebSocketServer({ server });

// ───────────────────────────────
// ROOM STORAGE
// ───────────────────────────────
const rooms = new Map();

// ───────────────────────────────
// HELPERS
// ───────────────────────────────
function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function createRoom() {
  const code = createRoomCode();

  const state = engine.createInitialState();

  rooms.set(code, {
    state,
    players: 0,
  });

  return code;
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
// WS CONNECTION
// ───────────────────────────────
wss.on("connection", (ws) => {
  console.log("CLIENT CONNECTED");

  // default sync (no room yet)
  ws.send(JSON.stringify({
    type: "sync",
    gameState: engine.createInitialState(),
    myColor: "white"
  }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const { type } = data;

      // ───────────────────────────────
      // CREATE ROOM
      // ───────────────────────────────
      if (type === "create-room") {
        const code = createRoom();

        ws.roomCode = code;
        ws.color = "white";

        const room = getRoom(code);

        ws.send(JSON.stringify({
          type: "room-created",
          roomCode: code
        }));

        ws.send(JSON.stringify({
          type: "sync",
          gameState: room.state,
          myColor: "white"
        }));

        return;
      }

      // ───────────────────────────────
      // JOIN ROOM
      // ───────────────────────────────
      if (type === "join-room") {
        const code = data.roomCode?.toUpperCase();

        const room = getRoom(code);
        if (!room) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Room not found"
          }));
          return;
        }

        ws.roomCode = code;
        ws.color = room.players === 0 ? "white" : "black";

        room.players++;

        ws.send(JSON.stringify({
          type: "sync",
          gameState: room.state,
          myColor: ws.color
        }));

        broadcastRoom(code, { type: "player-joined" });

        return;
      }

      // ───────────────────────────────
      // GAME ACTIONS
      // ───────────────────────────────
      const room = getRoom(ws.roomCode);
      if (!room) return;

      let state = room.state;

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

      room.state = state;

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