// Achilles Heel Chess WebSocket Server
// In-memory, room-based, for Render deployment
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as Engine from './achillesEngine.js';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });


// In-memory game state: { [roomCode]: { players: [], state } }
const rooms = {};

function broadcast(roomCode, msg) {
  const room = rooms[roomCode];
  if (!room) return;
  room.players.forEach((p) => {
    try { p.send(JSON.stringify(msg)); } catch (e) {}
  });
}

function sendSyncToAll(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.players.forEach((p, idx) => {
    const color = idx === 0 ? 'white' : 'black';
    const sanitized = sanitizeGameStateForRecipient(room.state, color);
    const playersMap = { white: room.players[0]?.id || null, black: room.players[1]?.id || null };
    try { p.send(JSON.stringify({ type: 'sync', gameState: sanitized, myColor: color, players: playersMap })); } catch (e) {}
  });
}

function sendSyncTo(ws, roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  const idx = room.players.indexOf(ws);
  const color = idx === 0 ? 'white' : 'black';
  const sanitized = sanitizeGameStateForRecipient(room.state, color);
  const playersMap = { white: room.players[0]?.id || null, black: room.players[1]?.id || null };
  try { ws.send(JSON.stringify({ type: 'sync', gameState: sanitized, myColor: color, players: playersMap })); } catch (e) {}
}

function sanitizeGameStateForRecipient(state, recipientColor) {
  // Only include visible board, turn, winner, immortal booleans (no counters), and controlled achilles info.
  const other = recipientColor === 'white' ? 'black' : 'white';
  const out = {
    board: state.board,
    turn: state.turn,
    winner: state.winner,
    immortal: { white: !!state.immortal.white, black: !!state.immortal.black },
    // do not include immortalCountdown
    revealedAchilles: state.revealedAchilles || { white: false, black: false },
  };

  // Players mapping is intentionally omitted from gameState but sent separately in envelope

  // Achilles: include full info for recipient's own Achilles, include only type for opponent if revealed
  out.achilles = { white: null, black: null };
  if (state.achilles && state.achilles[recipientColor]) {
    out.achilles[recipientColor] = state.achilles[recipientColor];
  }
  if (state.achilles && state.achilles[other]) {
    if (state.revealedAchilles && state.revealedAchilles[other]) {
      // reveal only type, not location
      out.achilles[other] = { type: state.achilles[other].type };
    } else {
      out.achilles[other] = null;
    }
  }

  // Patroclus: include only for recipient's own Achilles (so UI can show mirror for their own)
  out.patroclus = { white: null, black: null };
  if (state.patroclus && state.patroclus[recipientColor]) out.patroclus[recipientColor] = state.patroclus[recipientColor];

  // Move log can be included (optional), but keep it brief
  out.moveLog = state.moveLog || [];
  return out;
}

// (stray lines removed)



wss.on('connection', (ws) => {
  // assign an id to each websocket connection
  ws.id = uuidv4();
  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }
    const { type, roomCode, payload } = data;

    if (type === 'create-room') {
      // Generate unique room code
      let code;
      do { code = Math.random().toString(36).substr(2, 6).toUpperCase(); } while (rooms[code]);
      rooms[code] = { players: [ws], state: Engine.createInitialState() };
      ws.roomCode = code;
      ws.send(JSON.stringify({ type: 'room-created', roomCode: code }));
      // send initial sync to creator with assigned color
      sendSyncTo(ws, code);
    }
    else if (type === 'join-room') {
      if (!rooms[roomCode] || rooms[roomCode].players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full.' }));
        return;
      }
      rooms[roomCode].players.push(ws);
      ws.roomCode = roomCode;
      // Notify both players
      broadcast(roomCode, { type: 'player-joined', roomCode });
      // Send full sync to both players (per-player myColor)
      sendSyncToAll(roomCode);
    }
    else if (type === 'move') {
      // { from, to }
      if (!rooms[roomCode]) return;
      const { from, to } = payload;
      const room = rooms[roomCode];
      const playerIndex = room.players.indexOf(ws);
      const color = playerIndex === 0 ? 'white' : 'black';
      if (room.state.winner) {
        ws.send(JSON.stringify({ type: 'invalid-move', reason: 'Game already over' }));
        return;
      }
      // validate move legality server-side
      if (!Engine.isValidMove(room.state.board, from, to)) {
        ws.send(JSON.stringify({ type: 'invalid-move', reason: 'Illegal move' }));
        return;
      }
      rooms[roomCode].state = Engine.applyMove(rooms[roomCode].state, from, to);
      sendSyncToAll(roomCode);
    }
    else if (type === 'choose-achilles') {
      // { row, col }
      if (!rooms[roomCode]) return;
      const color = rooms[roomCode].players[0] === ws ? 'white' : 'black';
      const { row, col } = payload;
      rooms[roomCode].state = Engine.setAchilles(rooms[roomCode].state, color, row, col);
      sendSyncToAll(roomCode);
    }
    else if (type === 'promotion') {
      // payload includes { option, row, col, newType? }
      if (!rooms[roomCode]) return;
      const color = rooms[roomCode].players[0] === ws ? 'white' : 'black';
      rooms[roomCode].state = Engine.handlePromotion(rooms[roomCode].state, color, payload.option, payload);
      sendSyncToAll(roomCode);
    }
    else if (type === 'request-state') {
      if (!rooms[roomCode]) return;
      sendSyncTo(ws, roomCode);
    }
  });

  ws.on('close', () => {
    // Remove player from room
    if (ws.roomCode && rooms[ws.roomCode]) {
      rooms[ws.roomCode].players = rooms[ws.roomCode].players.filter(p => p !== ws);
      if (rooms[ws.roomCode].players.length === 0) delete rooms[ws.roomCode];
    }
  });
});

console.log(`WebSocket server running on port ${PORT}`);
