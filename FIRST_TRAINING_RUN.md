# First Training Run: Step-by-Step Guide

## Goal
Validate the entire training pipeline with 50 self-play games. This will:
- Confirm database recording works
- Verify outcome tracking is correct
- Establish baseline performance
- Take ~50 minutes

## Prerequisites
- ✅ Python 3.11+ installed
- ✅ Stockfish binary at: `C:\Users\anshg\Downloads\stockfish\stockfish-windows-x86-64-avx2.exe`
- ✅ All bot files created in `bot/` directory
- ✅ No prior `training.db` (fresh start) or existing one is OK (will append)

## Step 1: Run a Single Test Game (2 minutes)

This validates the game engine and MCTS work together.

```bash
cd c:\Users\anshg\OneDrive\Documents\GitHub\AchillesHeelTraining
python bot/fast_mcts_bot.py
```

**Expected Output:**
```
Game ID: abc123def456
✓ white Achilles: [piece type] at (row, col)
✓ black Achilles: [piece type] at (row, col)

--- Move 1: WHITE ---
MCTS: 20 legal moves, 20 iterations
Best move: [row1,col1] -> [row2,col2] (visits: 2, win%: 50.0%)
✓ Played

[... more moves ...]

WHITE WINS!
or
BLACK WINS!
or
DRAW!

Final board:
[8x8 board representation]
```

**If this fails:**
- ❌ ImportError: Check Python path, install `stockfish` package
- ❌ "Stockfish binary not found": Verify Stockfish path in `fast_mcts_bot.py`
- ❌ "No legal moves": Bug in game engine, report with board state
- ❌ Memory error: Close other applications

**If it succeeds:** ✅ Continue to Step 2

---

## Step 2: Run 50 Training Games (50 minutes)

This records all games to the SQLite database.

```bash
cd c:\Users\anshg\OneDrive\Documents\GitHub\AchillesHeelTraining
python bot/training_loop.py 50 30
```

**What this does:**
- Plays 50 games with MCTS bot (30 iterations each)
- Records each game to `training.db`
- Records each move in database
- Shows checkpoint every 5 games

**Expected Output:**
```
Starting training: 50 games
Games 1-5: ████████░░  10% - 2 min elapsed
Games 6-10: ████████░░  20% - 4 min elapsed
Games 11-15: ████████░░  30% - 7 min elapsed
...
Games 46-50: ████████░░  100% - 50 min elapsed

Training complete!
- Total games: 50
- White wins: 18
- Black wins: 22
- Draws: 10
- Database: training.db (100 KB)
```

**Expected timing:**
- 5 games: ~5 minutes
- 10 games: ~10 minutes
- 50 games: ~50 minutes

**If this is much slower:**
- Check CPU usage (should be ~100%)
- Reduce iterations from 30 to 20
- Consider parallel training

**If this is much faster:**
- Check if bot is evaluating positions (not just random)
- Verify Stockfish is being called

**If it crashes:**
- Database error? Check permissions on `training.db`
- Out of memory? Reduce iterations or restart system
- MCTS error? Check piece move legality in game engine

**If it succeeds:** ✅ Continue to Step 3

---

## Step 3: Verify Database (1 minute)

Check that games were recorded correctly.

```bash
python
>>> import sqlite3
>>> db = sqlite3.connect('training.db')
>>> 
>>> # Check games table
>>> cursor = db.execute("SELECT COUNT(*) FROM games")
>>> print(f"Total games: {cursor.fetchone()[0]}")  # Should be 50+
>>> 
>>> # Check winners
>>> cursor = db.execute("SELECT winner, COUNT(*) FROM games GROUP BY winner")
>>> for row in cursor:
...     print(f"  {row[0]}: {row[1]} games")
>>> 
>>> # Check positions
>>> cursor = db.execute("SELECT COUNT(*) FROM positions")
>>> print(f"Total positions: {cursor.fetchone()[0]}")  # Should be 200+
>>> 
>>> # Check moves
>>> cursor = db.execute("SELECT COUNT(*) FROM moves")
>>> print(f"Total moves: {cursor.fetchone()[0]}")  # Should be 200+
>>> 
>>> db.close()
```

**Expected Output:**
```
Total games: 50
  white: 15
  black: 20
  None: 15
Total positions: 250
Total moves: 1200
```

**If counts are wrong:**
- Database not recording properly
- Check `training_loop.py` for write operations
- Verify game engine returns winner correctly

**If it succeeds:** ✅ Continue to Step 4

---

## Step 4: Benchmark Against Random (30 minutes)

Now test if MCTS is better than random moves.

```bash
python bot/benchmark.py 30
```

**Expected Output:**
```
Benchmarking MCTS (30 iterations) vs Random
Running tournament: 100 games

Progress: 50% complete (50 games, 25 min remaining)

Results:
- MCTS (white): 45 wins (45%)
- Random (black): 40 wins (40%)
- Draws: 15 (15%)

MCTS win rate: 45/(45+40) = 53% vs Random
Expected: 40-60% (untrained bot barely beats random)

Tournament complete in 25 minutes.
```

**Interpretation:**
- **45-60%**: Normal. Bot is barely trained.
- **30-45%**: Bot is weak. Check:
  - Is evaluator actually being used?
  - Are iterations being applied?
  - Is Stockfish loading?
- **>60%**: Bot is very good already (unlikely). Check:
  - Are iterations being used?
  - Has training.db from prior runs?
  
