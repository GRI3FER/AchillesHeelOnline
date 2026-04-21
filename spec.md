# File: spec.md
# Path: AchillesHeelOnline/spec.md
Chess: Achilles Heel — Multiplayer Web Spec
1. Overview

Chess: Achilles Heel is a real-time multiplayer chess variant where:

Standard chess movement rules apply (no king, no castling, no en passant)
Each player secretly selects an “Achilles” piece (king-equivalent)
The game is won by capturing or killing the opponent’s Achilles
A secondary system (“Patroclus”) introduces mirrored vulnerability and temporary immortality

The system must be:

Server-authoritative
Real-time synchronized (WebSockets)
Hidden-information compliant
2. System Architecture
2.1 High-Level Stack
Frontend (Client)
React / Next.js
Chess UI board renderer
WebSocket client
No rule authority (UI only)
Backend (Authoritative Engine)
Node.js (Express or Fastify)
WebSocket server (ws or Socket.IO)
Game state engine (pure logic module)
Data Model
In-memory game state per room (optionally Redis for scaling)
3. Core Game Concepts
3.1 Pieces

Standard chess pieces:

Pawn, Rook, Knight, Bishop, Queen, Queen (no King)

Each piece has:

Piece {
  type: "Pawn" | "Rook" | "Knight" | "Bishop" | "Queen"
  color: "white" | "black"
  position: [row, col]
}
3.2 Achilles System (Hidden Role)

Each player selects ONE piece:

achilles: {
  white: PieceID,
  black: PieceID
}

Rules:

Cannot be a pawn
Hidden from opponent
Defines win condition
3.3 Patroclus System (Mirror Mapping)

Patroclus is automatically assigned using initial board symmetry:

mirror(row, col) = (7 - row, col)

State:

patroclus: {
  white: PieceID,
  black: PieceID
}

Rules:

Changes if Achilles changes
Must always reflect current Achilles type/logic
3.4 Immortality System

Triggered when Patroclus is captured.

State:
immortal: {
  white: boolean,
  black: boolean
}

immortalCountdown: {
  white: number,
  black: number
}
Behavior:
On Patroclus death:
set immortal = true
set countdown = 5 opponent moves
While immortal:
If opponent attempts to capture Achilles:
attacker dies instead
Achilles remains
After 5 opponent moves:
immortality ends
3.5 Immortal vs Immortal Conflict Rule

If BOTH Achilles are immortal and attempt capture:

Move is cancelled
Both Achilles positions are revealed to both players
3.6 Win Condition

Game ends immediately when:

opponent Achilles is captured OR dies

No:

check
checkmate
stalemate
3.7 Pawn Promotion Rules

When pawn reaches last rank:

Player chooses:

Option A — Discover
revealOpponentAchillesType = true
Reveals ONLY piece type
NOT location
Does NOT distinguish Achilles vs Patroclus
Option B — Change Achilles
achilles[player] = promotedPieceType
Pawn becomes new Achilles
Old Achilles type is replaced
Patroclus recalculates from mirror rule
4. Backend Game Engine (Core Requirement)
4.1 Responsibilities

Backend MUST:

validate all moves
enforce rules
maintain hidden state
broadcast updates
resolve combat outcomes

Frontend MUST NOT:

validate rules
determine wins
compute immortality
4.2 Game State Object
GameState {
  board: Piece[][]
  turn: number

  players: {
    white: socketId
    black: socketId
  }

  achilles: { white, black }

  patroclus: { white, black }

  immortal: { white, black }

  immortalCountdown: { white, black }

  revealedAchillesType: { white, black }

  winner: "white" | "black" | null
}
4.3 Move Processing Pipeline

When server receives:

move(from, to)
Execution order:
Validate game not over
Validate correct turn
Validate piece exists
Validate movement legality (chess rules)
Determine target piece
Rule checks:
A. If target is Achilles:
If defender is immortal:
attacker dies
Else:
game ends (attacker wins)
B. If target is Patroclus:
remove piece

activate immortality:

