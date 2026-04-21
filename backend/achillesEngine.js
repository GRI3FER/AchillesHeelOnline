// ============================================================
// Achilles Heel Chess — Authoritative Game Engine
// ============================================================
// Rules:
//  - Standard chess movement, no King, two Queens per side
//  - Each player secretly picks an Achilles (non-pawn) before play
//  - Mirror of Achilles (by initial position) = Patroclus
//  - Patroclus captured → Achilles immune for 5 opponent moves
//  - Immortal Achilles: attacker dies instead of Achilles
//  - Exception: if the ATTACKER is also their own Achilles, they die and lose
//  - Both immortal clash → move cancelled, both revealed
//  - Win: capture opponent's Achilles (when not immortal)
//        OR your own Achilles is killed attacking an immortal Achilles (you lose)
//  - Pawn promotion:
//      Discover → reveal opp Achilles TYPE; pawn becomes that type
//      Change   → player clicks a piece to make it new Achilles;
//                 pawn becomes old Achilles type; Patroclus recalcs
// ============================================================

import { v4 as uuidv4 } from 'uuid';

function makePiece(type, color) {
  return { type, color, id: uuidv4() };
}

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

export function createInitialState() {
  return {
    board: initialBoard(),
    turn: 0,
    achilles:          { white: null, black: null },
    patroclus:         { white: null, black: null },
    immortal:          { white: false, black: false },
    immortalCountdown: { white: 0,     black: 0     },
    revealedAchilles:  { white: false, black: false },
    winner:            null,
    promotion:         null,
    moveLog:           [],
  };
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

function mirrorRow(r) { return 7 - r; }

function findPieceById(board, id) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.id === id) return { row: r, col: c };
  return null;
}

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

