// ============================================================
// Achilles Heel Chess — Authoritative Game Engine
// ============================================================
//
// DESIGN PRINCIPLES
// -----------------
// 1. All piece identity is tracked by a stable UUID assigned
//    at board creation and carried through every move/clone.
//    This solves the "Achilles moves → ID lost" problem completely.
//
// 2. isAchilles / isPatroclus always look up by ID, never by
//    row/col.  Row/col on the stored achilles/patroclus objects
//    are kept as a UI convenience but are NOT used for combat
//    resolution.
//
// 3. Patroclus is the piece whose ID was stored at Achilles-
//    selection time as the mirror counterpart.  It does NOT
//    re-calculate on every move; the identity is fixed when
//    the player chooses their Achilles.  (The only time it
//    changes is via the "change" promotion option.)
//
// 4. The board is always a plain 8×8 array of piece objects
//    (or null).  Every exported function returns a new state
//    produced by JSON deep-clone — never mutating input.
// ============================================================

import { v4 as uuidv4 } from 'uuid';

// ─── Piece factories ──────────────────────────────────────────
function makePiece(type, color) {
  return { type, color, id: uuidv4() };
}
const P = (c) => makePiece('Pawn',   c);
const R = (c) => makePiece('Rook',   c);
const N = (c) => makePiece('Knight', c);
const B = (c) => makePiece('Bishop', c);
const Q = (c) => makePiece('Queen',  c);

// ─── Initial board ────────────────────────────────────────────
// NOTE: every call produces fresh piece objects with unique IDs.
function initialBoard() {
  return [
    [ R('black'), N('black'), B('black'), Q('black'), Q('black'), B('black'), N('black'), R('black') ],
    [ P('black'), P('black'), P('black'), P('black'), P('black'), P('black'), P('black'), P('black') ],
    [ null, null, null, null, null, null, null, null ],
    [ null, null, null, null, null, null, null, null ],
    [ null, null, null, null, null, null, null, null ],
    [ null, null, null, null, null, null, null, null ],
    [ P('white'), P('white'), P('white'), P('white'), P('white'), P('white'), P('white'), P('white') ],
    [ R('white'), N('white'), B('white'), Q('white'), Q('white'), B('white'), N('white'), R('white') ],
  ];
}

// ─── State factory ────────────────────────────────────────────
export function createInitialState() {
  return {
    board: initialBoard(),
    turn: 0,                               // 0 = white's move, 1 = black's, etc.
    // achilles[color] = { id, row, col, type } | null
    achilles:  { white: null, black: null },
    // patroclus[color] = { id, row, col, type } | null
    patroclus: { white: null, black: null },
    immortal:         { white: false, black: false },
    immortalCountdown:{ white: 0,     black: 0     },
    revealedAchilles: { white: false, black: false },
    winner:    null,
    promotion: null,   // { row, col, color } while pending
    moveLog:   [],
  };
}

// ─── Deep clone ───────────────────────────────────────────────
function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

// ─── Mirror square (row 0↔7, same col) ───────────────────────
function mirrorRow(r) { return 7 - r; }

// ─── Find a piece on the board by its ID ─────────────────────
function findPieceById(board, id) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.id === id) return { row: r, col: c };
    }
  }
  return null;
}

