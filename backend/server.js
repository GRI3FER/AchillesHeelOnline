// ============================================================
// Achilles Heel Chess — WebSocket Server
// ============================================================

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 }   from 'uuid';
import * as Engine         from './achillesEngine.js';

const PORT = process.env.PORT || 8080;
const wss  = new WebSocketServer({ port: PORT });

// rooms[roomCode] = { players: [ws, ws?], state: GameState }
const rooms = {};

// ─── Helpers ──────────────────────────────────────────────────
function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (_) {}
}

function broadcast(roomCode, obj) {
  rooms[roomCode]?.players.forEach(p => send(p, obj));
}

function colorOf(roomCode, ws) {
  const room = rooms[roomCode];
  if (!room) return null;
  const idx = room.players.indexOf(ws);
  return idx === 0 ? 'white' : idx === 1 ? 'black' : null;
}

// ─── Sanitize state for one player ────────────────────────────
// Hidden information rules:
//   • Opponent Achilles: send type ONLY if revealed (never row/col)
//   • Opponent Patroclus: never sent
//   • Immortal countdowns: never sent (only boolean)
//   • Piece IDs: stripped from board
function sanitize(state, recipientColor) {
  const opp = recipientColor === 'white' ? 'black' : 'white';

  // Strip IDs from board
  const board = state.board.map(row =>
    row.map(cell => cell ? { type: cell.type, color: cell.color } : null)
  );

  // Own Achilles with position; opponent only if revealed (type only)
  const achilles = { white: null, black: null };
  if (state.achilles[recipientColor]) {
    const a = state.achilles[recipientColor];
    achilles[recipientColor] = { row: a.row, col: a.col, type: a.type };
  }
  if (state.achilles[opp] && state.revealedAchilles[opp]) {
    achilles[opp] = { type: state.achilles[opp].type };
  }

  // Own Patroclus only
  const patroclus = { white: null, black: null };
  if (state.patroclus[recipientColor]) {
    const p = state.patroclus[recipientColor];
    patroclus[recipientColor] = { row: p.row, col: p.col, type: p.type };
  }

  // Promotion only for the relevant player
  const promotion = (state.promotion?.color === recipientColor) ? state.promotion : null;

  return {
    board,
    turn: state.turn,
    winner: state.winner,
    achilles,
    patroclus,
    immortal: {
      white: !!state.immortal.white,
      black: !!state.immortal.black,
    },
    immortalCountdown: {
      white: state.immortal.white  ? state.immortalCountdown.white  : 0,
      black: state.immortal.black  ? state.immortalCountdown.black  : 0,
    },
    revealedAchilles: state.revealedAchilles,
    promotion,
    moveLog: (state.moveLog || []).map(m => ({
      from: m.from,
      to:   m.to,
      piece: m.piece ? { type: m.piece.type, color: m.piece.color } : null,
      captured: m.captured ? { type: m.captured.type, color: m.captured.color } : null,
      note: m.note || null,
    })),
  };
}

function syncAll(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.players.forEach((ws, idx) => {
    const color = idx === 0 ? 'white' : 'black';
    send(ws, {
      type: 'sync',
      myColor: color,
      gameState: sanitize(room.state, color),
    });
  });
}

// ─── Connection handler ────────────────────────────────────────
wss.on('connection', ws => {
  ws.id = uuidv4();
  ws.roomCode = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { type, roomCode, payload } = msg;

    // ── Create room ─────────────────────────────────────────
    if (type === 'create-room') {
      let code;
      do { code = Math.random().toString(36).slice(2, 8).toUpperCase(); }
      while (rooms[code]);

      rooms[code] = {
        players: [ws],
        state:   Engine.createInitialState(),
      };
      ws.roomCode = code;
      send(ws, { type: 'room-created', roomCode: code });
      syncAll(code);
      return;
    }

    // ── Join room ────────────────────────────────────────────
    if (type === 'join-room') {
      const code = (roomCode || '').toUpperCase();
      const room = rooms[code];
      if (!room) { send(ws, { type: 'error', message: 'Room not found.' }); return; }
      if (room.players.length >= 2) { send(ws, { type: 'error', message: 'Room is full.' }); return; }
      room.players.push(ws);
      ws.roomCode = code;
      broadcast(code, { type: 'player-joined' });
      syncAll(code);
      return;
    }

    // ── Choose Achilles ──────────────────────────────────────
    if (type === 'choose-achilles') {
      const room = rooms[roomCode];
      if (!room) return;
      const color = colorOf(roomCode, ws);
      if (!color) return;
      const { row, col } = payload || {};
      if (row == null || col == null) return;
      room.state = Engine.setAchilles(room.state, color, row, col);
      syncAll(roomCode);
      return;
    }

    // ── Move ─────────────────────────────────────────────────
    if (type === 'move') {
      const room = rooms[roomCode];
      if (!room) return;
      const color = colorOf(roomCode, ws);
      if (!color) return;

      if (room.state.winner) {
        send(ws, { type: 'invalid-move', reason: 'Game already over.' });
        return;
      }
      if (room.state.promotion) {
        send(ws, { type: 'invalid-move', reason: 'Resolve promotion first.' });
        return;
      }

      const { from, to } = payload || {};
      if (!from || !to) return;

      // Basic sanity before engine call
      const piece = room.state.board[from[0]]?.[from[1]];
      if (!piece || piece.color !== color) {
        send(ws, { type: 'invalid-move', reason: 'Not your piece.' });
        return;
      }
      if (!Engine.isValidMove(room.state.board, from, to)) {
        send(ws, { type: 'invalid-move', reason: 'Illegal move.' });
        return;
      }

      const prev = room.state;
      room.state = Engine.applyMove(room.state, from, to);
      syncAll(roomCode);

      if (room.state.winner) {
        broadcast(roomCode, { type: 'game-over', winner: room.state.winner });
      }
      return;
    }

    // ── Promotion ────────────────────────────────────────────
    if (type === 'promotion') {
      const room = rooms[roomCode];
      if (!room || !room.state.promotion) return;
      const color = colorOf(roomCode, ws);
      if (!color || room.state.promotion.color !== color) return;

      const { option, newType } = payload || {};
      if (option !== 'discover' && option !== 'change') return;

      room.state = Engine.handlePromotion(room.state, color, option, newType);
      syncAll(roomCode);

      if (room.state.winner) {
        broadcast(roomCode, { type: 'game-over', winner: room.state.winner });
      }
      return;
    }

    // ── Request resync ───────────────────────────────────────
    if (type === 'request-sync') {
      const room = rooms[roomCode];
      if (!room) return;
      const color = colorOf(roomCode, ws);
      if (!color) return;
      send(ws, {
        type: 'sync',
        myColor: color,
        gameState: sanitize(room.state, color),
      });
      return;
    }
  });

  ws.on('close', () => {
    const code = ws.roomCode;
    if (!code || !rooms[code]) return;
    rooms[code].players = rooms[code].players.filter(p => p !== ws);
    if (rooms[code].players.length === 0) {
      delete rooms[code];
    } else {
      broadcast(code, { type: 'opponent-disconnected' });
    }
  });
});

console.log(`Achilles Heel Chess server running on port ${PORT}`);