export function setAchilles(state, color, row, col) {
  const piece = state.board[row]?.[col];
  if (!piece || piece.color !== color || piece.type === 'Pawn') return state;
  if (state.achilles[color]) return state;

  state = clone(state);
  const board = state.board;

  state.achilles[color] = { id: piece.id, row, col, type: piece.type };

  const mr = mirrorRow(row);
  let patroclus = null;
  const mirrorPiece = board[mr]?.[col];
  if (
    mirrorPiece &&
    mirrorPiece.color === color &&
    mirrorPiece.type  === piece.type &&
    mirrorPiece.id    !== piece.id
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

export function applyMove(state, from, to) {
  state = clone(state);
  const [fr, fc] = from;
  const [tr, tc] = to;

  if (!state.board[fr]?.[fc]) return state;
  const piece = state.board[fr][fc];
  const color = piece.color;
  const opp   = color === 'white' ? 'black' : 'white';

  if (state.turn % 2 === 0 && color !== 'white') return state;
  if (state.turn % 2 === 1 && color !== 'black') return state;
  if (!state.achilles.white || !state.achilles.black) return state;
  if (state.winner) return state;
  if (state.promotion) return state;
  if (!isValidMove(state.board, from, to)) return state;

  const target = state.board[tr][tc];
  const attackerIsOwnAchilles = isAchilles(state, fr, fc, color);

  // ── Case A: Attacking opponent's Achilles ─────────────────
  if (target && isAchilles(state, tr, tc, opp)) {

    // Both immortal → cancel, reveal both. Turn does NOT advance, immortality does NOT tick.
    if (state.immortal[color] && state.immortal[opp]) {
      state.revealedAchilles.white = true;
      state.revealedAchilles.black = true;
      state.moveLog.push({ from, to, piece, captured: null,
        note: '⚔ Immortal Clash — move cancelled, both Achilles revealed' });
      return state;
    }

    // Defender immortal → attacker dies, Achilles STAYS on board untouched
    if (state.immortal[opp]) {
      state.board[fr][fc] = null;
      // If the attacker was THEIR OWN Achilles → they lose
      if (attackerIsOwnAchilles) {
        state.winner = opp;
        state.moveLog.push({ from, to, piece, captured: null,
          note: `⚔ Your Achilles charged into an immortal shield and perished — ${opp} wins!` });
        // Tick before returning so immortality counter is accurate in final state
        tickImmortality(state, color);
        syncPositions(state);
        return state;
      }
      state.moveLog.push({ from, to, piece, captured: null,
        note: `Attacker dies — ${opp} Achilles is immortal` });
      syncPositions(state);
      tickImmortality(state, color);
      return state;
    }

    // Normal capture → attacker wins
    state.board[tr][tc] = piece;
    state.board[fr][fc] = null;
    state.winner = color;
    state.moveLog.push({ from, to, piece, captured: target,
      note: '⚔ Achilles slain — the war is over' });
    syncPositions(state);
    return state;
  }

  // ── Case B: Attacking opponent's Patroclus ────────────────
  if (target && isPatroclus(state, tr, tc, opp)) {
    state.patroclus[opp] = null;
    state.board[tr][tc] = null;
    state.immortal[opp] = true;
    state.immortalCountdown[opp] = 5;
    state.board[tr][tc] = piece;
    state.board[fr][fc] = null;
    state.moveLog.push({ from, to, piece, captured: target,
      note: `Patroclus slain — ${opp} Achilles immortal for 5 moves` });
    syncPositions(state);
    state.turn++;
    return state;
  }

  // ── Case C: Normal move ───────────────────────────────────
  state.board[tr][tc] = piece;
  state.board[fr][fc] = null;
  syncPositions(state);

  if (piece.type === 'Pawn' &&
    ((color === 'white' && tr === 0) || (color === 'black' && tr === 7))) {
    state.promotion = { row: tr, col: tc, color };
    state.moveLog.push({ from, to, piece, captured: target, note: 'Promotion pending' });
    return state;
  }

  state.moveLog.push({ from, to, piece, captured: target });
  tickImmortality(state, color);
  return state;
}

// ─── Promotion resolution ─────────────────────────────────────
// option: 'discover' | 'change'
// For 'change': chosenRow + chosenCol = the piece the player clicked to become new Achilles
export function handlePromotion(state, color, option, newType, chosenRow, chosenCol) {
  state = clone(state);
  if (!state.promotion || state.promotion.color !== color) return state;

  const { row, col } = state.promotion;
  const opp  = color === 'white' ? 'black' : 'white';
  const pawn = state.board[row][col];
  if (!pawn) return state;

  if (option === 'discover') {
    state.revealedAchilles[opp] = true;
    const oppAchType = state.achilles[opp]?.type || 'Queen';
    state.board[row][col] = { ...pawn, type: oppAchType };
    state.moveLog.push({ from: null, to: [row, col], piece: pawn, captured: null,
      note: `Discover: enemy Achilles is a ${oppAchType}` });
  }

  if (option === 'change') {
    const ach = state.achilles[color];
    if (!ach) {
      state.board[row][col] = { ...pawn, type: newType || 'Queen' };
    } else {
      const oldType = ach.type;
      // Pawn → old Achilles type
      state.board[row][col] = { ...pawn, type: oldType };

      // Determine what piece becomes the new Achilles
      let newAchPiece = null;
      let newAchPos   = null;

      // If player clicked a specific piece (chosenRow/chosenCol), use that
      if (chosenRow != null && chosenCol != null) {
        const candidate = state.board[chosenRow]?.[chosenCol];
        if (candidate && candidate.color === color && candidate.type !== 'Pawn' && candidate.id !== pawn.id) {
          newAchPiece = candidate;
          newAchPos   = { row: chosenRow, col: chosenCol };
        }
      }

      // Fallback: newType param (old behavior)
      if (!newAchPiece && newType) {
        const achPos = findPieceById(state.board, ach.id);
        if (achPos) {
          state.board[achPos.row][achPos.col] = { ...state.board[achPos.row][achPos.col], type: newType };
          newAchPiece = state.board[achPos.row][achPos.col];
          newAchPos   = achPos;
        }
      }

      if (newAchPiece && newAchPos) {
        state.achilles[color] = { id: newAchPiece.id, row: newAchPos.row, col: newAchPos.col, type: newAchPiece.type };

        // Recalculate Patroclus: another piece of same type as new Achilles, not the Achilles
        let newPatroclus = null;
        outer:
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (p && p.color === color && p.type === newAchPiece.type && p.id !== newAchPiece.id) {
              newPatroclus = { id: p.id, row: r, col: c, type: newAchPiece.type };
              break outer;
            }
          }
        }
        state.patroclus[color] = newPatroclus;
        state.moveLog.push({ from: null, to: [row, col], piece: pawn, captured: null,
          note: `Promotion: ${newAchPiece.type} crowned as new Achilles, pawn → ${oldType}` });
      } else {
        state.moveLog.push({ from: null, to: [row, col], piece: pawn, captured: null,
          note: `Promotion: pawn → ${oldType}` });
      }
    }
  }

  state.promotion = null;
  tickImmortality(state, color);
  return state;
}

// ─── Chess move validation ────────────────────────────────────
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

export function getLegalMoves(board, row, col) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (isValidMove(board, [row, col], [r, c]))
        moves.push([r, c]);
  return moves;
}