immortal[player] = true
immortalCountdown[player] = 5 opponent moves
C. Normal move:
execute movement
After move:
decrement opponent immortality counter
update turn
broadcast state
4.4 Immortality Tick System

On every opponent move:

immortalCountdown[player] -= 1
if (immortalCountdown <= 0):
    immortal = false
5. WebSocket Protocol
5.1 Client → Server
{ "type": "create-room" }
{ "type": "join-room", "roomCode": "ABC123" }

{ "type": "choose-achilles", "row": 2, "col": 3 }

{ "type": "move", "from": [0,0], "to": [0,5] }

{ "type": "promotion", "option": "discover" | "change" }
5.2 Server → Client
{ "type": "sync", "gameState": {...} }

{ "type": "room-created", "roomCode": "ABC123" }

{ "type": "invalid-move", "reason": "..." }

{ "type": "game-over", "winner": "white" }
6. Hidden Information Rules

Clients MUST NOT receive:

opponent Achilles identity (unless revealed)
internal immortality counters
internal mapping logic

Server only sends:

visible board
optional revealed Achilles type
game state summary
7. Security Rules
Server is only authority
No client-side win validation
No trust in frontend move legality
All moves revalidated server-side
8. Edge Cases
8.1 Simultaneous capture of both Achilles
Cancel move
Reveal both Achilles
8.2 Changing Achilles mid-game
Recalculate Patroclus instantly
Do NOT change piece positions
8.3 Immortal capture attempt
Attacker dies instantly
Defender remains
9. Key Design Philosophy

This is NOT chess with modifications.

It is:

A hidden-information strategy game built on chess movement rules.

If you want next step

I can turn this into:

full backend folder structure (ready for coding)
Copilot-ready /engine module
or 
full WebSocket + Redis scalable architecture

Just tell me 👍

make it copypastable into a spec.md in vscode

Here’s a clean, VSCode-ready spec.md you can copy-paste directly.

# Chess: Achilles Heel — Multiplayer Web Spec

## 1. Overview

Chess: Achilles Heel is a real-time multiplayer chess variant built on standard chess movement rules with hidden-information mechanics.

Key differences from standard chess:
- No king
- Two queens
- Secret “Achilles” piece per player (king-equivalent)
- Win condition: capture or kill opponent’s Achilles
- Patroclus system (mirrored dependency)
- Temporary immortality mechanic
- Pawn promotion has special strategic options

The game must be:
- Real-time multiplayer
- Server authoritative
- WebSocket based
- Secure hidden-information system

---

## 2. Tech Stack

### Frontend
- React (or Next.js)
- WebSocket client
- Chess board renderer
- No game logic authority

### Backend
- Node.js (Express or Fastify)
- WebSocket server (ws or Socket.IO)
- Authoritative game engine

### Storage
- In-memory game rooms (Redis optional for scaling)

---

## 3. Core Game State Model

