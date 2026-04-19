import React, { useState, useRef, useEffect } from "react";

// Simple pop-up notification component
function Popup({ message, onClose }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      pointerEvents: 'none',
    }}>
      <div style={{
        marginTop: 40,
        background: '#fffbe6',
        color: '#222',
        border: '2px solid #c90',
        borderRadius: 12,
        padding: '18px 32px',
        fontSize: 20,
        fontWeight: 500,
        boxShadow: '0 4px 24px #0002',
        pointerEvents: 'auto',
        minWidth: 320,
        textAlign: 'center',
      }}>
        {message}
        <div>
          <button onClick={onClose} style={{ marginTop: 16, padding: '6px 24px', fontSize: 16, borderRadius: 8, border: 'none', background: '#c90', color: '#fff', cursor: 'pointer' }}>OK</button>
        </div>
      </div>
    </div>
  );
}
import ChessBoard from "./ChessBoard";

const WS_URL =
  window.location.hostname === "localhost"
    ? "ws://localhost:8080"
    : "wss://achilles-heel-chess-backend.onrender.com";

export default function ChessGame() {
  // --------------------
  // refs
  // --------------------
  const ws = useRef(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [board, setBoard] = useState(Array(8).fill(null).map(() => Array(8).fill(null)));
  const [selected, setSelected] = useState(null);
  const [game, setGame] = useState(null);
  const [localMode, setLocalMode] = useState(false);
  const [localGame, setLocalGame] = useState(null);
  const [localAchilles, setLocalAchilles] = useState({ white: null, black: null });
  const [localPromotion, setLocalPromotion] = useState(null);
  const [localPromoChoice, setLocalPromoChoice] = useState(null);
  const [localPromoNewType, setLocalPromoNewType] = useState("Queen");
  const [toasts, setToasts] = useState([]);
  const [forceFile, setForceFile] = useState("a");
  const [onlinePromoChoice, setOnlinePromoChoice] = useState(null);
  const [onlinePromoNewType, setOnlinePromoNewType] = useState("Queen");
  const [showRules, setShowRules] = useState(false);
  const [popup, setPopup] = useState("");

  // URL auto-join
  useEffect(() => {
    if (joined || localMode) return;
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    if (urlRoom && urlRoom.length === 6) {
      joinRoom(urlRoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show popups for key events (immortality, Achilles reveal, winner, etc)
  useEffect(() => {
    if (game?.winner) {
      setPopup(`Winner: ${game.winner[0].toUpperCase() + game.winner.slice(1)}!`);
    } else if (game?.immortal && game.immortal[myColor] && game.immortalCountdown?.[myColor] === 5) {
      setPopup("Your Achilles is now IMMORTAL for 5 moves!");
    } else if (game?.immortal && game.immortal[myColor === "white" ? "black" : "white"] && game.immortalCountdown?.[myColor === "white" ? "black" : "white"] === 5) {
      setPopup("Opponent's Achilles is now IMMORTAL for 5 moves!");
    } else if (game?.revealedAchilles && game.revealedAchilles[myColor === "white" ? "black" : "white"]) {
      setPopup(`You have discovered your opponent's Achilles type: ${game.achilles[myColor === "white" ? "black" : "white"].type}`);
    }
  }, [game?.winner, game?.immortal, game?.immortalCountdown, game?.revealedAchilles]);

  const myColor = game?.myColor || "white";
  const needsAchilles = localMode
    ? (localAchilles.white === null || localAchilles.black === null)
    : (game?.achilles ? !game.achilles.white || !game.achilles.black : false);
  // Basic chess move validation for local mode
  function isValidMoveLocal(board, from, to) {
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
      case "Pawn": {
        const dir = piece.color === "white" ? -1 : 1;
        // Move forward
        if (dc === 0 && !target) {
          if (dr === dir) return true;
          // First move double
          if ((piece.color === "white" && fr === 6 || piece.color === "black" && fr === 1) && dr === 2 * dir && !board[fr + dir][fc]) return true;
        }
        // Capture
        if (Math.abs(dc) === 1 && dr === dir && target && target.color !== piece.color) return true;
        return false;
      }
      case "Knight":
        return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
      case "Bishop": {
        if (Math.abs(dr) !== Math.abs(dc)) return false;
        for (let i = 1; i < Math.abs(dr); i++) {
          if (board[fr + i * Math.sign(dr)][fc + i * Math.sign(dc)]) return false;
        }
        return true;
      }
      case "Rook": {
        if (dr !== 0 && dc !== 0) return false;
        const steps = Math.max(Math.abs(dr), Math.abs(dc));
        for (let i = 1; i < steps; i++) {
          if (board[fr + (dr ? i * Math.sign(dr) : 0)][fc + (dc ? i * Math.sign(dc) : 0)]) return false;
        }
        return true;
      }
      case "Queen": {
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
      case "King":
        return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
      default:
        return false;
    }
  }

  function handleCellClick(row, col) {
    if (!localMode && !game) return;

    // ACHILLES SELECTION
    if (needsAchilles) {
      const turnColor = localMode
        ? localGame.turn % 2 === 0
          ? "white"
          : "black"
        : myColor;
      // block new moves while a local promotion is pending
      if (localMode && localPromotion) return;
      // ACHILLES SELECTION
      const piece = board[row][col];

      // Prevent pawns from being selected as Achilles (do nothing if pawn)
      if (!piece || piece.color !== turnColor || piece.type === "Pawn") {
        setSelected(null);
        return;
      }

      if (localMode) {
        setLocalAchilles((prev) => ({
          ...prev,
          [turnColor]: { row, col, type: piece.type },
        }));
        setLocalGame((g) => ({ ...g, turn: g.turn + 1 }));
      } else {
        ws.current?.send(
          JSON.stringify({
            type: "choose-achilles",
            roomCode,
            payload: { row, col },
          })
        );
      }

      setSelected(null);
      return;
    }

    // selection logic
    if (!selected) {
      if (board[row][col]) setSelected([row, col]);
      return;
    }

    const [sr, sc] = selected;

    if (sr === row && sc === col) {
      setSelected(null);
      return;
    }

    // LOCAL MOVE with validation
    if (localMode) {
      // Only allow the correct player to move
      const turnColor = localGame.turn % 2 === 0 ? "white" : "black";
      const piece = board[sr][sc];
      if (!isValidMoveLocal(board, [sr, sc], [row, col]) || piece.color !== turnColor) {
        setSelected(null);
        return;
      }
      const target = board[row][col];
      const newBoard = board.map((r) => r.slice());
      newBoard[row][col] = newBoard[sr][sc];
      newBoard[sr][sc] = null;

      // Check for Achilles capture
      const opp = turnColor === "white" ? "black" : "white";
      const ach = localAchilles[opp];
      if (ach && ach.row === row && ach.col === col) {
        setBoard(newBoard);
        setLocalGame((g) => ({
          ...g,
          board: newBoard,
          moveLog: [
            ...(g.moveLog || []),
            {
              from: [sr, sc],
              to: [row, col],
              piece,
              captured: target,
              note: "Achilles captured",
            },
          ],
          winner: turnColor,
        }));
        setPopup(`Winner: ${turnColor[0].toUpperCase() + turnColor.slice(1)}!`);
        setSelected(null);
        return;
      }

      // If this is a pawn reaching the promotion rank, set promotion and do NOT advance turn
      const promotionRow = piece.color === "white" ? 0 : 7;
      if (piece.type === "Pawn" && row === promotionRow) {
        setBoard(newBoard);
        setLocalGame((g) => ({
          ...g,
          board: newBoard,
          // do NOT increment turn until promotion resolved
          moveLog: [
            ...(g.moveLog || []),
            {
              from: [sr, sc],
              to: [row, col],
              piece,
              captured: target,
              note: "Promotion pending",
            },
          ],
        }));
        setLocalPromotion({ row, col, color: piece.color });
        setSelected(null);
        return;
      }

      // Normal local move: advance turn
      setBoard(newBoard);
      setLocalGame((g) => ({
        ...g,
        board: newBoard,
        turn: g.turn + 1,
        moveLog: [
          ...(g.moveLog || []),
          {
            from: [sr, sc],
            to: [row, col],
            piece,
            captured: target,
            note: null,
          },
        ],
      }));

      setSelected(null);
      return;
    }

    // ONLINE MOVE
    ws.current?.send(
      JSON.stringify({
        type: "move",
        roomCode,
        payload: {
          from: [sr, sc],
          to: [row, col],
          color: board[sr][sc]?.color,
        },
      })
    );


    setSelected(null);
  }

  // --------------------
  // helpers
  // --------------------
  function generateInitialBoard() {
    return [
      [
        { color: "black", type: "Rook" },
        { color: "black", type: "Knight" },
        { color: "black", type: "Bishop" },
        { color: "black", type: "Queen" },
        { color: "black", type: "Queen" },
        { color: "black", type: "Bishop" },
        { color: "black", type: "Knight" },
        { color: "black", type: "Rook" },
      ],
      Array(8)
        .fill(null)
        .map(() => ({ color: "black", type: "Pawn" })),
      ...Array(4).fill(Array(8).fill(null)),
      Array(8)
        .fill(null)
        .map(() => ({ color: "white", type: "Pawn" })),
      [
        { color: "white", type: "Rook" },
        { color: "white", type: "Knight" },
        { color: "white", type: "Bishop" },
        { color: "white", type: "Queen" },
        { color: "white", type: "Queen" },
        { color: "white", type: "Bishop" },
        { color: "white", type: "Knight" },
        { color: "white", type: "Rook" },
      ],
    ];
  }

  // Toast helper
  function addToast(message, ms = 3000) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }

  // --------------------
  // actions
  // --------------------
  // Centralized WebSocket connect + handlers
  function connectWS(mode, joinCode = null) {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      try { ws.current.close(); } catch (e) {}
    }
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen = () => {
      if (mode === 'create') {
        ws.current.send(JSON.stringify({ type: 'create-room' }));
      } else if (mode === 'join') {
        const code = (joinCode || roomCode).toUpperCase();
        ws.current.send(JSON.stringify({ type: 'join-room', roomCode: code }));
      }
    };
    ws.current.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'room-created') {
        setRoomCode(msg.roomCode);
        window.history.replaceState({}, '', `?room=${msg.roomCode}`);
        setCreatingRoom(false);
        setJoined(true);
        addToast(`Room ${msg.roomCode} created`);
        return;
      }
      if (msg.type === 'sync') {
        // attach myColor into game object for UI convenience
        setGame({ ...msg.gameState, myColor: msg.myColor });
        if (msg.gameState && msg.gameState.board) setBoard(msg.gameState.board);
        return;
      }
      if (msg.type === 'player-joined') {
        addToast('A player joined the room');
        return;
      }
      if (msg.type === 'error') {
        addToast(msg.message || 'Server error');
        return;
      }
      if (msg.type === 'invalid-move') {
        addToast(msg.reason || 'Invalid move');
        return;
      }
      if (msg.type === 'game-over') {
        addToast(`Game over: ${msg.winner}`);
        return;
      }
    };
    ws.current.onclose = () => {
      // keep joined flag until user navigates away
    };
  }
  function createRoom() {
    if (creatingRoom) return;
    setCreatingRoom(true);
    connectWS('create');
  }

  function joinRoom(code) {
    const room = (code || inputCode).toUpperCase();
    setRoomCode(room);
    setJoined(true);
    window.history.replaceState({}, "", `?room=${room}`);
    connectWS('join', room);
  }

    function startLocalGame() {
      const initialBoard = generateInitialBoard();

      setLocalMode(true);
      setLocalGame({
        board: initialBoard,
        turn: 0,
        moveLog: [],
      });

      setBoard(initialBoard);
      setSelected(null);
      setGame(null);
    }

  // (The single unified handleCellClick is defined earlier in this file and keeps move validation.)

  function handlePromotion(option, newType = null) {
    if (!game?.promotion) return;
    const payload = { ...game.promotion, option };
    if (newType) payload.newType = newType;
    ws.current?.send(JSON.stringify({ type: "promotion", roomCode, payload }));
    setOnlinePromoChoice(null);
  }

  // Local promotion handler (for localMode)
  function handleLocalPromotion(option, newType = null) {
    if (!localPromotion || !localGame) return;
    const { row, col, color } = localPromotion;
    const opp = color === "white" ? "black" : "white";
    const newBoard = localGame.board.map((r) => r.slice());

    if (option === "discover") {
      // Promoted pawn becomes the type of the opponent's Achilles, no message
      const oppLoc = localAchilles[opp];
      if (oppLoc) {
        const oppPiece = newBoard[oppLoc.row]?.[oppLoc.col];
        if (oppPiece) {
          newBoard[row][col] = { ...newBoard[row][col], type: oppPiece.type };
        }
      }
    } else if (option === "change") {
      // Pawn becomes the player's old Achilles type
      const oldAchilles = localAchilles[color];
      if (oldAchilles) {
        newBoard[row][col] = { ...newBoard[row][col], type: oldAchilles.type };
        setLocalAchilles((prev) => ({ ...prev, [color]: { row, col, type: oldAchilles.type, id: newBoard[row][col].id } }));
      }
    }

    setLocalGame((g) => ({ ...g, board: newBoard, turn: g.turn + 1 }));
    setBoard(newBoard);
    setLocalPromotion(null);
    setLocalPromoChoice(null);
  }

  // Debug helper: force a promotion scenario in local mode
  function forceLocalPromotion(color = "white") {
    const row = color === "white" ? 0 : 7;
    const col = Math.max(0, Math.min(7, (forceFile || 'a').toLowerCase().charCodeAt(0) - 97));
    const newBoard = (localGame?.board || board).map((r) => r.slice());
    newBoard[row][col] = { color, type: "Pawn" };
    setLocalGame((g) => ({ ...(g || {}), board: newBoard }));
    setBoard(newBoard);
    setLocalPromotion({ row, col, color });
  }

  // --------------------
  // UI: landing
  // --------------------
  // Always call hooks first, then return UI
  useEffect(() => {
    if (game?.winner) {
      setPopup(`Winner: ${game.winner[0].toUpperCase() + game.winner.slice(1)}!`);
    } else if (game?.immortal && game.immortal[myColor] && game.immortalCountdown?.[myColor] === 5) {
      setPopup("Your Achilles is now IMMORTAL for 5 moves!");
    } else if (game?.immortal && game.immortal[myColor === "white" ? "black" : "white"] && game.immortalCountdown?.[myColor === "white" ? "black" : "white"] === 5) {
      setPopup("Opponent's Achilles is now IMMORTAL for 5 moves!");
    } else if (game?.revealedAchilles && game.revealedAchilles[myColor === "white" ? "black" : "white"]) {
      setPopup(`You have discovered your opponent's Achilles type: ${game.achilles[myColor === "white" ? "black" : "white"].type}`);
    }
  }, [game?.winner, game?.immortal, game?.immortalCountdown, game?.revealedAchilles]);

  if (!joined && !localMode) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Chess: Achilles Heel</h1>

        <button onClick={createRoom} disabled={creatingRoom}>
          {creatingRoom ? "Creating..." : "Create Online Game"}
        </button>

        <button onClick={startLocalGame}>Play Local</button>

        <div style={{ marginTop: 20 }}>
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Room Code"
          />
          <button onClick={() => joinRoom()}>Join</button>
        </div>
      </div>
    );
  }

  // --- Move log ---
  function getMoveLog(moveLog) {
    if (!moveLog || !moveLog.length) return null;
    return (
      <div style={{ marginTop: 16, maxHeight: 180, overflowY: 'auto', background: '#f8f8f8', border: '1px solid #ccc', borderRadius: 8, padding: 8 }}>
        <b>Move Log:</b>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {moveLog.map((m, i) => (
            <li key={i} style={{ marginBottom: 2 }}>
              {String.fromCharCode(65 + m.from[1])}{8 - m.from[0]} → {String.fromCharCode(65 + m.to[1])}{8 - m.to[0]} {m.piece?.type} {m.captured ? `x ${m.captured.type}` : ''} {m.note ? <span style={{ color: '#a60' }}>({m.note})</span> : ''}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (localMode && localGame) {
    const achilles = localAchilles;
    const patroclus = (achilles.white && achilles.black)
      ? {
        white: { row: 7 - achilles.white.row, col: achilles.white.col },
        black: { row: 7 - achilles.black.row, col: achilles.black.col },
      }
      : { white: null, black: null };
    const turnColor = localGame.turn % 2 === 0 ? "white" : "black";
    const needsAchilles = achilles.white === null || achilles.black === null;
    let statusMsg = "";
    if (needsAchilles) {
      statusMsg = `${turnColor[0].toUpperCase() + turnColor.slice(1)}: Choose your Achilles!`;
    } else {
      statusMsg = `${turnColor[0].toUpperCase() + turnColor.slice(1)}'s turn`;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', minHeight: 600, justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Local Mode</h2>
          <Popup message={popup} onClose={() => setPopup("")} />
          {/* Turn/Achilles status */}
          <div style={{
            marginBottom: 12,
            fontSize: 22,
            fontWeight: 600,
            color: needsAchilles ? (turnColor === 'white' ? '#c90' : '#09c') : '#333',
            letterSpacing: 0.5,
            textShadow: '0 1px 0 #fff, 0 2px 8px #0001',
          }}>{statusMsg}</div>
          {/* Promotion UI */}
          {localPromotion ? (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 18 }}>
                {localPromotion.color[0].toUpperCase() + localPromotion.color.slice(1)} pawn reached the end — choose promotion:
              </div>
              {!localPromoChoice ? (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <button onClick={() => handleLocalPromotion("discover")} style={buttonStyle}>Discover Opponent's Achilles</button>
                  <button onClick={() => setLocalPromoChoice('change')} style={buttonStyle}>Change Your Achilles</button>
                </div>
              ) : localPromoChoice === 'change' ? (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
                  <label style={{ fontWeight: 600 }}>Promote to:</label>
                  <select value={localPromoNewType} onChange={(e) => setLocalPromoNewType(e.target.value)} style={{ fontSize: 16, padding: '6px 10px' }}>
                    {['Queen','Rook','Bishop','Knight'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={() => handleLocalPromotion('change', localPromoNewType)} style={buttonStyle}>Confirm</button>
                  <button onClick={() => setLocalPromoChoice(null)} style={{ ...buttonStyle, background: '#999' }}>Cancel</button>
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Toasts */}
          <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {toasts.map((t) => (
              <div key={t.id} style={{ background: '#222', color: '#fff', padding: '10px 14px', borderRadius: 8, minWidth: 200, boxShadow: '0 6px 24px #0004' }}>{t.message}</div>
            ))}
          </div>
          <ChessBoard
            board={localGame.board}
            onCellClick={handleCellClick}
            selected={selected}
            achilles={achilles}
            patroclus={patroclus}
          />
        </div>
        <div style={{ marginLeft: 32, minWidth: 260, maxWidth: 320 }}>{getMoveLog(localGame.moveLog)}</div>
      </div>
    );
  }

  // --------------------
  // UI: online
  // --------------------
  // Online mode: show whose turn and Achilles selection status
  let onlineStatusMsg = "";
  if (game?.achilles && (!game.achilles.white || !game.achilles.black)) {
    if (!game.achilles.white && myColor === 'white') {
      onlineStatusMsg = "White: Choose your Achilles!";
    } else if (!game.achilles.black && myColor === 'black') {
      onlineStatusMsg = "Black: Choose your Achilles!";
    } else if (!game.achilles.white) {
      onlineStatusMsg = "Waiting for White to choose Achilles...";
    } else if (!game.achilles.black) {
      onlineStatusMsg = "Waiting for Black to choose Achilles...";
    }
  } else if (game?.turn !== undefined) {
    const turnColor = game.turn % 2 === 0 ? "white" : "black";
    onlineStatusMsg = `${turnColor[0].toUpperCase() + turnColor.slice(1)}'s turn`;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', minHeight: 600, justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Room: {roomCode}</h2>
        <Popup message={popup} onClose={() => setPopup("")} />
        {/* Turn/Achilles status */}
        {onlineStatusMsg && (
          <div style={{
            marginBottom: 12,
            fontSize: 22,
            fontWeight: 600,
            color: onlineStatusMsg.includes('White') ? '#c90' : onlineStatusMsg.includes('Black') ? '#09c' : '#333',
            letterSpacing: 0.5,
            textShadow: '0 1px 0 #fff, 0 2px 8px #0001',
          }}>{onlineStatusMsg}</div>
        )}
        {/* Promotion UI */}
        {game?.promotion && game.promotion.color === myColor && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16, alignItems: 'center' }}>
            <button onClick={() => handlePromotion("discover")} style={buttonStyle}>Discover Achilles</button>
            {!onlinePromoChoice ? (
              <button onClick={() => setOnlinePromoChoice('change')} style={buttonStyle}>Change Achilles</button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontWeight: 600 }}>Promote to:</label>
                <select value={onlinePromoNewType} onChange={(e) => setOnlinePromoNewType(e.target.value)} style={{ fontSize: 16, padding: '6px 10px' }}>
                  {['Queen','Rook','Bishop','Knight'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => handlePromotion('change', onlinePromoNewType)} style={buttonStyle}>Confirm</button>
                <button onClick={() => setOnlinePromoChoice(null)} style={{ ...buttonStyle, background: '#999' }}>Cancel</button>
              </div>
            )}
          </div>
        )}
        {/* Toasts */}
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map((t) => (
            <div key={t.id} style={{ background: '#222', color: '#fff', padding: '10px 14px', borderRadius: 8, minWidth: 200, boxShadow: '0 6px 24px #0004' }}>{t.message}</div>
          ))}
        </div>
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
      <div style={{ marginLeft: 32, minWidth: 260, maxWidth: 320 }}>{getMoveLog(game?.moveLog)}</div>
    </div>
  );

// --- Button style ---
}

const buttonStyle = {
  padding: '10px 28px',
  fontSize: 18,
  borderRadius: 10,
  border: 'none',
  background: '#c90',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 2px 8px #0001',
  transition: 'background 0.2s',
};
