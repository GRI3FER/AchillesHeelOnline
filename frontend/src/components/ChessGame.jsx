import React, { useState, useRef, useEffect } from "react";
import ChessBoard from "./ChessBoard";

// ─── Constants ────────────────────────────────────────────────
const WS_URL =
  window.location.hostname === "localhost"
    ? "ws://localhost:8080"
    : "wss://achilles-heel-chess-backend.onrender.com";

const PIECE_TYPES = ["Queen", "Rook", "Bishop", "Knight"];

// ─── Button style (module scope — never after a return) ────────
const buttonStyle = {
  padding: "10px 28px",
  fontSize: 18,
  borderRadius: 10,
  border: "none",
  background: "#c90",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 8px #0001",
  transition: "background 0.2s",
};

// ─── Popup ────────────────────────────────────────────────────
function Popup({ message, onClose }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      pointerEvents: "none",
    }}>
      <div style={{
        marginTop: 40, background: "#fffbe6", color: "#222",
        border: "2px solid #c90", borderRadius: 12, padding: "18px 32px",
        fontSize: 20, fontWeight: 500, boxShadow: "0 4px 24px #0002",
        pointerEvents: "auto", minWidth: 320, textAlign: "center",
      }}>
        {message}
        <div>
          <button onClick={onClose} style={{
            marginTop: 16, padding: "6px 24px", fontSize: 16,
            borderRadius: 8, border: "none", background: "#c90",
            color: "#fff", cursor: "pointer",
          }}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─── Local chess move validator ───────────────────────────────
// Mirrors the server engine — used only for immediate UI feedback
// in local mode (server is always authoritative online).
function isValidMoveLocal(board, from, to) {
  const [fr, fc] = from;
  const [tr, tc] = to;
  if (fr === tr && fc === tc) return false;
  if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;

  const piece = board[fr][fc];
  if (!piece) return false;
  const target = board[tr][tc];
  if (target && target.color === piece.color) return false;

  const dr = tr - fr;
  const dc = tc - fc;

  function pathClear() {
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const sr = Math.sign(dr); const sc = Math.sign(dc);
    for (let i = 1; i < steps; i++) {
      if (board[fr + i * sr][fc + i * sc]) return false;
    }
    return true;
  }

  switch (piece.type) {
    case "Pawn": {
      const dir = piece.color === "white" ? -1 : 1;
      const startRow = piece.color === "white" ? 6 : 1;
      if (dc === 0 && dr === dir && !target) return true;
      if (dc === 0 && dr === 2 * dir && fr === startRow && !target && !board[fr + dir][fc]) return true;
      if (Math.abs(dc) === 1 && dr === dir && target && target.color !== piece.color) return true;
      return false;
    }
    case "Knight":
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    case "Bishop":
      return Math.abs(dr) === Math.abs(dc) && pathClear();
    case "Rook":
      return (dr === 0 || dc === 0) && pathClear();
    case "Queen":
      return (Math.abs(dr) === Math.abs(dc) || dr === 0 || dc === 0) && pathClear();
    case "King":
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    default:
      return false;
  }
}

// ─── Initial board (local mode) ───────────────────────────────
function generateInitialBoard() {
  const row = (color, types) => types.map(type => ({ type, color }));
  return [
    row("black", ["Rook","Knight","Bishop","Queen","Queen","Bishop","Knight","Rook"]),
    Array(8).fill(null).map(() => ({ type: "Pawn", color: "black" })),
    ...Array(4).fill(null).map(() => Array(8).fill(null)),
    Array(8).fill(null).map(() => ({ type: "Pawn", color: "white" })),
    row("white", ["Rook","Knight","Bishop","Queen","Queen","Bishop","Knight","Rook"]),
  ];
}

