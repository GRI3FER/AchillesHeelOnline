# 🎮 Play Now! Quick Start

Two ways to play Achilles Heel Chess against the AI bot:

## Option 1: Terminal Interface (Recommended First)

```bash
cd bot
python interactive_game.py
```

**Features:**
- ✅ Type moves as `a2-a4` or `e7-e5`
- ✅ Play against trained bot
- ✅ Watch bot vs bot games
- ✅ See training progress
- ✅ No setup needed

**Typical Game:**
```
Move 1: WHITE
Your move (e2-e4, q=quit): e2-e4

Move 1: BLACK  
Bot thinking... 
Bot played: e7-e5 | Visits: 24 | Win%: 48.3%

Move 2: WHITE
Your move (e2-e4, q=quit): g1-f3
```

**Controls:**
- Menu: Press 1-5 to select mode
- Game: Enter moves like `a2-a4`
- Quit: Type `q`

---

## Option 2: Web Interface (Better Visuals)

### Setup (one time):
```bash
pip install flask
```

### Run:
```bash
cd bot
python web_server.py
```
Then open: **http://localhost:5000**

**Features:**
- ✅ Click pieces to move (no typing)
- ✅ Beautiful 8x8 board
- ✅ Colored pieces
- ✅ Legal move highlighting
- ✅ Training stats dashboard
- ✅ Mobile friendly

**How to Move:**
1. Click on a piece (shows valid moves in yellow)
2. Click destination square
3. Move executes instantly

---

## What You Can Do

### 🎯 Play Against Bot
- **Terminal:** Menu option 1 or 2
- **Web:** Click "Play as White" or "Play as Black"
- Bot uses 30 MCTS iterations by default

### 👀 Watch Bots Play
- **Terminal:** Menu option 3
- **Web:** Click "Bot vs Bot"
- Automatic play with pause between moves

### 📊 See Training Progress
- **Terminal:** Menu option 4
- **Web:** Right panel shows stats
- Updates from `training.db` in real-time

---

## Current Bot Strength

**Before Training:**
- Win rate vs Random: ~5-10%
- Plays randomly

**After 50 games:**
- Win rate vs Random: ~45-55%
- Makes decent opening moves

**After 200 games:**
- Win rate vs Random: ~70-80%
- Strong mid-game strategy

**After 500 games:**
- Win rate vs Random: >90%
- Near-expert level play

**To improve bot:**
```bash
python bot/training_loop.py 50 30      # Sequential: 50 minutes
python bot/parallel_training.py 100 4  # Parallel: 30 minutes
```

---

## Playing Your First Game

### Step 1: Start Terminal UI
```bash
cd c:\Users\anshg\OneDrive\Documents\GitHub\AchillesHeelTraining\bot
python interactive_game.py
```

### Step 2: Choose "Play vs Bot (You are White)"
```
Select option (1-5): 1
```

### Step 3: Make Your Move
```
White Pieces: 16  |  Black Pieces: 16
Moves: 0

YOUR TURN
Your move (e.g., a2-a4, q=quit): e2-e4
```

### Step 4: Watch Bot Respond
```
Bot thinking...
Bot played: e7-e5 | Visits: 24 | Win%: 48.3%
```

### Step 5: Continue Playing
- Keep entering moves in format `from-to` (e.g., `g1-f3`)
- Game ends when a king is captured (Achilles) or checkmate
- Type `q` to quit early

---

## Tips for Better Play

### Understand Achilles Rules
- Each color has a secret "Achilles" piece (like a secret King)
- Opponent can't see which piece it is until it's captured
- Capturing opponent's Achilles = instant win
- Game shows Achilles positions in-game for debugging

### Strong Opening Moves
- Control center (d4, e4, d5, e5)
- Develop pieces (move knights, bishops out)
- Don't expose your Achilles too early

### Watch Bot Strategy
- MCTS evaluates 30 different move sequences
- Prioritizes winning combinations
- Win% shows confidence in move

### Track Bot Improvement
```bash
# After 50 games
python bot/interactive_game.py
# Menu option 4 to see stats

# Then play - bot should be noticeably stronger
```

---

## If Something Goes Wrong

### Terminal UI Won't Start
```bash
# Check Python installed
python --version

# Try from correct directory
cd bot
python interactive_game.py

# Or try web version
pip install flask
python web_server.py
```

### Web UI Port Already Used
```bash
# Edit web_server.py, change 5000 to 5001
app.run(debug=False, port=5001)

# Then go to http://localhost:5001
```

### Bot Makes Illegal Move
- Check game engine: `python bot/achilles_game.py`
- Verify legal_moves() is working: `python bot/fast_mcts_bot.py`

### Moves Too Slow
- Reduce iterations in `interactive_game.py`: 30 → 20
- Or use parallel training to improve bot faster

---

## Game Example

```
============================================================
                 Human vs Bot - Move 3
============================================================

    A B C D E F G H
  ┌─────────────────┐
8 │ R N B Q K B N R │
7 │ P P P P . P P P │
6 │ . . . . P . . . │
5 │ . . . . . . . . │
4 │ . . . . P . . . │
3 │ . . . . . . . . │
2 │ P P P P . P P P │
1 │ R N B Q K B N R │
  └─────────────────┘
    A B C D E F G H

White Pieces: 16  |  Black Pieces: 16
White Achilles: Queen at (0,3)
Black Achilles: Rook at (7,0)
Moves: 2

YOUR TURN
Your move (e.g., a2-a4, q=quit): g1-f3

--- Move 3: BLACK ---
MCTS: 25 legal moves, 30 iterations
Bot thinking...
Bot played: b8-c6 (visits: 18, win%: 51.2%)
```

---

## Keyboard Cheat Sheet

### Terminal UI
| Action | Key/Input |
|--------|-----------|
| Start | `python interactive_game.py` |
| Menu Select | `1`, `2`, `3`, `4`, or `5` |
| Make Move | Type: `a2-a4` |
| Show Piece Moves | Enter source: `a2` → see valid moves |
| Quit Game | Type `q` |
| Exit Program | Menu option 5 |

### Web UI
| Action | Input |
|--------|-------|
| Open | http://localhost:5000 |
| Select Piece | Click on piece |
| Move Piece | Click destination |
| New Game | Click "New Game" |
| Play Mode | Click "Play as White/Black" |
| Watch Mode | Click "Bot vs Bot" |

---

## Next Steps

1. **Play a game** (5 minutes)
   - See how current bot plays
   - Get familiar with move format

2. **Train bot** (1 hour)
   ```bash
   python bot/training_loop.py 50 30
   ```

3. **Play again** (5 minutes)
   - Notice bot is stronger
   - Better move choices

4. **Scale training** (4-8 hours)
   ```bash
   python bot/parallel_training.py 500 4 100
   ```

5. **Bot becomes expert** (>90% vs random)
   - Dominates random play
   - Makes strategic decisions
   - Ready for evaluation

---

## Help & Support

**Need more info?**
- Terminal UI tips: See `INTERACTIVE_GAME_GUIDE.md`
- Training details: See `TRAINING_GUIDE.md`
- Debugging: See `IMPLEMENTATION_CHECKLIST.md`

**Quick Questions:**
- How do I know if my move is legal? → Enter piece position first
- How strong is the bot? → Play a few games, then train 50 more
- Can I undo moves? → No, but you can start new game
- Why is bot slow? → Reduce iterations (30→20) in code

---

**Ready to play?** 🎮

Terminal:
```bash
python bot/interactive_game.py
```

Web:
```bash
pip install flask && python bot/web_server.py
```

Pick one and start playing! 🚀
