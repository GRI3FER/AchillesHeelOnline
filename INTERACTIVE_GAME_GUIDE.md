# Interactive Game Modes - Play & Watch

You now have two ways to play against the bot and watch training progress:

## 1. Terminal UI (Quick & Easy)

**No setup needed - works immediately with existing code**

### Run:
```bash
cd bot
python interactive_game.py
```

### Features:
- ✅ Play against bot (human vs bot)
- ✅ Watch bot games (bot vs bot)
- ✅ View training progress
- ✅ Real-time MCTS statistics
- ✅ Works on any terminal/SSH session

### Main Menu Options:

**1. Play vs Bot (You are White)**
- You move first with white pieces
- Input moves as: `a2-a4` (from square to square)
- Bot responds automatically
- Watch MCTS statistics for each bot move

**2. Play vs Bot (You are Black)**
- Bot moves first with white pieces
- You respond with black pieces
- Same move input format

**3. Watch Bot vs Bot**
- Two bots play each other
- Spectator mode with auto-play
- Shows MCTS stats for each move
- Shows final winner and move count

**4. Show Training Progress**
- Display total games played
- Win rates (white/black)
- Average game length
- Elo rating progression

**5. Exit**
- Quit the program

### Game UI Example:
```
============================================================
                   Human vs Bot - Move 1
============================================================

    A B C D E F G H
  ┌─────────────────┐
8 │ R N B Q K B N R │ 8
7 │ P P P P P P P P │ 7
6 │               │ 6
5 │               │ 5
4 │               │ 4
3 │               │ 3
2 │ P P P P P P P P │ 2
1 │ R N B Q K B N R │ 1
  └─────────────────┘
    A B C D E F G H

White Pieces: 16  |  Black Pieces: 16
White Achilles: Queen at (7,3)
Moves: 0

YOUR TURN
Your move (e.g., a2-a4, q=quit): e2-e4
```

### Move Input Examples:
- `e2-e4` - Move pawn from e2 to e4
- `g1-f3` - Move knight from g1 to f3
- `e1-g1` - Kingside castling
- `q` - Quit game

### Tips:
- **Coordinate system**: Columns a-h (left to right), rows 1-8 (bottom to top)
- **Show legal moves**: Enter piece position first to see valid moves
- **Promotion**: Follow prompts when pawn reaches last rank
- **Achilles piece**: Shown with special symbols (★ or red color)
- **Bot strength**: Increases with training (more games → stronger bot)

---

## 2. Web UI (Pretty & Visual)

**Better visuals with browser interface**

### Prerequisites:
```bash
pip install flask
```

### Run:
```bash
cd bot
python web_server.py
```

Then open browser to: **http://localhost:5000**

### Features:
- ✅ Beautiful board visualization
- ✅ Click-based move input (no typing)
- ✅ Piece symbols with colors
- ✅ Legal move highlighting
- ✅ Move history tracking
- ✅ Training stats dashboard
- ✅ Real-time board updates
- ✅ Mobile-responsive design

### Web Interface Layout:

```
┌─────────────────────────────────────────────────┐
│        Achilles Heel Chess - Interactive        │
│                                                 │
├────────────────────┬──────────────────────────┤
│                    │  Game Status             │
│    8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜│  White Pieces: 16       │
│    7 ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟│  Black Pieces: 16       │
│    6                │  Move Count: 0          │
│    5                │  White Achilles: ...    │
│    4                │  Black Achilles: ...    │
│    3                │                         │
│    2 ♙ ♙ ♙ ♙ ♙ ♙ ♙ ♙│  Recent Moves:         │
│    1 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖│  (none yet)            │
│      A B C D E F G H│                         │
│                    │  📊 Training Progress   │
│  [Game Status Box] │  Games Played: 150      │
│  [Buttons...]      │  Win Rate: 65.5%        │
└────────────────────┴──────────────────────────┘
```

### Button Controls:

| Button | Action |
|--------|--------|
| **Play as White** | Start game with you as white (you move first) |
| **Play as Black** | Start game with you as black (bot moves first) |
| **Bot vs Bot** | Watch two bots play each other |
| **New Game** | Reset board and start over |

### How to Move (Web UI):
1. **Click a piece** → Shows legal moves (highlighted yellow)
2. **Click destination** → Move executes automatically
3. **Click elsewhere** → Deselect and try different piece

### Color Legend:
- **Light squares**: ♘ on light background
- **Dark squares**: ♘ on dark background
- **Yellow highlight**: Selected piece and legal moves
- **White pieces**: ♙ (uppercase Unicode)
- **Black pieces**: ♟ (lowercase Unicode)
- **★ symbol**: Indicates Achilles piece (secret objective)

