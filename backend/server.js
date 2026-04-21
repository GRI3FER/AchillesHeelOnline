import http from "http";
import { WebSocketServer } from "ws";
import engine from "./achillesEngine.js";

const PORT = process.env.PORT || 10000;

const server = http.createServer();
const wss = new WebSocketServer({ server });

// ----------------------------
// ROOM STORAGE
// ----------------------------
const rooms = {}; 
// { roomCode: { players: [ws, ws], state, colors: Map(ws->color) } }

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastRoom(room, data) {
  room.players.forEach((p) => send(p, data));
}

// ----------------------------
// CONNECTIONS
// ----------------------------
wss.on("connection", (ws) => {
  ws.roomCode = null;
  ws.color = null;

  // ----------------------------
  // MESSAGE HANDLER
  // ----------------------------
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());

    // ============================
    // CREATE ROOM
    // ============================
    if (msg.type === "create-room") {
      const code = makeRoomCode();

      const state = engine.createInitialState();

      rooms[code] = {
        players: [ws],
        state,
        colors: new Map(),
      };

      ws.roomCode = code;
      ws.color = "white";
      rooms[code].colors.set(ws, "white");

      send(ws, {
        type: "room-created",
        roomCode: code,
      });

      send(ws, {
        type: "sync",
        gameState: state,
        myColor: "white",
      });

      return;
    }

    // ============================
    // JOIN ROOM
    // ============================
    if (msg.type === "join-room") {
      const room = rooms[msg.roomCode];

      if (!room || room.players.length >= 2) {
        send(ws, { type: "error", message: "Room full or does not exist" });
        return;
      }

      room.players.push(ws);
      ws.roomCode = msg.roomCode;
      ws.color = "black";
      room.colors.set(ws, "black");

      send(ws, {
        type: "player-joined",
      });

      // sync both players
      room.players.forEach((p) => {
        send(p, {
          type: "sync",
          gameState: room.state,
          myColor: room.colors.get(p),
        });
      });

      return;
    }

    // get room
    const room = rooms[ws.roomCode];
    if (!room) return;

    // ============================
    // MOVE
    // ============================
    if (msg.type === "move") {
      try {
        room.state = engine.applyMove(
          room.state,
          msg.payload.from,
          msg.payload.to
        );
      } catch (e) {
        send(ws, { type: "invalid-move", reason: e.message });
        return;
      }
    }

    // ============================
    // CHOOSE ACHILLES
    // ============================
    if (msg.type === "choose-achilles") {
      const { row, col } = msg.payload;
      const color = ws.color;

      room.state = engine.setAchilles(room.state, color, row, col);
    }

    // ============================
    // PROMOTION
    // ============================
    if (msg.type === "promotion") {
      room.state = engine.handlePromotion(
        room.state,
        msg.payload?.color || ws.color,
        msg.payload.option,
        msg.payload.newType,
        msg.payload.chosenRow,
        msg.payload.chosenCol
      );
    }

    // ============================
    // BROADCAST UPDATE
    // ============================
    broadcastRoom(room, {
      type: "sync",
      gameState: room.state,
    });

    // optional win check
    if (room.state.winner) {
      broadcastRoom(room, {
        type: "game-over",
        winner: room.state.winner,
      });
    }
  });

  // ----------------------------
  // DISCONNECT
  // ----------------------------
  ws.on("close", () => {
    const code = ws.roomCode;
    if (!code || !rooms[code]) return;

    const room = rooms[code];
    room.players = room.players.filter((p) => p !== ws);

    if (room.players.length === 0) {
      delete rooms[code];
    } else {
      broadcastRoom(room, {
        type: "opponent-disconnected",
      });
    }
  });
});

// ----------------------------
// START SERVER
// ----------------------------
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});