**If it succeeds:** ✅ Continue to Step 5

---

## Step 5: Analyze Progress (1 minute)

Get summary statistics.

```bash
python bot/analyze_training.py
```

**Expected Output:**
```
Training Analysis
=================

Games analyzed: 50
White wins: 18 (36%)
Black wins: 22 (44%)
Draws: 10 (20%)

Average game length: 24 moves
Longest game: 45 moves
Shortest game: 8 moves

Elo Rating Progression:
- Start: 1600 (baseline)
- After 10 games: 1625
- After 20 games: 1645
- After 30 games: 1665
- After 40 games: 1680
- After 50 games: 1695

Key statistics:
- Win rate vs random: ~50%
- Material advantage avg: +1.2 pieces
- Checkmate rate: 5/50 (10%)

Data exported to: training_data.json
```

**If Elo is flat:**
- Bot not improving → check evaluator
- Increase iterations to 50-100

**If Elo is increasing:**
- Bot is learning ✅

**If it succeeds:** ✅ Phase 1 complete!

---

## Phase 1 Validation Checklist

- [x] Single test game runs without crashing
- [x] 50 training games complete
- [x] Database has 50+ games recorded
- [x] Database has 200+ positions recorded
- [x] Benchmark shows bot vs random (~50% baseline)
- [x] Analysis shows Elo progression
- [x] No crashes or errors

**If all pass:** ✅ Move to Phase 2 (Scale Training)

---

## Phase 2: Scale to 200 Games (3-4 hours)

Once Phase 1 passes, scale up:

```bash
python bot/parallel_training.py 200 4 50
```

**Expected:**
- Runs in 2-4 hours (4-core laptop)
- Total games in DB: 250 (50 + 200)
- Win rate: 60-70% (improving)
- Elo: 1750+

**Monitor:**
- Task manager: Should show 4 Python processes
- Disk: training.db should grow to ~500 KB
- CPU: Should stay near 100%

---

## Phase 3: Deep Training (4-8 hours)

After Phase 2 succeeds:

```bash
python bot/parallel_training.py 500 4 100
```

**Expected:**
- Runs in 6-10 hours (4-core laptop) or 30 min (16-core cloud)
- Total games in DB: 750 (50 + 200 + 500)
- Win rate: >85% vs random
- Elo: 1900+

---

## Troubleshooting

### Training is too slow
```bash
# Reduce iterations
python bot/training_loop.py 50 20  # 20 iterations instead of 30

# Or use parallel
python bot/parallel_training.py 100 4 30  # 4 cores, 30 iterations
```

### Training crashes
1. Check error message
2. Reduce iterations (30 → 15)
3. Restart Python
4. Check disk space (need 100 MB minimum)
5. Verify Stockfish path

### Database errors
```bash
# Check database integrity
python -c "import sqlite3; sqlite3.connect('training.db').execute('PRAGMA integrity_check')"
```

### Benchmark is slow
```bash
# Reduce iterations
python bot/benchmark.py 20  # 20 iterations instead of 30
```

### Bot not improving
1. Verify Stockfish is loading (add print to fast_mcts_bot.py)
2. Check evaluator isn't always returning 0.5
3. Try higher iterations (30 → 50)
4. Check game engine returns correct winner

---

## Success Indicators

After 50 games:
- [ ] Database has 50-60 games (some might be draws)
- [ ] ~20-25 white wins, 20-25 black wins
- [ ] Win rate vs random: 45-55%
- [ ] Elo around 1650

After 200 games:
- [ ] Database has 250 games total
- [ ] Win rate vs random: 60-75%
- [ ] Elo around 1800

After 500 games:
- [ ] Database has 750 games total
- [ ] Win rate vs random: >85%
- [ ] Elo around 1900

---

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| 50 games time | ~50 min | ___ min |
| 50 games DB size | ~100 KB | ___ KB |
| Win rate after 50 | 45-55% | __% |
| Win rate after 200 | 60-75% | __% |
| Win rate after 500 | >85% | __% |
| Elo after 50 | 1650 | ___ |
| Elo after 200 | 1800 | ___ |
| Elo after 500 | 1900+ | ___ |

---

## Next: Cloud Scaling (Optional)

If laptop training is too slow:

1. Rent **Hetzner CX52** ($20/mo):
   - 16 CPU cores
   - 32 GB RAM
   - SSD storage
   - Ubuntu 22.04

2. Install dependencies:
   ```bash
   sudo apt-get update
   sudo apt-get install -y python3-pip stockfish
   pip install stockfish requests numpy sqlite3
   ```

3. Run training:
   ```bash
   python bot/parallel_training.py 1000 16 100
   ```
   - Expected: ~2 hours for 1000 games
   - Result: Highly optimized bot

---

## Recording Results

After each phase, save metrics:

```bash
# Take screenshot or copy output
python bot/analyze_training.py > results_phase1.txt

# Export training data
# (automatically in training_data.json)

# Create checkpoint
cp training.db training_phase1.db
```

This lets you track progress and rollback if needed.

---

## Final Notes

- **Success = Bot beats Random >50%** ✓ shows MCTS works
- **Strong = Bot beats Random >85%** ✓ shows effective training
- **Excellent = Bot beats Random >95%** ✓ shows optimization

Once you have >90% win rate vs Random, the bot is battle-ready! 🎉
