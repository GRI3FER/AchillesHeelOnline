import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import engine from "./achillesEngine.js";

const PORT = process.env.PORT || 10000;

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("⚔ Achilles Heel backend running");
});

const server = http.createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log("⚔ Achilles Backend Running on", PORT);
});

const wss = new WebSocketServer({ server });

const rooms = new Map();

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function createRoom() {
  const code = createRoomCode();
  const state = engine.createInitialState();
  rooms.set(code, { state, players: 0 });
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

wss.on("connection", (ws) => {
  console.log("CLIENT CONNECTED");

  ws.send(JSON.stringify({
    type: "sync",
    gameState: engine.createInitialState(),
    myColor: "white"
  }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const { type } = data;

      // ── CREATE ROOM ──
      if (type === "create-room") {
        const code = createRoom();
        ws.roomCode = code;
        ws.color = "white";
        const room = getRoom(code);
        ws.send(JSON.stringify({ type: "room-created", roomCode: code }));
        ws.send(JSON.stringify({ type: "sync", gameState: room.state, myColor: "white" }));
        return;
      }

      // ── JOIN ROOM ──
      if (type === "join-room") {
        const code = (data.roomCode || data.payload?.roomCode)?.toUpperCase();
        const room = getRoom(code);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }
        ws.roomCode = code;
        ws.color = room.players === 0 ? "white" : "black";
        room.players++;
        ws.send(JSON.stringify({ type: "sync", gameState: room.state, myColor: ws.color }));
        broadcastRoom(code, { type: "player-joined" });
        return;
      }

      // ── GAME ACTIONS ──
      const room = getRoom(ws.roomCode);
      if (!room) return;

      let state = room.state;

      if (type === "choose-achilles") {
        // Support both flat and nested payload
        const row = data.row ?? data.payload?.row;
        const col = data.col ?? data.payload?.col;
        state = engine.setAchilles(state, ws.color, row, col);
      }

      if (type === "move") {
        const from = data.from ?? data.payload?.from;
        const to   = data.to   ?? data.payload?.to;
        state = engine.applyMove(state, from, to);
      }

      if (type === "promotion") {
        const option     = data.option     ?? data.payload?.option;
        const newType    = data.newType    ?? data.payload?.newType;
        const chosenRow  = data.chosenRow  ?? data.payload?.chosenRow;
        const chosenCol  = data.chosenCol  ?? data.payload?.chosenCol;
        state = engine.handlePromotion(state, ws.color, option, newType, chosenRow, chosenCol);
      }

      room.state = state;
      broadcastRoom(ws.roomCode, { type: "sync", gameState: state });

    } catch (err) {
      console.error("WS ERROR:", err);
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
    }
  });

  ws.on("close", () => {
    if (ws.roomCode) {
      broadcastRoom(ws.roomCode, { type: "opponent-disconnected" });
    }
  });
});