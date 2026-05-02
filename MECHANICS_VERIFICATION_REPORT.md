# Achilles Heel Chess - Mechanics Verification Report

## Test Results Summary
- **Passed:** 25/27 tests
- **Failed:** 2 tests (both related to Patroclus position logic)

## Issues Found

### Issue #1: Patroclus Mirror Position Calculation ❌

**Test 2.1 Failed:** Mirror Patroclus at opposite position
- Expected: Patroclus at (0,4) when Achilles set at (7,4)
- Actual: Patroclus at (7,3)
- **Root Cause:** Fallback logic finds first matching piece instead of preferring mirror pair

**Test 9.2 Failed:** Patroclus position tracked correctly
- Expected specific positions not matching
- **Root Cause:** Same as above

### Analysis

The current `set_achilles()` logic has a conceptual issue:

```python
mirror_row = 7 - row  # Looks for opposite rank
mirror_piece = self.board[mirror_row][col]

if (mirror_piece and mirror_piece.color == color and ...):
    self.patroclus[color] = mirror_piece
else:
    # Fallback: find ANY piece of same type
    for r in range(8):
        for c in range(8):
            p = self.board[r][c]
            if (p and p.color == color and p.type == piece.type and p != piece):
                self.patroclus[color] = p
                break
```

**Problem:** 
- When Achilles is White Queen at (7,4), mirror_row = 0
- board[0][4] is BLACK Queen (different color), so check fails
- Fallback finds first White Queen, which is at (7,3)

**Issue:** The mirror position check is looking at opposite rank, but Patroclus should be the SAME PLAYER's other piece of the same type.

### Intended Behavior (Inferred)

Based on chess back rank setup:
- Column 0,7 = Rooks (outer)
- Column 1,6 = Knights
- Column 2,5 = Bishops
- Column 3,4 = Queens

Within same player:
- White Queen at (7,3) pairs with White Queen at (7,4)
- White Rook at (7,0) pairs with White Rook at (7,7)
- Black Queen at (0,3) pairs with Black Queen at (0,4)

### Fix Required

The mirror search should:
1. Look for piece at SAME PLAYER, SAME TYPE, SAME RANK (not opposite rank)
2. Prefer horizontally adjacent pieces (columns mirror: 0↔7, 1↔6, 2↔5, 3↔4)
3. Only fallback to any same-type piece if no horizontal mirror exists

### Code Changes Needed

In `set_achilles()` method, replace:

```python
# OLD CODE - WRONG
mirror_row = 7 - row
mirror_piece = self.board[mirror_row][col]

if (mirror_piece and mirror_piece.color == color and 
    mirror_piece.type == piece.type and mirror_piece != piece):
    self.patroclus[color] = mirror_piece
```

With:

```python
# NEW CODE - CORRECT
# Find horizontal mirror (same rank, opposite column)
mirror_col = 7 - col  # Horizontal mirror: 0↔7, 1↔6, 2↔5, 3↔4
mirror_piece = self.board[row][mirror_col]

if (mirror_piece and mirror_piece.color == color and 
    mirror_piece.type == piece.type and mirror_piece != piece):
    self.patroclus[color] = mirror_piece
```

## Verification Summary

### ✅ Passing Mechanics

1. **Achilles Selection** - All 4 tests pass
   - Cannot set pawn as Achilles ✓
   - Cannot set twice ✓
   - Both colors can have Achilles ✓
   - Can set Knight, Rook, Bishop as Achilles ✓

2. **Immortality System** - All 4 tests pass
   - Initial state correct ✓
   - Countdown set to 5 ✓
   - Countdown ticks down ✓
   - Expires after 5 ticks ✓

3. **Immortal Clash** - All 2 tests pass
   - Detection logic exists ✓
   - Clash mechanic implemented ✓

4. **Pawn Promotion** - All 2 tests pass
   - Promotion triggering mechanism ✓
   - Both colors handled ✓

5. **Game Mechanics** - All tests pass
   - Winner tracking ✓
   - Achilles capture detection ✓
   - Turn tracking ✓
   - Legal move generation ✓

### ⚠️ Failing Mechanics

1. **Patroclus Mirror Calculation** - 2 tests fail
   - Should use horizontal mirror, not vertical
   - Logic looks for opposite rank instead of opposite column

## Impact Assessment

**Severity:** MEDIUM
- **Gameplay Impact:** Affects which piece becomes Patroclus (immortality trigger)
- **Current Behavior:** Still works, but picks arbitrary piece from fallback
- **Recommended:** Fix before serious training to ensure correct immortality mechanics

**When to Fix:**
- Critical for training accuracy ✓
- Should fix now before 50-game training run
- Will affect bot strategy learning (immortality is key mechanic)

## Recommended Actions

1. ✅ Fix `set_achilles()` mirror calculation
2. ✅ Re-run verification tests
3. ✅ Test immortality mechanics with correct Patroclus
4. ✅ Then proceed to training pipeline

## Code Location

File: `bot/achilles_game.py`
Method: `set_achilles()` 
Lines: ~113-135

## Testing Command

```bash
python bot/verify_mechanics.py
```

Expected after fix: 27/27 tests pass ✓

---

## Patroclus Concept Review

**Current Understanding:**
- Achilles: Your secret piece (chosen by you)
- Patroclus: Your other piece of same type (automatically selected)
- Mechanic: If opponent captures YOUR Patroclus, YOU become immortal (5 turns)

**Mirror Setup (Horizontal Within Rank):**
```
White back rank (row 7):
Col:  0     1      2      3     4      5      6     7
     Rook Knight Bishop Queen Queen Bishop Knight Rook
     └──────────────┬─────────────────┘
                 Mirrors at columns 3↔4, 2↔5, 1↔6, 0↔7

Black back rank (row 0):
Col:  0     1      2      3     4      5      6     7
     Rook Knight Bishop Queen Queen Bishop Knight Rook
     └──────────────┬─────────────────┘
                 Mirrors at columns 3↔4, 2↔5, 1↔6, 0↔7
```

So the fix is: change from vertical mirror (7-row) to horizontal mirror (7-col).
