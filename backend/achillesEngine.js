// Achilles Heel Chess: Rule-Driven Game Engine
// Clean, consistent implementation with promotion options.

export function createInitialState() {
  return {
    board: initialBoard(),
    turn: 0,
    achilles: { white: null, black: null },
    patroclus: { white: null, black: null },
    immortal: { white: false, black: false },
    immortalCountdown: { white: 0, black: 0 },
    revealedAchilles: { white: false, black: false },
    winner: null,
    promotion: null,
    moveLog: [],
  };
}

function initialBoard() {
  return [
    [ rook('black'), knight('black'), bishop('black'), queen('black'), queen('black'), bishop('black'), knight('black'), rook('black') ],
    Array(8).fill(null).map(() => pawn('black')),
    ...Array(4).fill(Array(8).fill(null)),
    Array(8).fill(null).map(() => pawn('white')),
    [ rook('white'), knight('white'), bishop('white'), queen('white'), queen('white'), bishop('white'), knight('white'), rook('white') ],
  ];
}
function pawn(c){ return { type:"Pawn", color:c }; }
function rook(c){ return { type:"Rook", color:c }; }
function knight(c){ return { type:"Knight", color:c }; }
function bishop(c){ return { type:"Bishop", color:c }; }
function queen(c){ return { type:"Queen", color:c }; }

function mirrorSquare(r, c) { return { row: 7 - r, col: c }; }

// Find Patroclus: mirror of Achilles, must be same type if possible
function findPatroclus(board, achilles) {
  if (!achilles) return null;
  const mirror = mirrorSquare(achilles.row, achilles.col);
  // Try to find a piece of the same type at the mirror
  const piece = board[mirror.row]?.[mirror.col];
  if (piece && piece.type === achilles.type && piece.color === achilles.color) {
    return { row: mirror.row, col: mirror.col, type: piece.type, id: piece.id, color: piece.color };
  }
  // If not, search the board for another piece of the same type and color
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === achilles.type && p.color === achilles.color) {
        return { row: r, col: c, type: p.type, id: p.id, color: p.color };
      }
    }
  }
  // If none found, return null
  return null;
}

export function setAchilles(state, color, row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.color !== color || piece.type === "Pawn") return state;
  const achillesObj = { row, col, type: piece.type, id: piece.id, color: piece.color };
  const patroclusObj = findPatroclus(state.board, achillesObj);
  return {
    ...state,
    achilles: { ...state.achilles, [color]: achillesObj },
    patroclus: { ...state.patroclus, [color]: patroclusObj },
  };
}

function decrementImmortals(state, moverColor) {
  const opponent = moverColor === 'white' ? 'black' : 'white';
  if (state.immortal[opponent]) {
    state.immortalCountdown[opponent]--;
    if (state.immortalCountdown[opponent] <= 0) {
      state.immortal[opponent] = false;
      state.immortalCountdown[opponent] = 0;
    }
  }
  state.turn++;
}

export function applyMove(state, from, to) {
  state = JSON.parse(JSON.stringify(state));
  const [fr, fc] = from, [tr, tc] = to;
  const piece = state.board[fr][fc];
  if (!piece) return state;
  // Validate basic movement legality server-side
  if (!isValidMove(state.board, from, to)) return state;
  const target = state.board[tr][tc];
  const color = piece.color;
  const opponent = color === 'white' ? 'black' : 'white';

  // validate turn
  if (state.turn % 2 === 0 && color !== 'white') return state;
  if (state.turn % 2 === 1 && color !== 'black') return state;

  // require Achilles chosen
  if (!state.achilles.white || !state.achilles.black) return state;

  // Immortal vs immortal conflict when attempting to capture Achilles
  if (target && isAchilles(state, tr, tc, opponent) && state.immortal[opponent] && state.immortal[color]) {
    state.revealedAchilles.white = true;
    state.revealedAchilles.black = true;
    state.moveLog.push({ from, to, piece, captured: null, note: 'Immortal vs Immortal clash' });
    return state;
  }

  // capturing opponent Achilles (must be a capture, not just moving onto the square)
  if (target && isAchilles(state, tr, tc, opponent) && target.color === opponent) {
    if (state.immortal[opponent]) {
      // attacker dies
      state.board[fr][fc] = null;
      state.moveLog.push({ from, to, piece, captured: null, note: 'Immortal Achilles' });
      decrementImmortals(state, color);
      return state;
    } else {
      // normal capture -> win
      state.board[tr][tc] = piece;
      state.board[fr][fc] = null;
      state.winner = color;
      state.moveLog.push({ from, to, piece, captured: target, note: 'Achilles captured' });
      // End the game immediately, do not process further moves or promotion
      return state;
    }
  }

  // capturing Patroclus triggers immortality
  let skipDecrement = false;
  if (target && isPatroclus(state, tr, tc, opponent)) {
    state.immortal[opponent] = true;
    state.immortalCountdown[opponent] = 5;
    // remove captured patroclus
    state.patroclus[opponent] = null;
    state.moveLog.push({ from, to, piece, captured: target, note: 'Patroclus captured' });
    state.board[tr][tc] = null;
    // Do not decrement immortality on the same move that set it; it should last for N opponent moves
    skipDecrement = true;
  }

  // normal move
  state.board[tr][tc] = piece;
  state.board[fr][fc] = null;

  // pawn promotion: set promotion and DO NOT advance turn until handled
  if (piece.type === 'Pawn' && ((color === 'white' && tr === 0) || (color === 'black' && tr === 7))) {
    state.promotion = { row: tr, col: tc, color };
    state.moveLog.push({ from, to, piece, captured: target, note: 'Promotion pending' });
    return state;
  }

  // decay immortals and advance turn (skip decrement if Patroclus capture just occurred)
  state.moveLog.push({ from, to, piece, captured: target });
  if (skipDecrement) {
    state.turn++;
  } else {
    decrementImmortals(state, color);
  }
  return state;
}

