import React, { useState } from "react";
import ChessGame from "./components/ChessGame";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5dc" }}>
      <h1 style={{ textAlign: "center", margin: 0, padding: 24 }}>Chess: Achilles Heel Online</h1>
      <ChessGame />
    </div>
  );
}