// ─── Achilles selection ───────────────────────────────────────
// The player picks a non-Pawn piece.  Its mirror counterpart
// (same col, opposite row) becomes Patroclus IF that square
// holds a piece of the same type/color; otherwise we pick the
// nearest same-type piece (excluding the Achilles itself).
export function setAchilles(state, color, row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.color !== color || piece.type === 'Pawn') return state;

  state = clone(state);
  const board = state.board;

  // Store Achilles by ID
  state.achilles[color] = { id: piece.id, row, col, type: piece.type };

  // Find Patroclus: prefer the mirror square, then search the board
  const mr = mirrorRow(row);
  const mirrorPiece = board[mr][col];
  let patroclus = null;

  if (
    mirrorPiece &&
    mirrorPiece.color === color &&
    mirrorPiece.type === piece.type &&
    mirrorPiece.id !== piece.id
  ) {
    patroclus = { id: mirrorPiece.id, row: mr, col, type: mirrorPiece.type };
  } else {
    // Fall back: first piece of same type/color that is not Achilles
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

// ─── ID-based identity checks ─────────────────────────────────
function isAchilles(state, row, col, color) {
  const a = state.achilles[color];
  if (!a) return false;
  return state.board[row][col]?.id === a.id;
}

function isPatroclus(state, row, col, color) {
  const p = state.patroclus[color];
  if (!p) return false;
  return state.board[row][col]?.id === p.id;
}

// ─── Sync stored row/col for achilles & patroclus ─────────────
// Called after every move so the UI convenience fields stay correct.
function syncPositions(state) {
  for (const color of ['white', 'black']) {
    if (state.achilles[color]) {
      const pos = findPieceById(state.board, state.achilles[color].id);
      if (pos) { state.achilles[color].row = pos.row; state.achilles[color].col = pos.col; }
    }
    if (state.patroclus[color]) {
      const pos = findPieceById(state.board, state.patroclus[color].id);
      if (pos) { state.patroclus[color].row = pos.row; state.patroclus[color].col = pos.col; }
    }
  }
}

// ─── Immortality countdown ────────────────────────────────────
// Called after the mover finishes their turn.
// Decrements the *opponent's* immortality counter (it counts
// opponent moves remaining, not the immune player's own moves).
function decrementImmortals(state, moverColor) {
  const opp = moverColor === 'white' ? 'black' : 'white';
  if (state.immortal[opp]) {
    state.immortalCountdown[opp]--;
    if (state.immortalCountdown[opp] <= 0) {
      state.immortal[opp] = false;
      state.immortalCountdown[opp] = 0;
    }
  }
  state.turn++;
}

// ─── Apply a move ─────────────────────────────────────────────
export function applyMove(state, from, to) {
  state = clone(state);
  const [fr, fc] = from;
  const [tr, tc] = to;

  // Basic sanity
  const piece = state.board[fr][fc];
  if (!piece) return state;
  if (!isValidMove(state.board, from, to)) return state;

  const color = piece.color;
  const opp   = color === 'white' ? 'black' : 'white';

  // Turn guard
  if (state.turn % 2 === 0 && color !== 'white') return state;
  if (state.turn % 2 === 1 && color !== 'black') return state;

  // Both Achilles must be chosen before normal play
  if (!state.achilles.white || !state.achilles.black) return state;

  // Game already decided
  if (state.winner) return state;

  const target = state.board[tr][tc];

  // ── Case 1: Capturing the opponent's Achilles ──────────────
  if (target && isAchilles(state, tr, tc, opp)) {
    // Both immortal → cancel move, reveal both
    if (state.immortal[opp] && state.immortal[color]) {
      state.revealedAchilles.white = true;
      state.revealedAchilles.black = true;
      state.moveLog.push({ from, to, piece, captured: null, note: 'Immortal vs Immortal clash — move cancelled' });
      // Turn does NOT advance (the move was cancelled)
      return state;
    }

    if (state.immortal[opp]) {
      // Attacker dies; Achilles survives
      state.board[fr][fc] = null;
      state.moveLog.push({ from, to, piece, captured: null, note: 'Attacker dies — Immortal Achilles' });
      syncPositions(state);
      decrementImmortals(state, color);
      return state;
    }

    // Normal capture → attacker wins
    state.board[tr][tc] = piece;
    state.board[fr][fc] = null;
    state.winner = color;
    state.moveLog.push({ from, to, piece, captured: target, note: 'Achilles captured — game over' });
    syncPositions(state);
    return state;   // No turn increment needed; game is over
  }

  // ── Case 2: Capturing the opponent's Patroclus ────────────
  let skipDecrement = false;
  if (target && isPatroclus(state, tr, tc, opp)) {
    // Patroclus is removed; opponent gains immortality
    state.immortal[opp] = true;
    state.immortalCountdown[opp] = 5;
    state.patroclus[opp] = null;
    state.board[tr][tc] = null;   // remove Patroclus first
    state.moveLog.push({ from, to, piece, captured: target, note: 'Patroclus captured — immortality activated' });
    skipDecrement = true;
    // Now slide attacker into the vacated square below
  }

  // ── Normal move execution ─────────────────────────────────
  state.board[tr][tc] = piece;
  state.board[fr][fc] = null;
  syncPositions(state);

  // ── Pawn promotion: freeze turn until resolved ────────────
  if (piece.type === 'Pawn' && ((color === 'white' && tr === 0) || (color === 'black' && tr === 7))) {
    state.promotion = { row: tr, col: tc, color };
    if (!skipDecrement) {
      state.moveLog.push({ from, to, piece, captured: target, note: 'Promotion pending' });
    }
    // Turn intentionally NOT incremented here — handlePromotion does it
    return state;
  }

  if (!skipDecrement) {
    state.moveLog.push({ from, to, piece, captured: target });
  }

  if (skipDecrement) {
    state.turn++;   // Just advance turn; the opponent's immortality counter started fresh
  } else {
    decrementImmortals(state, color);
  }

  return state;
}

// ─── Promotion resolution ─────────────────────────────────────
// option = 'discover' | 'change'
// payload may include { newType: 'Queen'|'Rook'|'Bishop'|'Knight' }
export function handlePromotion(state, color, option, payload) {
  state = clone(state);
  if (!state.promotion) return state;

  const { row, col } = state.promotion;
  const opp = color === 'white' ? 'black' : 'white';
  const pawn = state.board[row][col];
  if (!pawn) return state;  // safety

  if (option === 'discover') {
    // Reveal the *type* of the opponent's Achilles (not location)
    state.revealedAchilles[opp] = true;
    // Promoted pawn morphs into whatever type the opponent's Achilles is
    const oppAch = state.achilles[opp];
    if (oppAch) {
      state.board[row][col] = { ...pawn, type: oppAch.type };
    }
    state.moveLog.push({ from: null, to: null, piece: pawn, captured: null, note: `Promotion: discover — opponent Achilles is ${state.achilles[opp]?.type}` });
  }

  if (option === 'change') {
    // Player promotes pawn into a chosen type AND makes it their new Achilles.
    // The pawn's existing ID is preserved so references don't break.
    const newType = payload?.newType ?? 'Queen';
    state.board[row][col] = { ...pawn, type: newType };

    // New Achilles = this promoted piece
    state.achilles[color] = { id: pawn.id, row, col, type: newType };

    // New Patroclus = mirror of new Achilles (or best available)
    const mr = mirrorRow(row);
    const mirrorPiece = state.board[mr][col];
    if (
      mirrorPiece &&
      mirrorPiece.color === color &&
      mirrorPiece.type === newType &&
      mirrorPiece.id !== pawn.id
    ) {
      state.patroclus[color] = { id: mirrorPiece.id, row: mr, col, type: newType };
    } else {
      // Search board for any same-type same-color piece
      let found = null;
      outer:
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = state.board[r][c];
          if (p && p.color === color && p.type === newType && p.id !== pawn.id) {
            found = { id: p.id, row: r, col: c, type: newType };
            break outer;
          }
        }
      }
      state.patroclus[color] = found;
    }

    state.moveLog.push({ from: null, to: null, piece: pawn, captured: null, note: `Promotion: change Achilles → ${newType}` });
  }

  state.promotion = null;
  decrementImmortals(state, color);
  return state;
}