```ts
GameState {
  board: Piece[][]

  turn: number

  players: {
    white: socketId
    black: socketId
  }

  achilles: {
    white: PieceID | null
    black: PieceID | null
  }

  patroclus: {
    white: PieceID | null
    black: PieceID | null
  }

  immortal: {
    white: boolean
    black: boolean
  }

  immortalCountdown: {
    white: number
    black: number
  }

  revealedAchillesType: {
    white: boolean
    black: boolean
  }

  winner: "white" | "black" | null
}
4. Pieces

Standard chess pieces (no king):

Pawn
Rook
Knight
Bishop
Queen (x2)
Piece {
  type: "Pawn" | "Rook" | "Knight" | "Bishop" | "Queen"
  color: "white" | "black"
  position: [row, col]
}
5. Achilles System (Hidden Role)

Each player secretly selects one non-pawn piece as Achilles.

Rules:

Cannot be a pawn
Hidden from opponent
If Achilles dies → player loses
achilles.white = PieceID
achilles.black = PieceID
6. Patroclus System (Mirror Mechanic)

Patroclus is defined by board symmetry:

mirror(row, col) = (7 - row, col)

Rules:

Each Achilles has a Patroclus mirror piece
Patroclus is dynamically tied to Achilles logic
If Achilles changes → Patroclus recalculates
7. Immortality System

Triggered when Patroclus is captured.

State
immortal[player] = true
immortalCountdown[player] = 5 opponent moves
Effect

While immortal:

If opponent attempts to capture Achilles:
attacker dies instead
Achilles remains

After 5 opponent moves:

immortality ends
8. Immortal Conflict Rule

If BOTH Achilles are immortal and attempt capture:

Cancel move
Do not resolve capture
Reveal both Achilles identities to both players
9. Win Condition

Game ends immediately when:

Opponent’s Achilles is captured OR dies

No:

check
checkmate
stalemate
10. Pawn Promotion Rules

When pawn reaches final rank:

Player chooses one:

Option 1: Discover opponent Achilles type
Reveals ONLY piece type
Does NOT reveal square
Does NOT distinguish Achilles vs Patroclus
Option 2: Change Achilles
Player replaces their Achilles with promoted piece type
Pawn becomes new Achilles
Patroclus recalculates via mirror rule
11. Move Validation Rules (Server-side only)

Server must validate:

Correct turn
Piece ownership
Legal chess movement
No illegal collisions

Frontend MUST NOT validate game rules

12. Move Processing Pipeline

On move(from, to):

Validate game not over
Validate turn
Validate piece exists
Validate movement legality
Determine target piece
If target is Achilles:
If defender immortal:
attacker dies
Else:
attacker wins game
If target is Patroclus:
Remove Patroclus
Activate immortality:
immortal[player] = true
countdown = 5 opponent moves
Otherwise:
Normal move execution
13. Immortality Countdown

After every opponent move:

decrement immortalCountdown
if countdown == 0:
immortal = false
14. WebSocket API
Client → Server
{ "type": "create-room" }
{ "type": "join-room", "roomCode": "ABC123" }
{ "type": "choose-achilles", "row": 2, "col": 3 }
{ "type": "move", "from": [0,0], "to": [0,5] }
{ "type": "promotion", "option": "discover" | "change" }
Server → Client
{ "type": "sync", "gameState": {} }
{ "type": "room-created", "roomCode": "ABC123" }
{ "type": "invalid-move", "reason": "..." }
{ "type": "game-over", "winner": "white" }
15. Hidden Information Rules

Clients must NEVER receive:

opponent Achilles identity (unless revealed)
internal immortality counters
hidden mappings

Server only sends:

board state
minimal metadata
allowed revealed information
16. Edge Cases
Simultaneous Achilles capture
Cancel move
Reveal both Achilles identities
Changing Achilles mid-game
Do NOT move pieces
Only update Achilles mapping
Immortal attack
Attacker dies instantly
Defender remains
17. Security Rules
Server is single source of truth
No client-side validation for outcomes
All moves re-validated on backend
No trust in frontend state
18. Design Philosophy

This game is:

Chess movement rules + hidden-role strategy + asymmetric immortality mechanics

Not:

chess with tweaks
or variant rules layered on UI

It is a new strategic system built on chess movement.


---

If you want next step, I can also generate:
- full backend folder structure (`/engine`, `/ws`, `/rooms`)
- or a Copilot prompt that generates the entire server automatically
- or a deterministic rules engine in TypeScript (clean + production-grade)

Just say 👍
its being coded with react and html

Got it — here’s a React + HTML-specific spec.md tailored so Copilot can actually implement it cleanly (frontend-first, backend assumed WebSocket server).

Copy-paste this directly into spec.md:

# Chess: Achilles Heel — React + WebSocket Spec

## 1. Overview

Chess: Achilles Heel is a real-time multiplayer chess variant built in React with a WebSocket backend.

Core idea:
- Standard chess movement rules
- No king (two queens instead)
- Each player secretly selects an “Achilles” (king-equivalent piece)
- Win condition: opponent Achilles is captured or dies
- Hidden-role mechanics (Achilles + Patroclus system)
- Temporary immortality mechanic after Patroclus death
- Special pawn promotion choices

---

## 2. Frontend Stack

- React (functional components)
- HTML + inline or CSS styling
- WebSocket client (native `WebSocket`)
- Local state: `useState`, `useEffect`, `useRef`

No external game engine.

---

## 3. Backend Assumption

Backend provides:
- WebSocket server
- Authoritative game state
- Move validation
- Room system

Frontend NEVER validates rules, only renders + sends intents.

---

## 4. Core Frontend State (React)

```js
const [board, setBoard] = useState(8x8 array)
const [game, setGame] = useState(null)

