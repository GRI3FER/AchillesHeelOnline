// ============================================================
// Achilles Heel Chess — Authoritative Game Engine
// ============================================================
// Rules (from spec):
//  - Standard chess movement, no King, two Queens per side
//  - Each player secretly picks an Achilles (non-pawn) before play
//  - Mirror of Achilles (by initial position) = Patroclus
//  - Patroclus captured → Achilles immune for 5 opponent moves
//  - Immortal Achilles: attacker dies instead of Achilles
//  - Both immortal clash → move cancelled, both revealed
//  - Win: capture opponent's Achilles (when not immortal)
//  - Pawn promotion:
//      Discover → reveal opp Achilles TYPE; pawn becomes that type
//      Change   → Achilles piece changes to chosen type;
//                 pawn becomes old Achilles type; Patroclus recalcs
// ============================================================

import { v4 as uuidv4 } from 'uuid';

// ─── Piece factories ──────────────────────────────────────────
function makePiece(type, color) {
  return { type, color, id: uuidv4() };
}

// ─── Initial board layout ─────────────────────────────────────
// Rows 0-1: black, Rows 6-7: white
// No king; two queens
function initialBoard() {
  const back = (c) => [
    makePiece('Rook',   c),
    makePiece('Knight', c),
    makePiece('Bishop', c),
    makePiece('Queen',  c),
    makePiece('Queen',  c),
    makePiece('Bishop', c),
    makePiece('Knight', c),
    makePiece('Rook',   c),
  ];
  const pawns = (c) => Array.from({ length: 8 }, () => makePiece('Pawn', c));
  const empty = () => Array(8).fill(null);
  return [
    back('black'),
    pawns('black'),
    empty(), empty(), empty(), empty(),
    pawns('white'),
    back('white'),
  ];
}

// ─── State factory ────────────────────────────────────────────
export function createInitialState() {
  return {
    board: initialBoard(),
    turn: 0,                                // 0=white, 1=black, etc.
    achilles:          { white: null, black: null },  // { id, row, col, type }
    patroclus:         { white: null, black: null },  // { id, row, col, type }
    immortal:          { white: false, black: false },
    immortalCountdown: { white: 0,     black: 0     },
    revealedAchilles:  { white: false, black: false },
    winner:            null,
    promotion:         null,   // { row, col, color } pending resolution
    moveLog:           [],
  };
}

// ─── Deep clone ───────────────────────────────────────────────
function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

// ─── Mirror row ───────────────────────────────────────────────
function mirrorRow(r) { return 7 - r; }

// ─── Find piece on board by ID ────────────────────────────────
function findPieceById(board, id) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.id === id) return { row: r, col: c };
  return null;
}

// ─── Sync stored row/col for achilles & patroclus ─────────────
function syncPositions(state) {
  for (const color of ['white', 'black']) {
    if (state.achilles[color]) {
      const pos = findPieceById(state.board, state.achilles[color].id);
      if (pos) {
        state.achilles[color].row = pos.row;
        state.achilles[color].col = pos.col;
      }
    }
    if (state.patroclus[color]) {
      const pos = findPieceById(state.board, state.patroclus[color].id);
      if (pos) {
        state.patroclus[color].row = pos.row;
        state.patroclus[color].col = pos.col;
      }
    }
  }
}

// ─── ID-based identity checks ─────────────────────────────────
function isAchilles(state, row, col, color) {
  const a = state.achilles[color];
  if (!a) return false;
  return state.board[row]?.[col]?.id === a.id;
}

function isPatroclus(state, row, col, color) {
  const p = state.patroclus[color];
  if (!p) return false;
  return state.board[row]?.[col]?.id === p.id;
}