### Training Stats Panel:
Shows real-time stats from `training.db`:
- **Games Played**: Total games recorded
- **Win Rate**: Percentage of wins vs random baseline
- **Progress bar**: Training completion (0-500 games = 0-100%)

---

## Comparison

| Feature | Terminal | Web |
|---------|----------|-----|
| Setup Time | <30 seconds | 1 minute (install Flask) |
| Ease of Use | Type moves | Click to move |
| Visual Quality | ASCII/Unicode | Full graphics |
| Performance | Very fast | Slightly slower |
| Remote Access | SSH-friendly | Needs port forward |
| Mobile | No | Yes (responsive) |
| Move Stats | Shown in text | Shown in tooltips |
| Training Stats | Real-time display | Real-time display |
| Game Replay | No | No (but logs in DB) |

---

## Quick Start

### Option A: Terminal UI (Recommended for first test)
```bash
cd c:\Users\anshg\OneDrive\Documents\GitHub\AchillesHeelTraining
python bot/interactive_game.py
```

### Option B: Web UI (Better visuals)
```bash
cd c:\Users\anshg\OneDrive\Documents\GitHub\AchillesHeelTraining
pip install flask  # One-time install
python bot/web_server.py
# Then open http://localhost:5000 in browser
```

---

## Integrating with Training

### Watch Training Progress:

**In Terminal UI:**
1. Start training in one terminal: `python bot/training_loop.py 100 30`
2. Open another terminal and run: `python bot/interactive_game.py`
3. Select "Show Training Progress" to see live stats

**In Web UI:**
1. Start training in one terminal: `python bot/parallel_training.py 100 4 30`
2. Run web server: `python bot/web_server.py`
3. Training stats auto-update in dashboard

### Training Progress Indicators:

As training progresses, you should see:
- **After 50 games**: ~45-55% win rate vs random
- **After 200 games**: ~70-80% win rate vs random
- **After 500 games**: >90% win rate vs random

Play a few games with the bot and notice improvement! 🚀

---

## Troubleshooting

### Terminal UI
**"ImportError: No module named 'achilles_game'"**
- Make sure you're in the `bot/` directory
- Or add to path: `cd bot && python interactive_game.py`

**Unicode pieces not showing (Windows)**
- Add `--ascii` flag: `python interactive_game.py --ascii`
- Or use ASCII mode in menu

**Bot is very slow**
- Reduce iterations: Edit interactive_game.py, change `bot_iterations=30` to `20`

### Web UI
**"ModuleNotFoundError: No module named 'flask'"**
```bash
pip install flask
```

**"Address already in use"**
- Port 5000 is taken, use different port:
```python
app.run(debug=False, port=5001)  # Change in web_server.py line
```

**Board not updating**
- Refresh the browser (F5)
- Check console for errors (F12)

---

## Advanced Usage

### Play Multiple Games in Sequence (Terminal)

The terminal UI will loop after each game, so you can play multiple games back-to-back without restarting.

### Export Game Data

After playing games:
```python
# In Python shell
import sqlite3
db = sqlite3.connect('training.db')
games = db.execute("SELECT * FROM games LIMIT 10").fetchall()
for game in games:
    print(game)
```

### Test Different Bot Strengths

Edit `interactive_game.py`:
- Change `bot_iterations=30` to `50` for stronger bot (slower)
- Change to `20` for faster but weaker play

### Watch Specific Training Results

```bash
# Run 50 games
python bot/training_loop.py 50 30

# Then watch how bot plays
python bot/interactive_game.py
# Select option 3 (Bot vs Bot) to watch trained bot
```

---

## Performance Notes

### Terminal UI Speed:
- Single game: ~20-30 seconds (30 iterations)
- Responsive and snappy
- No network overhead

### Web UI Speed:
- Single game: ~25-35 seconds (30 iterations)
- Slight overhead from browser communication
- Better for watching extended games

### Recommendation:
- **First test**: Use Terminal UI
- **Long training observation**: Use Web UI
- **Data analysis**: Use Training database directly

---

## Next Steps

1. **Play a game**: Test either UI with current untrained bot
2. **Train**: Run `python bot/training_loop.py 50 30`
3. **Play again**: Watch how bot improves
4. **Iterate**: Repeat steps 2-3 with 200, then 500 games

Once you see the bot beat random >85%, it's ready for real evaluation!

---

## File Reference

- **Terminal UI**: `bot/interactive_game.py`
- **Web UI**: `bot/web_server.py`
- **Web UI Styling**: Embedded in Python file (HTML template)
- **Database**: `training.db` (auto-created)
- **Game Engine**: `bot/achilles_game.py` (used by both)
- **MCTS Bot**: `bot/fast_mcts_bot.py` (used by both)

---

Generated: 2024-12-19
Status: Ready to use ✅