const [roomCode, setRoomCode] = useState("")
const [joined, setJoined] = useState(false)

const [selected, setSelected] = useState(null)

const ws = useRef(null)

Game state received from server:

game = {
  board,
  turn,
  achilles,
  patroclus,
  immortal,
  immortalCountdown,
  promotion,
  winner
}
5. WebSocket Connection Flow
Create Room

Frontend:

ws.send({ type: "create-room" })

Server returns:

{ type: "room-created", roomCode }
Join Room
ws.send({ type: "join-room", roomCode })
Move Piece
ws.send({
  type: "move",
  roomCode,
  payload: {
    from: [row, col],
    to: [row, col]
  }
})
Select Achilles
ws.send({
  type: "choose-achilles",
  payload: { row, col }
})
Promotion Choice
ws.send({
  type: "promotion",
  payload: {
    option: "discover" | "change"
  }
})
6. UI Screens (React)
6.1 Lobby Screen

Displayed when:

!joined

UI:

Create room button
Join room input
Optional "Play Local" button
6.2 Game Screen

Displayed when:

joined === true

Components:

Room code display
Status text
ChessBoard component
Promotion modal (if active)
6.3 Promotion UI

If:

game.promotion?.color === myColor

Show:

Button: "Discover opponent Achilles type"
Button: "Change your Achilles"
7. ChessBoard Component

Props:

<ChessBoard
  board={board}
  onCellClick={handleCellClick}
  selected={selected}
/>

Responsibilities:

Render 8x8 grid
Show pieces
Highlight selected square
Call onCellClick(row, col) on click

No game logic inside.

8. Click Handling Logic (Frontend)
Step 1: Selection

If no piece selected:

select piece if it belongs to player
Step 2: Move

If selected exists:

send move to server
clear selection

Frontend does NOT validate move legality.

9. Game Rules (Frontend Responsibility = DISPLAY ONLY)

Frontend only reacts to server state:

Achilles Rules
If Achilles dies → show “You Lose”
If opponent Achilles dies → show “You Win”
Patroclus Rule

If Patroclus is captured:

show “Immortality activated”
Immortality Effect (UI only)

If game.immortal[player] === true:

show indicator: “IMMORTAL (5 moves remaining)”
10. Promotion Rules

When server sends:

game.promotion

Frontend shows modal:

Option 1

“Discover opponent Achilles type”

Option 2

“Change your Achilles”

Frontend sends selection only — server applies logic.

11. Rendering Rules
Board Rendering
8x8 grid
alternating colors
pieces rendered as text or icons

Example:

♟ pawn
♜ rook
♞ knight
♝ bishop
♛ queen
12. Game Flow
Step 1: Join Room

→ connect WebSocket

Step 2: Achilles Selection Phase
restrict move system
only allow selecting one piece (non-pawn)
Step 3: Normal Gameplay
alternating turns
move sent to server
Step 4: Special Mechanics
Patroclus death → immortality starts
immortality countdown handled server-side
promotions handled via modal
Step 5: Win Condition
server sends gameOver
frontend displays result screen
13. WebSocket Messages (Frontend Must Handle)
"sync"
"room-created"
"player-joined"
"invalid-move"
"game-over"
"promotion"
14. UI State Rules

Frontend must always prioritize server state:

board = game.board
turn = game.turn

No local simulation of chess rules.

15. Key Design Constraints
React only handles UI + input
Backend handles ALL rules
No client trust
No hidden logic in frontend
Stateless board updates from server
16. Core Gameplay Summary
Players join room
Select Achilles (hidden role)
Play chess normally
If Patroclus dies → immortality for 5 opponent moves
If Achilles dies → game over
Pawn promotion adds strategic branching
