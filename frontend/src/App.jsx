import React, { useState } from "react";
import ChessGame from "./components/ChessGame";

export default function App() {
  const [showGame, setShowGame] = useState(false);

  if (!showGame) {
    return (
      <div style={{ minHeight: "100vh", minWidth: 0, width: "100vw", background: "#f5f5dc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: "#c90", marginBottom: 24, textShadow: "0 2px 12px #0002" }}>Achilles Heel Online</h1>
        <p style={{ fontSize: 22, color: "#333", marginBottom: 32, maxWidth: 480, textAlign: "center" }}>
          A chess variant of hidden identities and secret objectives.<br />
          Can you protect your Achilles?
        </p>
        <button
          style={{
            padding: "16px 48px",
            fontSize: 28,
            borderRadius: 12,
            border: "none",
            background: "#c90",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 18px #0001",
            marginBottom: 12
          }}
          onClick={() => setShowGame(true)}
        >
          Start
        </button>
        <div style={{ fontSize: 14, color: "#888", marginTop: 24 }}>Created by AnshG</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", minWidth: 0, width: "100vw", background: "#f5f5dc", overflowX: "auto", overflowY: "auto", maxHeight: "100vh" }}>
      <ChessGame />
    </div>
  );
}
