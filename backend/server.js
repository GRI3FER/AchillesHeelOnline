// Achilles Heel Chess — WebSocket Server
// In-memory, room-based, for Render deployment

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as Engine from './achillesEngine.js';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// ─── In-memory rooms ─────────────────────────────────────────
// { [roomCode]: { players: WebSocket[], state: GameState } }
const rooms = {};

// ─── Broadcast helpers ────────────────────────────────────────
function broadcast(roomCode, msg) {
  const room = rooms[roomCode];
  if (!room) return;
  const json = JSON.stringify(msg);
  room.players.forEach((p) => { try { p.send(json); } catch (_) {} });
}

function sendSyncToAll(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.players.forEach((p, idx) => {
    const color = idx === 0 ? 'white' : 'black';
    sendSyncTo(p, roomCode, color);
  });
}

function sendSyncTo(ws, roomCode, colorOverride) {
  const room = rooms[roomCode];
  if (!room) return;
  const idx  = colorOverride ? (colorOverride === 'white' ? 0 : 1) : room.players.indexOf(ws);
  const color = idx === 0 ? 'white' : 'black';
  const sanitized = sanitizeForPlayer(room.state, color);
  const playersMap = {
    white: room.players[0]?.id || null,
    black: room.players[1]?.id || null,
  };
  try {
    ws.send(JSON.stringify({ type: 'sync', gameState: sanitized, myColor: color, players: playersMap }));
  } catch (_) {}
}

// ─── Sanitize state for a specific player ────────────────────
// Hidden-information rules:
//  • Opponent Achilles ID/location are NEVER sent (unless revealed)
//  • Opponent Patroclus is NEVER sent
//  • immortalCountdown is NEVER sent (only boolean)
//  • Piece IDs are stripped from the board before sending
//    (IDs are an internal tracking mechanism; the client only
//     needs type + color to render)
function sanitizeForPlayer(state, recipientColor) {
  const opp = recipientColor === 'white' ? 'black' : 'white';

  // Strip IDs from every board piece so client gets clean objects
  const board = state.board.map(row =>
    row.map(cell => cell ? { type: cell.type, color: cell.color } : null)
  );

  // Achilles visibility
  const achilles = { white: null, black: null };

  // Own Achilles: send type only (the UI highlights it on the board by position)
  if (state.achilles[recipientColor]) {
    const a = state.achilles[recipientColor];
    achilles[recipientColor] = { row: a.row, col: a.col, type: a.type };
  }
  // Opponent Achilles: only type if revealed (never location)
  if (state.achilles[opp] && state.revealedAchilles[opp]) {
    achilles[opp] = { type: state.achilles[opp].type };
  }

  // Patroclus: own only (row/col so UI can mark it)
  const patroclus = { white: null, black: null };
  if (state.patroclus[recipientColor]) {
    const p = state.patroclus[recipientColor];
    patroclus[recipientColor] = { row: p.row, col: p.col, type: p.type };
  }

  // Promotion info: only send to the player whose promotion it is
  let promotion = null;
  if (state.promotion && state.promotion.color === recipientColor) {
    promotion = { row: state.promotion.row, col: state.promotion.col, color: state.promotion.color };
  }

  return {
    board,
    turn: state.turn,
    winner: state.winner,
    achilles,
    patroclus,
    immortal: { white: !!state.immortal.white, black: !!state.immortal.black },
    revealedAchilles: state.revealedAchilles,
    promotion,
    moveLog: state.moveLog || [],
  };
}

// ─── WebSocket connection handler ─────────────────────────────
wss.on('connection', (ws) => {
  ws.id = uuidv4();

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    const { type, roomCode, payload } = data;

    // ── Create room ──────────────────────────────────────────
    if (type === 'create-room') {
      let code;
      do { code = Math.random().toString(36).substr(2, 6).toUpperCase(); }
      while (rooms[code]);

      rooms[code] = { players: [ws], state: Engine.createInitialState() };
      ws.roomCode = code;
      ws.send(JSON.stringify({ type: 'room-created', roomCode: code }));
      sendSyncTo(ws, code, 'white');
      return;
    }

    // ── Join room ────────────────────────────────────────────
    if (type === 'join-room') {
      const room = rooms[roomCode];
      if (!room || room.players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full.' }));
        return;
      }
      room.players.push(ws);
      ws.roomCode = roomCode;
      broadcast(roomCode, { type: 'player-joined', roomCode });
      sendSyncToAll(roomCode);
      return;
    }

    // ── Choose Achilles ──────────────────────────────────────
    if (type === 'choose-achilles') {
      const room = rooms[roomCode];
      if (!room) return;
      const color = room.players[0] === ws ? 'white' : 'black';
      const { row, col } = payload;
      room.state = Engine.setAchilles(room.state, color, row, col);
      sendSyncToAll(roomCode);
      return;
    }

    // ── Move ─────────────────────────────────────────────────
    if (type === 'move') {
      const room = rooms[roomCode];
      if (!room) return;

      if (room.state.winner) {
        ws.send(JSON.stringify({ type: 'invalid-move', reason: 'Game already over' }));
        return;
      }

      const { from, to } = payload;

      // Pre-validate geometry before handing to engine
      if (!Engine.isValidMove(room.state.board, from, to)) {
        ws.send(JSON.stringify({ type: 'invalid-move', reason: 'Illegal move' }));
        return;
      }

      room.state = Engine.applyMove(room.state, from, to);
      sendSyncToAll(roomCode);

      if (room.state.winner) {
        broadcast(roomCode, { type: 'game-over', winner: room.state.winner });
      }
      return;
    }

    // ── Promotion ────────────────────────────────────────────
    if (type === 'promotion') {
      const room = rooms[roomCode];
      if (!room || !room.state.promotion) return;

      const color = room.players[0] === ws ? 'white' : 'black';

      // Only the player whose promotion it is can resolve it
      if (room.state.promotion.color !== color) return;

      room.state = Engine.handlePromotion(room.state, color, payload.option, payload);
      sendSyncToAll(roomCode);
      return;
    }

    // ── Request full state resync ─────────────────────────────
    if (type === 'request-state') {
      if (!rooms[roomCode]) return;
      sendSyncTo(ws, roomCode);
      return;
    }
  });

  // ── Disconnect ───────────────────────────────────────────────
  ws.on('close', () => {
    const code = ws.roomCode;
    if (code && rooms[code]) {
      rooms[code].players = rooms[code].players.filter(p => p !== ws);
      if (rooms[code].players.length === 0) {
        delete rooms[code];
      } else {
        // Notify remaining player
        broadcast(code, { type: 'opponent-disconnected' });
      }
    }
  });
});

console.log(`Achilles Heel Chess server running on port ${PORT}`);