// ─── Chess move validation ────────────────────────────────────
// Pure geometric validation — no Achilles/Patroclus logic here.
export function isValidMove(board, from, to) {
  const [fr, fc] = from;
  const [tr, tc] = to;
  if (fr === tr && fc === tc) return false;

  const piece = board[fr][fc];
  if (!piece) return false;

  const target = board[tr][tc];
  if (target && target.color === piece.color) return false;   // can't capture own piece

  // Bounds check
  if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;

  const dr = tr - fr;
  const dc = tc - fc;

  switch (piece.type) {
    case 'Pawn': {
      const dir = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      // Forward one
      if (dc === 0 && dr === dir && !target) return true;
      // Forward two from start
      if (dc === 0 && dr === 2 * dir && fr === startRow && !target && !board[fr + dir][fc]) return true;
      // Diagonal capture
      if (Math.abs(dc) === 1 && dr === dir && target && target.color !== piece.color) return true;
      return false;
    }

    case 'Knight':
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
             (Math.abs(dr) === 1 && Math.abs(dc) === 2);

    case 'Bishop': {
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      return pathClear(board, fr, fc, dr, dc);
    }

    case 'Rook': {
      if (dr !== 0 && dc !== 0) return false;
      return pathClear(board, fr, fc, dr, dc);
    }

    case 'Queen': {
      const diagonal = Math.abs(dr) === Math.abs(dc);
      const straight = dr === 0 || dc === 0;
      if (!diagonal && !straight) return false;
      return pathClear(board, fr, fc, dr, dc);
    }

    case 'King':
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;

    default:
      return false;
  }
}

// Check that all squares between (fr,fc) and destination are empty.
function pathClear(board, fr, fc, dr, dc) {
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  for (let i = 1; i < steps; i++) {
    if (board[fr + i * sr][fc + i * sc]) return false;
  }
  return true;
}