// ─── Achilles selection ───────────────────────────────────────
export function setAchilles(state, color, row, col) {
  const piece = state.board[row]?.[col];
  if (!piece || piece.color !== color || piece.type === 'Pawn') return state;
  // Already chosen
  if (state.achilles[color]) return state;

  state = clone(state);
  const board = state.board;

  state.achilles[color] = { id: piece.id, row, col, type: piece.type };

  // Find Patroclus: prefer exact mirror square, else search board
  const mr = mirrorRow(row);
  let patroclus = null;
  const mirrorPiece = board[mr]?.[col];
  if (
    mirrorPiece &&
    mirrorPiece.color === color &&
    mirrorPiece.type === piece.type &&
    mirrorPiece.id !== piece.id
  ) {
    patroclus = { id: mirrorPiece.id, row: mr, col, type: mirrorPiece.type };
  } else {
    outer:
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === piece.type && p.id !== piece.id) {
          patroclus = { id: p.id, row: r, col: c, type: p.type };
          break outer;
        }
      }
    }
  }
  state.patroclus[color] = patroclus;
  return state;
}

// ─── Immortality countdown ────────────────────────────────────
// Called after mover finishes turn.
// Decrements *the opponent's* immortality counter (mover = opponent of immune player).
function tickImmortality(state, moverColor) {
  const opp = moverColor === 'white' ? 'black' : 'white';
  if (state.immortal[opp] && state.immortalCountdown[opp] > 0) {
    state.immortalCountdown[opp]--;
    if (state.immortalCountdown[opp] <= 0) {
      state.immortal[opp] = false;
      state.immortalCountdown[opp] = 0;
    }
  }
  state.turn++;
}

// ─── Apply move ───────────────────────────────────────────────
export function applyMove(state, from, to) {
  state = clone(state);
  const [fr, fc] = from;
  const [tr, tc] = to;

  if (!state.board[fr]?.[fc]) return state;
  const piece = state.board[fr][fc];
  const color = piece.color;
  const opp   = color === 'white' ? 'black' : 'white';

  // Turn check
  if (state.turn % 2 === 0 && color !== 'white') return state;
  if (state.turn % 2 === 1 && color !== 'black') return state;

  // Both Achilles must be selected
  if (!state.achilles.white || !state.achilles.black) return state;

  // Game already decided
  if (state.winner) return state;

  // Pending promotion
  if (state.promotion) return state;

  if (!isValidMove(state.board, from, to)) return state;

  const target = state.board[tr][tc];

  // ── Case A: Attacking opponent's Achilles ─────────────────
  if (target && isAchilles(state, tr, tc, opp)) {
    // Both immortal → cancel, reveal both
    if (state.immortal[color] && state.immortal[opp]) {
      state.revealedAchilles.white = true;
      state.revealedAchilles.black = true;
      state.moveLog.push({ from, to, piece, captured: null, note: 'Immortal clash — move cancelled, both revealed' });
      return state; // turn does NOT advance
    }
    // Defender immortal → attacker dies, Achilles survives
    if (state.immortal[opp]) {
      state.board[fr][fc] = null;
      state.moveLog.push({ from, to, piece, captured: null, note: 'Attacker dies — immortal Achilles survives' });
      syncPositions(state);
      tickImmortality(state, color);
      return state;
    }
    // Normal capture → attacker wins, game over
    state.board[tr][tc] = piece;
    state.board[fr][fc] = null;
    state.winner = color;
    state.moveLog.push({ from, to, piece, captured: target, note: 'Achilles captured — game over' });
    syncPositions(state);
    return state;
  }

  // ── Case B: Attacking opponent's Patroclus ────────────────
  if (target && isPatroclus(state, tr, tc, opp)) {
    // Remove Patroclus, grant immortality to opponent
    state.patroclus[opp] = null;
    state.board[tr][tc] = null;
    state.immortal[opp] = true;
    state.immortalCountdown[opp] = 5;
    // Execute attacker's move into the vacated square
    state.board[tr][tc] = piece;
    state.board[fr][fc] = null;
    state.moveLog.push({ from, to, piece, captured: target, note: `Patroclus captured — ${opp} Achilles immortal for 5 moves` });
    syncPositions(state);
    // Turn advances but do NOT tick immortality (it just started)
    state.turn++;
    return state;
  }

  // ── Case C: Normal move ───────────────────────────────────
  state.board[tr][tc] = piece;
  state.board[fr][fc] = null;
  syncPositions(state);

  // Pawn promotion check
  if (piece.type === 'Pawn' && ((color === 'white' && tr === 0) || (color === 'black' && tr === 7))) {
    state.promotion = { row: tr, col: tc, color };
    state.moveLog.push({ from, to, piece, captured: target, note: 'Promotion pending' });
    // Turn does NOT advance until promotion resolved
    return state;
  }

  state.moveLog.push({ from, to, piece, captured: target });
  tickImmortality(state, color);
  return state;
}

