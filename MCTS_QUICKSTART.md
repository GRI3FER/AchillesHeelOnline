# Achilles Heel MCTS Bot — Quick Start Guide

## ✅ What's Working

1. **REST API Backend** — Your Node.js server now exposes:
   - `POST /api/bot/game/start` — Create a new bot game
   - `GET /api/bot/game/:gameId/state` — Get current state
   - `GET /api/bot/game/:gameId/legal-moves/:row/:col` — Get legal moves for a piece
   - `POST /api/bot/game/:gameId/move` — Apply a move
   - `POST /api/bot/game/:gameId/set-achilles` — Set Achilles piece

2. **MCTS Bot in Python** — Implements:
   - Monte Carlo Tree Search with UCB1 selection
   - Stockfish evaluation (when available)
   - Self-play game simulation
   - Local state management

3. **Self-Play Pipeline** — Bot successfully:
   - ✓ Creates games
   - ✓ Randomly selects Achilles for both sides
   - ✓ Runs MCTS search per move
   - ✓ Plays complete games

## 🚀 How to Run

### Start the Backend
```bash
cd backend
npm start
# Runs on http://localhost:10000
```

### Run a Self-Play Game
```bash
cd .
C:/Users/anshg/AppData/Local/Python/pythoncore-3.14-64/python.exe bot/mcts_bot.py
```

The bot will:
- Play white and black against itself
- Run 30 MCTS iterations per move (configurable)
- Print move history and game outcome

## ⚙️ Next Steps

### 1. Install Stockfish (Recommended)
Currently the bot warns "Stockfish not found" but still works with random evaluation. To use Stockfish for better move quality:

**Windows:**
- Download from: https://stockfishchess.org/download/
- Extract to: `C:\Program Files\stockfish\stockfish.exe`

**Mac:**
```bash
brew install stockfish
```

**Linux:**
```bash
sudo apt install stockfish
```

### 2. Improve Evaluation

The MCTS currently uses a simple heuristic (random value ∈ [0, 1]). You can:

**Option A — Better Stockfish Integration:**
- The bot already calls `stockfish_eval()` but Stockfish doesn't understand your hidden info rules
- Limitation: Stockfish sees material balance only, not immortality/Achilles mechanics

**Option B — Custom Evaluator (Recommended):**
Modify `stockfish_eval()` in `mcts_bot.py` to:
```python
def custom_eval(self, state, color):
    """Evaluate based on material + Achilles proximity + pawn advancement"""
    score = 0
    # Count material
    for r in range(8):
        for c in range(8):
            piece = state['board'][r][c]
            if piece:
                # Value table (customize these)
                values = {'Pawn': 1, 'Knight': 3, 'Bishop': 3, 'Rook': 5, 'Queen': 9}
                piece_val = values.get(piece['type'], 0)
                score += piece_val if piece['color'] == color else -piece_val
    # Add bonuses for Achilles safety, pawn advancement, etc.
    return score / 20.0  # Normalize to [0, 1] range
```

### 3. Scale Up Training

**For faster self-play:**

1. **Increase iterations** (currently 30, try 100+):
```python
from_pos, to_pos = self.mcts_search(game_id, iterations=100, color=color)
```

2. **Run parallel games** — Modify `self_play_game()` to:
   - Play multiple games in sequence
   - Log outcomes to `training_data.json`
   - Track win rates over time

3. **Save training data:**
```python
training_data = []
for game_num in range(100):
    final_state = bot.self_play_game(max_moves=200)
    training_data.append({
        'game': game_num,
        'winner': final_state['winner'],
        'moves': len(final_state['moveLog'])
    })
# Save to file or database
```

### 4. Implement ISMCTS (for Hidden Info)

Your game has hidden information (secret Achilles + immortality countdown). Standard MCTS assumes perfect info. To handle this properly:

**Information Set Monte Carlo Tree Search (ISMCTS):**
- During simulations, randomize possible hidden states
- Run MCTS across all possible "worlds"
- More accurate but slower

Reference: [ISMCTS Paper](https://science.scikit-game.org/papers/2015_CIG_Double-Blind_MCTS.pdf)

```python
def ismcts_search(self, game_id, state, color, iterations=100):
    """Run MCTS with information set sampling"""
    for i in range(iterations):
        # Sample a possible game state (randomize hidden info)
        sampled_state = self.sample_hidden_state(state, color)
        # Run standard MCTS on sampled state
        ...
```

### 5. Next: Build a Stronger Evaluator

Once you have a self-play pipeline, the real learning happens here. Options:

- **Stockfish tuning** (Texel tuning): Use game outcomes to adjust Stockfish evaluation weights
- **Neural network** (AlphaZero-style): Train a small net on your self-play data
- **Hand-crafted eval**: Build domain knowledge (Achilles positioning, pawn races, etc.)

## 🔧 Files Modified

- `backend/server.js` — Added REST `/api/bot/` endpoints
- `backend/package.json` — Added express, ws dependencies
- `bot/mcts_bot.py` — Main MCTS bot (new file)

## 📊 Current Limitations

1. **Stockfish not installed** — Bot works without it but evaluates randomly
2. **No hidden info handling** — MCTS assumes perfect board visibility
3. **No promotion auto-handling** — Games stop at pawn promotion (quick fix needed)
4. **Slow evaluation** — Each move makes multiple API calls; could optimize with local state
5. **No training loop** — You can play 1 game, but not yet train across 1000s of games

## 💡 Tips

- Start with lower iterations (10-20) to debug, then scale up
- Monitor win rates to see if bot improves (currently should be ~50-50)
- Log move sequences to analyze bot strategy
- Consider adding a "fast mode" that samples moves rather than expanding fully

## Questions?

- **Bot too slow?** Reduce iterations or switch to local Python evaluation (skip Stockfish)
- **Moves seem random?** Stockfish isn't installed, so evaluation is random. Install it or implement custom eval
- **Hidden info breaks MCTS?** You'll need ISMCTS — see section 4 above

Happy training! 🎮⚔️