// ─── Move log renderer ────────────────────────────────────────
function MoveLog({ moves }) {
  if (!moves?.length) return null;
  return (
    <div style={{ marginTop: 16, maxHeight: 180, overflowY: "auto", background: "#f8f8f8", border: "1px solid #ccc", borderRadius: 8, padding: 8 }}>
      <b>Move Log:</b>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {moves.map((m, i) => (
          <li key={i} style={{ marginBottom: 2 }}>
            {m.from ? `${String.fromCharCode(65 + m.from[1])}${8 - m.from[0]} → ${String.fromCharCode(65 + m.to[1])}${8 - m.to[0]} ` : ""}
            {m.piece?.type} {m.captured ? `× ${m.captured.type}` : ""}
            {m.note ? <span style={{ color: "#a60" }}> ({m.note})</span> : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Promotion UI ─────────────────────────────────────────────
function PromotionPanel({ color, onChoose }) {
  const [step, setStep] = useState(null);     // null | 'change'
  const [newType, setNewType] = useState("Queen");

  return (
    <div style={{ marginBottom: 16, textAlign: "center" }}>
      <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 18 }}>
        {color[0].toUpperCase() + color.slice(1)} pawn promoted — choose:
      </div>
      {!step ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          <button onClick={() => onChoose("discover", null)} style={buttonStyle}>
            Discover Opponent's Achilles
          </button>
          <button onClick={() => setStep("change")} style={buttonStyle}>
            Change Your Achilles
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>Promote to:</label>
          <select value={newType} onChange={e => setNewType(e.target.value)} style={{ fontSize: 16, padding: "6px 10px" }}>
            {PIECE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => onChoose("change", newType)} style={buttonStyle}>Confirm</button>
          <button onClick={() => setStep(null)} style={{ ...buttonStyle, background: "#999" }}>Back</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
export default function ChessGame({ mode, onBack }) {
  // ── All hooks unconditionally at the top ───────────────────
  const ws = useRef(null);

  const [creatingRoom,    setCreatingRoom]    = useState(false);
  const [roomCode,        setRoomCode]        = useState("");
  const [inputCode,       setInputCode]       = useState("");
  const [joined,          setJoined]          = useState(false);

  // board = 8×8 array of { type, color } | null  (no IDs on client)
  const [board,           setBoard]           = useState(() => Array(8).fill(null).map(() => Array(8).fill(null)));
  const [selected,        setSelected]        = useState(null);

  // Online game state received from server
  const [game,            setGame]            = useState(null);

  // If mode is provided, use it to force local/online
  const [localMode, setLocalMode] = useState(mode === "local");
  const [localGame,       setLocalGame]       = useState(null);
  // localAchilles[color] = { row, col, type } | null
  const [localAchilles,   setLocalAchilles]   = useState({ white: null, black: null });
  const [localPromotion,  setLocalPromotion]  = useState(null);   // { row, col, color }

  // Toasts
  const [toasts,          setToasts]          = useState([]);
  // Popup
  const [popup,           setPopup]           = useState("");

  // Debug helper for local mode
  const [forceFile,       setForceFile]       = useState("a");

  // Derived
  const myColor = game?.myColor || "white";

  const needsAchilles = localMode
    ? (localAchilles.white === null || localAchilles.black === null)
    : (game ? (!game.achilles?.white || !game.achilles?.black) : false);

  // ── Toast helper ──────────────────────────────────────────
  function addToast(message, ms = 3500) {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms);
  }

  // ── WebSocket ─────────────────────────────────────────────
  function connectWS(mode, joinCode = null) {
    if (ws.current) {
      try { ws.current.close(); } catch (_) {}
    }
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      if (mode === "create") {
        socket.send(JSON.stringify({ type: "create-room" }));
      } else {
        const code = (joinCode || roomCode).toUpperCase();
        socket.send(JSON.stringify({ type: "join-room", roomCode: code }));
      }
    };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      switch (msg.type) {
        case "room-created":
          setRoomCode(msg.roomCode);
          window.history.replaceState({}, "", `?room=${msg.roomCode}`);
          setCreatingRoom(false);
          setJoined(true);
          addToast(`Room ${msg.roomCode} created — waiting for opponent`);
          break;

        case "sync":
          setGame({ ...msg.gameState, myColor: msg.myColor });
          if (msg.gameState?.board) setBoard(msg.gameState.board);
          break;

        case "player-joined":
          addToast("Opponent joined!");
          break;

        case "opponent-disconnected":
          addToast("Opponent disconnected.");
          break;

        case "invalid-move":
          addToast(`Invalid: ${msg.reason || "illegal move"}`);
          break;

        case "game-over":
          setPopup(`Game over — ${msg.winner} wins!`);
          break;

        case "error":
          addToast(msg.message || "Server error");
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {};
  }

  // ── Effects ───────────────────────────────────────────────
  // URL auto-join
  useEffect(() => {
    if (joined || localMode) return;
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    if (urlRoom?.length === 6) joinRoom(urlRoom.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Popup triggers from server state
  useEffect(() => {
    if (!game) return;
    if (game.winner) {
      setPopup(`Winner: ${game.winner[0].toUpperCase() + game.winner.slice(1)}!`);
    } else if (game.immortal?.[myColor] && game.immortalCountdown?.[myColor] === 5) {
      setPopup("Your Achilles is IMMORTAL for 5 opponent moves!");
    }
    const opp = myColor === "white" ? "black" : "white";
    if (game.immortal?.[opp] && game.immortalCountdown?.[opp] === 5) {
      setPopup("Opponent's Achilles became IMMORTAL for 5 moves!");
    }
    if (game.revealedAchilles?.[opp]) {
      setPopup(`Opponent's Achilles revealed — it's a ${game.achilles?.[opp]?.type}!`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.winner, game?.immortal, game?.revealedAchilles]);

  // ── Actions ───────────────────────────────────────────────
  function createRoom() {
    if (creatingRoom) return;
    setCreatingRoom(true);
    connectWS("create");
  }

  function joinRoom(code) {
    const room = (code || inputCode).toUpperCase();
    setRoomCode(room);
    setJoined(true);
    window.history.replaceState({}, "", `?room=${room}`);
    connectWS("join", room);
  }

  function startLocalGame() {
    const b = generateInitialBoard();
    setLocalMode(true);
    setLocalGame({ board: b, turn: 0, moveLog: [] });
    setBoard(b);
    setSelected(null);
    setGame(null);
    setLocalAchilles({ white: null, black: null });
    setLocalPromotion(null);
  }

  // ── Click handler ─────────────────────────────────────────
  function handleCellClick(row, col) {
    if (!localMode && !game) return;
    if (localMode && localPromotion) return;   // frozen during promotion

    // ── Achilles selection phase ─────────────────────────
    if (needsAchilles) {
      const turnColor = localMode
        ? (localGame.turn % 2 === 0 ? "white" : "black")
        : myColor;
      const piece = board[row][col];

      if (piece && piece.color === turnColor && piece.type !== "Pawn") {
        if (localMode) {
          // Pick Achilles; find Patroclus (mirror or search)
          const mr = 7 - row;
          const mirrorPiece = board[mr][col];
          let pat = null;
          if (mirrorPiece && mirrorPiece.color === turnColor && mirrorPiece.type === piece.type) {
            pat = { row: mr, col, type: mirrorPiece.type };
          } else {
            for (let r = 0; r < 8 && !pat; r++) {
              for (let c = 0; c < 8 && !pat; c++) {
                const p = board[r][c];
                if (p && p.color === turnColor && p.type === piece.type && !(r === row && c === col)) {
                  pat = { row: r, col: c, type: p.type };
                }
              }
            }
          }
          // Ensure Patroclus is same color as Achilles
          if (pat && board[pat.row][pat.col]?.color !== turnColor) pat = null;
          setLocalAchilles(prev => ({
            ...prev,
            [turnColor]: { row, col, type: piece.type, patroclus: pat },
          }));
          setLocalGame(g => ({ ...g, turn: g.turn + 1 }));
        } else {
          ws.current?.send(JSON.stringify({ type: "choose-achilles", roomCode, payload: { row, col } }));
        }
      }
      setSelected(null);
      return;
    }

    // ── Normal move ──────────────────────────────────────
    if (!selected) {
      if (board[row][col]) setSelected([row, col]);
      return;
    }

    const [sr, sc] = selected;
    if (sr === row && sc === col) { setSelected(null); return; }

    if (localMode) {
      if (!isValidMoveLocal(board, [sr, sc], [row, col])) { setSelected(null); return; }

      const piece  = board[sr][sc];
      const target = board[row][col];
      const nb = board.map(r => r.slice());
      nb[row][col] = nb[sr][sc];
      nb[sr][sc] = null;

      // Update local Achilles/Patroclus positions if they moved
      const newAch = { ...localAchilles };
      for (const color of ["white", "black"]) {
        const a = newAch[color];
        if (a && a.row === sr && a.col === sc) {
          newAch[color] = { ...a, row, col };
          if (a.patroclus) newAch[color].patroclus = a.patroclus; // unchanged
        }
        if (a?.patroclus && a.patroclus.row === sr && a.patroclus.col === sc) {
          newAch[color] = { ...a, patroclus: { ...a.patroclus, row, col } };
        }
      }

      // Check if move captured opponent's Achilles
      let achillesCaptured = null;
      for (const color of ["white", "black"]) {
        const opp = color === "white" ? "black" : "white";
        const ach = localAchilles[opp];
        if (ach && target && target.color === opp && target.type === ach.type && row === ach.row && col === ach.col) {
          achillesCaptured = opp;
        }
      }

      // Promotion check
      const promRow = piece.color === "white" ? 0 : 7;
      if (piece.type === "Pawn" && row === promRow) {
        setBoard(nb);
        setLocalGame(g => ({
          ...g, board: nb,
          moveLog: [...(g.moveLog || []), { from: [sr, sc], to: [row, col], piece, captured: target, note: "Promotion pending" }],
        }));
        setLocalAchilles(newAch);
        setLocalPromotion({ row, col, color: piece.color });
        setSelected(null);
        return;
      }

      setBoard(nb);
      setLocalAchilles(newAch);
      setLocalGame(g => {
        // If Achilles was captured, set winner and freeze game
        if (achillesCaptured) {
          setPopup(`Winner: ${piece.color[0].toUpperCase() + piece.color.slice(1)}! (Captured Achilles)`);
          return {
            ...g,
            board: nb,
            winner: piece.color,
            moveLog: [...(g.moveLog || []), { from: [sr, sc], to: [row, col], piece, captured: target, note: "Captured Achilles" }],
          };
        }
        return {
          ...g,
          board: nb,
          turn: g.turn + 1,
          moveLog: [...(g.moveLog || []), { from: [sr, sc], to: [row, col], piece, captured: target }],
        };
      });
      setSelected(null);
      return;
    }

    // Online move
    ws.current?.send(JSON.stringify({
      type: "move",
      roomCode,
      payload: { from: [sr, sc], to: [row, col] },
    }));
    setSelected(null);
  }

  // ── Online promotion handler ──────────────────────────────
  function handleOnlinePromotion(option, newType) {
    if (!game?.promotion) return;
    ws.current?.send(JSON.stringify({
      type: "promotion",
      roomCode,
      payload: { option, newType: newType || undefined },
    }));
  }

  // ── Local promotion handler ───────────────────────────────
  function handleLocalPromotion(option, newType) {
    if (!localPromotion || !localGame) return;
    const { row, col, color } = localPromotion;
    const opp = color === "white" ? "black" : "white";
    const nb = localGame.board.map(r => r.slice());

    if (option === "discover") {
      const oppAch = localAchilles[opp];
      if (oppAch) {
        nb[row][col] = { ...nb[row][col], type: oppAch.type };
        addToast(`Opponent's Achilles type is: ${oppAch.type}`);
      } else {
        addToast("Opponent's Achilles is not yet known.");
      }
    } else if (option === "change") {
      const chosen = newType || "Queen";
      nb[row][col] = { ...nb[row][col], type: chosen };
      // Make promoted piece new Achilles
      const mr = 7 - row;
      const mirrorPiece = nb[mr]?.[col];
      let pat = null;
      if (mirrorPiece && mirrorPiece.color === color && mirrorPiece.type === chosen) {
        pat = { row: mr, col, type: chosen };
      } else {
        for (let r = 0; r < 8 && !pat; r++) {
          for (let c = 0; c < 8 && !pat; c++) {
            const p = nb[r][c];
            if (p && p.color === color && p.type === chosen && !(r === row && c === col)) {
              pat = { row: r, col: c, type: chosen };
            }
          }
        }
      }
      // Ensure Patroclus is same color as Achilles
      if (pat && nb[pat.row][pat.col]?.color !== color) pat = null;
      setLocalAchilles(prev => ({
        ...prev,
        [color]: { row, col, type: chosen, patroclus: pat },
      }));
      addToast(`Your Achilles is now a ${chosen}`);
    }

    setBoard(nb);
    setLocalGame(g => ({ ...g, board: nb, turn: g.turn + 1 }));
    setLocalPromotion(null);
  }

  // ── Debug: force a pawn to promotion rank ─────────────────
  function forceLocalPromotion(color) {
    const row = color === "white" ? 0 : 7;
    const col = Math.max(0, Math.min(7, (forceFile || "a").toLowerCase().charCodeAt(0) - 97));
    const nb = (localGame?.board || board).map(r => r.slice());
    nb[row][col] = { type: "Pawn", color };
    setLocalGame(g => ({ ...(g || {}), board: nb }));
    setBoard(nb);
    setLocalPromotion({ row, col, color });
  }

  // ── Derived display values ────────────────────────────────
  // For ChessBoard: convert localAchilles shape to the server shape
  const localAchillesForBoard = {
    white: localAchilles.white ? { row: localAchilles.white.row, col: localAchilles.white.col, type: localAchilles.white.type } : null,
    black: localAchilles.black ? { row: localAchilles.black.row, col: localAchilles.black.col, type: localAchilles.black.type } : null,
  };
  const localPatroclusForBoard = {
    white: localAchilles.white?.patroclus || null,
    black: localAchilles.black?.patroclus || null,
  };

  // ── Render: Lobby ─────────────────────────────────────────
  if (!joined && !localMode) {
    return (
      <div style={{ padding: 40, maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button onClick={createRoom} disabled={creatingRoom} style={buttonStyle}>
            {creatingRoom ? "Creating room…" : "Create Online Game"}
          </button>
          {onBack && (
            <button onClick={onBack} style={{ ...buttonStyle, background: "#aaa", color: "#fff" }}>Back</button>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              placeholder="Room code (6 chars)"
              maxLength={6}
              style={{ flex: 1, fontSize: 18, padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc" }}
              onKeyDown={e => e.key === "Enter" && joinRoom()}
            />
            <button onClick={() => joinRoom()} style={buttonStyle}>Join</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Toasts ───────────────────────────────────────────────
  const ToastLayer = () => (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 1200, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: "#222", color: "#fff", padding: "10px 14px", borderRadius: 8, minWidth: 220, boxShadow: "0 6px 24px #0004" }}>
          {t.message}
        </div>
      ))}
    </div>
  );

  // ── Render: Local mode ────────────────────────────────────
  if (localMode && localGame) {
    const turnColor = localGame.turn % 2 === 0 ? "white" : "black";
    const statusMsg = needsAchilles
      ? `${turnColor[0].toUpperCase() + turnColor.slice(1)}: choose your Achilles piece!`
      : `${turnColor[0].toUpperCase() + turnColor.slice(1)}'s turn`;

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 600, width: "100%", maxWidth: "100vw", maxHeight: "100vh", boxSizing: "border-box", padding: 8, overflowY: "auto" }}>
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ marginBottom: 8 }}>Local Mode</h2>
          {onBack && (
            <button onClick={onBack} style={{ ...buttonStyle, background: "#aaa", color: "#fff", fontSize: 16, padding: "6px 24px" }}>Back</button>
          )}
        </div>
        <Popup message={popup} onClose={() => setPopup("")} />

        <div style={{ marginBottom: 12, fontSize: 22, fontWeight: 600 }}>{statusMsg}</div>

        {/* Debug promotion tools */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <label style={{ fontWeight: 600 }}>Debug — Force promo file:</label>
          <select value={forceFile} onChange={e => setForceFile(e.target.value)} style={{ fontSize: 16, padding: "4px 8px" }}>
            {["a","b","c","d","e","f","g","h"].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
          </select>
          <button onClick={() => forceLocalPromotion("white")} style={{ ...buttonStyle, fontSize: 14, padding: "6px 14px" }}>White Promo</button>
          <button onClick={() => forceLocalPromotion("black")} style={{ ...buttonStyle, fontSize: 14, padding: "6px 14px" }}>Black Promo</button>
        </div>

        {/* Promotion UI */}
        {localPromotion && (
          <PromotionPanel
            color={localPromotion.color}
            onChoose={(option, newType) => handleLocalPromotion(option, newType)}
          />
        )}

        <ToastLayer />
        <div style={{ width: "100%", overflowX: "auto", display: "flex", justifyContent: "center" }}>
          <ChessBoard
            board={localGame.board}
            onCellClick={handleCellClick}
            selected={selected}
            achilles={localAchillesForBoard}
            patroclus={localPatroclusForBoard}
            myColor={turnColor}
            revealedAchilles={{ white: false, black: false }}
          />
        </div>
        <MoveLog moves={localGame.moveLog} />
      </div>
    );
  }

  // ── Render: Online mode ───────────────────────────────────
  let statusMsg = "";
  if (!game) {
    statusMsg = "Connecting…";
  } else if (!game.achilles?.white || !game.achilles?.black) {
    if (!game.achilles?.[myColor]) {
      statusMsg = `${myColor[0].toUpperCase() + myColor.slice(1)}: choose your Achilles!`;
    } else {
      statusMsg = "Waiting for opponent to choose their Achilles…";
    }
  } else if (game.winner) {
    statusMsg = `Game over — ${game.winner} wins!`;
  } else {
    const turnColor = game.turn % 2 === 0 ? "white" : "black";
    statusMsg = turnColor === myColor ? "Your turn" : "Opponent's turn";
  }

  // Is it our promotion to resolve?
  const myPromotion = game?.promotion && game.promotion.color === myColor ? game.promotion : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 600, width: "100%", maxWidth: "100vw", maxHeight: "100vh", boxSizing: "border-box", padding: 8, overflowY: "auto" }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ marginBottom: 4 }}>Room: {roomCode}</h2>
        {onBack && (
          <button onClick={onBack} style={{ ...buttonStyle, background: "#aaa", color: "#fff", fontSize: 16, padding: "6px 24px" }}>Back</button>
        )}
      </div>
      <div style={{ marginBottom: 4, fontSize: 14, color: "#666" }}>You are <b>{myColor}</b></div>
      <Popup message={popup} onClose={() => setPopup("")} />

      <div style={{ marginBottom: 12, fontSize: 22, fontWeight: 600 }}>{statusMsg}</div>

      {myPromotion && (
        <PromotionPanel
          color={myColor}
          onChoose={(option, newType) => handleOnlinePromotion(option, newType)}
        />
      )}

      {/* Immortality indicator */}
      {game?.immortal && (
        <div style={{ marginBottom: 8, display: "flex", gap: 16 }}>
          {game.immortal.white && <span style={{ background: "#fffbe6", border: "1px solid #c90", borderRadius: 6, padding: "2px 10px", fontWeight: 600 }}>⚡ White IMMORTAL</span>}
          {game.immortal.black && <span style={{ background: "#e6f0ff", border: "1px solid #09c", borderRadius: 6, padding: "2px 10px", fontWeight: 600 }}>⚡ Black IMMORTAL</span>}
        </div>
      )}

      <ToastLayer />
      <div style={{ width: "100%", overflowX: "auto", display: "flex", justifyContent: "center" }}>
        <ChessBoard
          board={board}
          onCellClick={handleCellClick}
          selected={selected}
          achilles={game?.achilles}
          patroclus={game?.patroclus}
          myColor={myColor}
          revealedAchilles={game?.revealedAchilles}
        />
      </div>
      <MoveLog moves={game?.moveLog} />
    </div>
  );
}