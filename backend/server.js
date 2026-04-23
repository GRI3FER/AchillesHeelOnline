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

// ─────────────────────────────────────────────
// ROOMS
// ─────────────────────────────────────────────
const rooms = new Map();

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function createRoom() {
  let code;
  do {
    code = createRoomCode();
  } while (rooms.has(code));

  const state = engine.createInitialState();

  rooms.set(code, {
    state,
    players: 1,
    createdAt: Date.now()
  });

  return code;
}

// ─────────────────────────────────────────────
// 🔥 CRITICAL FIX: PER-PLAYER STATE FILTER
// ─────────────────────────────────────────────
function buildClientState(state, color) {
  return {
    ...state,

    // Only show YOUR immortal status
    immortal: {
      white: color === "white" ? state.immortal.white : false,
      black: color === "black" ? state.immortal.black : false,
    },

    // Hide opponent countdown info
    immortalCountdown: {
      white: color === "white" ? state.immortalCountdown.white : 0,
      black: color === "black" ? state.immortalCountdown.black : 0,
    }
  };
}

// ─────────────────────────────────────────────
// BROADCAST
// ─────────────────────────────────────────────
function broadcastRoom(code, data) {
  const msg = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.roomCode === code) {
      client.send(msg);
    }
  });
}

// ─────────────────────────────────────────────
// CLEANUP ROOMS
// ─────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();

  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 1000 * 60 * 60) {
      rooms.delete(code);
      console.log("Deleted stale room:", code);
    }
  }
}, 1000 * 60 * 5);

// ─────────────────────────────────────────────
// WS SERVER
// ─────────────────────────────────────────────
wss.on("connection", (ws) => {
  console.log("CLIENT CONNECTED");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const { type } = data;

      // ── CREATE ROOM ──
      if (type === "create-room") {
        const code = createRoom();
        ws.roomCode = code;
        ws.color = "white";

        const room = rooms.get(code);

        ws.send(JSON.stringify({
          type: "room-created",
          roomCode: code
        }));

        // 🔥 IMPORTANT: send sync immediately so UI doesn't hang
        ws.send(JSON.stringify({
          type: "sync",
          gameState: buildClientState(room.state, ws.color),
          myColor: ws.color
        }));

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

        if (room.players >= 2) {
          ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
          return;
        }

        ws.roomCode = code;
        ws.color = "black";
        room.players++;

        // Send joiner sync
        ws.send(JSON.stringify({
          type: "sync",
          gameState: buildClientState(room.state, ws.color),
          myColor: ws.color
        }));

        // Send creator sync
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.roomCode === code && client !== ws) {
            client.send(JSON.stringify({
              type: "sync",
              gameState: buildClientState(room.state, client.color),
              myColor: client.color
            }));
          }
        });

        broadcastRoom(code, { type: "player-joined" });
        return;
      }

      // ── GAME LOGIC ──
      const room = getRoom(ws.roomCode);
      if (!room) return;

      let state = room.state;

      if (type === "choose-achilles") {
        const row = data.row ?? data.payload?.row;
        const col = data.col ?? data.payload?.col;
        state = engine.setAchilles(state, ws.color, row, col);
      }

      if (type === "move") {
        const from = data.from ?? data.payload?.from;
        const to = data.to ?? data.payload?.to;
        state = engine.applyMove(state, from, to);
      }

      if (type === "promotion") {
        const option = data.option ?? data.payload?.option;
        const newType = data.newType ?? data.payload?.newType;
        const chosenRow = data.chosenRow ?? data.payload?.chosenRow;
        const chosenCol = data.chosenCol ?? data.payload?.chosenCol;

        state = engine.handlePromotion(
          state,
          ws.color,
          option,
          newType,
          chosenRow,
          chosenCol
        );
      }

      room.state = state;

      // ── SYNC (FILTERED PER PLAYER) ──
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.roomCode === ws.roomCode) {
          client.send(JSON.stringify({
            type: "sync",
            gameState: buildClientState(state, client.color),
            myColor: client.color
          }));
        }
      });

    } catch (err) {
      console.error("WS ERROR:", err);
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
    }
  });

  // ── DISCONNECT ──
  ws.on("close", () => {
    if (!ws.roomCode) return;

    const room = rooms.get(ws.roomCode);
    if (!room) return;

    room.players--;

    if (room.players <= 0) {
      rooms.delete(ws.roomCode);
      console.log("Deleted empty room:", ws.roomCode);
    } else {
      broadcastRoom(ws.roomCode, {
        type: "opponent-disconnected"
      });
    }
  });
});