function isAchilles(state, row, col, color) {
  const a = state.achilles[color];
  if (!a) return false;
  const piece = state.board[row][col];
  if (!piece) return false;
  // Prefer ID check if available
  if (a.id && piece.id) return a.id === piece.id;
  return a.row === row && a.col === col;
}
function isPatroclus(state, row, col, color) {
  const p = state.patroclus[color];
  if (!p) return false;
  const piece = state.board[row][col];
  if (!piece) return false;
  if (p.id && piece.id) return p.id === piece.id;
  return p.row === row && p.col === col;
}

// Promotion handling
export function handlePromotion(state, color, option, payload) {
  state = JSON.parse(JSON.stringify(state));
  if (!state.promotion) return state;
  const { row, col } = state.promotion;
  const opponent = color === 'white' ? 'black' : 'white';

  if (option === 'discover') {
    // Reveal opponent Achilles type and turn pawn into that type (if known)
    state.revealedAchilles[opponent] = true;
    const oppAch = state.achilles[opponent];
    if (oppAch) {
      state.board[row][col].type = oppAch.type;
    }
  }

  if (option === 'change') {
    // payload may include newType; if provided, set pawn to that type
    const newType = payload && payload.newType ? payload.newType : state.board[row][col].type;
    state.board[row][col].type = newType;
    // Make this piece the new Achilles for the player
    const achillesObj = { row, col, type: newType, id: state.board[row][col].id, color };
    state.achilles[color] = achillesObj;
    state.patroclus[color] = findPatroclus(state.board, achillesObj);
  }

  // clear promotion and advance turn
  state.promotion = null;
  decrementImmortals(state, color);
  return state;
}

// Basic chess move validation (ported from frontend)
export function isValidMove(board, from, to) {
  const [fr, fc] = from;
  const [tr, tc] = to;
  const piece = board[fr][fc];
  if (!piece) return false;
  if (fr === tr && fc === tc) return false;
  const target = board[tr][tc];
  if (target && target.color === piece.color) return false;
  const dr = tr - fr;
  const dc = tc - fc;
  switch (piece.type) {
    case 'Pawn': {
      const dir = piece.color === 'white' ? -1 : 1;
      if (dc === 0 && !target) {
        if (dr === dir) return true;
        if ((piece.color === 'white' && fr === 6 || piece.color === 'black' && fr === 1) && dr === 2 * dir && !board[fr + dir][fc]) return true;
      }
      if (Math.abs(dc) === 1 && dr === dir && target && target.color !== piece.color) return true;
      return false;
    }
    case 'Knight':
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    case 'Bishop': {
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      for (let i = 1; i < Math.abs(dr); i++) {
        if (board[fr + i * Math.sign(dr)][fc + i * Math.sign(dc)]) return false;
      }
      return true;
    }
    case 'Rook': {
      if (dr !== 0 && dc !== 0) return false;
      const steps = Math.max(Math.abs(dr), Math.abs(dc));
      for (let i = 1; i < steps; i++) {
        if (board[fr + (dr ? i * Math.sign(dr) : 0)][fc + (dc ? i * Math.sign(dc) : 0)]) return false;
      }
      return true;
    }
    case 'Queen': {
      if (Math.abs(dr) === Math.abs(dc)) {
        for (let i = 1; i < Math.abs(dr); i++) {
          if (board[fr + i * Math.sign(dr)][fc + i * Math.sign(dc)]) return false;
        }
        return true;
      }
      if (dr === 0 || dc === 0) {
        const steps = Math.max(Math.abs(dr), Math.abs(dc));
        for (let i = 1; i < steps; i++) {
          if (board[fr + (dr ? i * Math.sign(dr) : 0)][fc + (dc ? i * Math.sign(dc) : 0)]) return false;
        }
        return true;
      }
      return false;
    }
    case 'King':
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    default:
      return false;
  }
}