// ─── Promotion resolution ─────────────────────────────────────
// option: 'discover' | 'change'
// newType: piece type for 'change' option
export function handlePromotion(state, color, option, newType) {
  state = clone(state);
  if (!state.promotion || state.promotion.color !== color) return state;

  const { row, col } = state.promotion;
  const opp  = color === 'white' ? 'black' : 'white';
  const pawn = state.board[row][col];
  if (!pawn) return state;

  if (option === 'discover') {
    // Reveal opponent's Achilles TYPE (not location)
    state.revealedAchilles[opp] = true;
    const oppAchType = state.achilles[opp]?.type || 'Queen';
    // Pawn becomes the opponent's Achilles type
    state.board[row][col] = { ...pawn, type: oppAchType };
    state.moveLog.push({ from: null, to: [row, col], piece: pawn, captured: null, note: `Promotion: discovered opponent Achilles type = ${oppAchType}` });
  }

  if (option === 'change') {
    const chosenType = newType || 'Queen';
    const ach = state.achilles[color];

    if (ach) {
      const oldType = ach.type;

      // The pawn on promotion square becomes the old Achilles type
      state.board[row][col] = { ...pawn, type: oldType };

      // The Achilles piece itself changes to the chosen type
      const achPos = findPieceById(state.board, ach.id);
      if (achPos) {
        state.board[achPos.row][achPos.col] = {
          ...state.board[achPos.row][achPos.col],
          type: chosenType,
        };
      }
      state.achilles[color].type = chosenType;

      // Recalculate Patroclus: find another piece of chosenType that is NOT the Achilles
      let newPatroclus = null;
      outer:
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = state.board[r][c];
          if (p && p.color === color && p.type === chosenType && p.id !== ach.id) {
            newPatroclus = { id: p.id, row: r, col: c, type: chosenType };
            break outer;
          }
        }
      }
      state.patroclus[color] = newPatroclus;

      state.moveLog.push({ from: null, to: [row, col], piece: pawn, captured: null, note: `Promotion: Achilles changed to ${chosenType}, pawn became ${oldType}` });
    }
  }

  state.promotion = null;
  tickImmortality(state, color);
  return state;
}

// ─── Chess move validation ────────────────────────────────────
// Pure geometric/rule check — no Achilles logic
export function isValidMove(board, from, to) {
  const [fr, fc] = from;
  const [tr, tc] = to;
  if (fr === tr && fc === tc) return false;
  if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;

  const piece = board[fr]?.[fc];
  if (!piece) return false;
  const target = board[tr]?.[tc];
  if (target && target.color === piece.color) return false;

  const dr = tr - fr;
  const dc = tc - fc;

  function pathClear() {
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const sr = Math.sign(dr);
    const sc = Math.sign(dc);
    for (let i = 1; i < steps; i++) {
      if (board[fr + i * sr]?.[fc + i * sc]) return false;
    }
    return true;
  }

  switch (piece.type) {
    case 'Pawn': {
      const dir = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      if (dc === 0 && dr === dir && !target) return true;
      if (dc === 0 && dr === 2 * dir && fr === startRow && !target && !board[fr + dir]?.[fc]) return true;
      if (Math.abs(dc) === 1 && dr === dir && target && target.color !== piece.color) return true;
      return false;
    }
    case 'Knight':
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
             (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    case 'Bishop':
      return Math.abs(dr) === Math.abs(dc) && pathClear();
    case 'Rook':
      return (dr === 0 || dc === 0) && pathClear();
    case 'Queen':
      return (Math.abs(dr) === Math.abs(dc) || dr === 0 || dc === 0) && pathClear();
    default:
      return false;
  }
}

// ─── Get all legal moves for a piece ─────────────────────────
export function getLegalMoves(board, row, col) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (isValidMove(board, [row, col], [r, c]))
        moves.push([r, c]);
  return moves;
}