"""
MCTS Bot for Achilles Heel Chess
Uses Monte Carlo Tree Search with Stockfish as value function
"""

import requests
import math
import random
import json
import copy
from stockfish import Stockfish

# Backend config
BACKEND_URL = "http://localhost:10000"

# Stockfish setup
sf = None
stockfish_paths = [
    "C:\\Users\\anshg\\Downloads\\stockfish\\stockfish-windows-x86-64-avx2.exe",
    "C:\\Program Files\\stockfish\\stockfish.exe",
    "/usr/bin/stockfish",
    "/opt/homebrew/bin/stockfish",
]

for path in stockfish_paths:
    try:
        sf = Stockfish(path)
        print(f"✓ Loaded Stockfish from: {path}")
        break
    except Exception as e:
        pass

if not sf:
    print("⚠️  Stockfish not found. Bot will play without position evaluation.")


class MCTSNode:
    """Node in the Monte Carlo Tree"""
    def __init__(self, move=None, parent=None, state=None):
        self.move = move          # (from, to) tuple
        self.parent = parent
        self.children = []
        self.wins = 0             # For white perspective
        self.visits = 0
        self.state = state        # Game state at this node

    def ucb1(self, c=1.4):
        """Upper Confidence Bound for Trees"""
        if self.visits == 0:
            return float('inf')
        exploitation = self.wins / self.visits
        exploration = c * math.sqrt(math.log(self.parent.visits) / self.visits)
        return exploitation + exploration

    def is_fully_expanded(self, num_moves):
        return len(self.children) == num_moves

    def best_child(self, c=1.4):
        if not self.children:
            return None
        return max(self.children, key=lambda n: n.ucb1(c))

    def backpropagate(self, value):
        """Backprop result up the tree (value is from white's perspective)"""
        self.visits += 1
        self.wins += value
        if self.parent:
            self.parent.backpropagate(value)


class GameSimulator:
    """Local game state simulator - mimics backend engine logic"""
    
    def __init__(self, backend_api):
        self.api = backend_api
    
    def clone_state(self, state):
        """Deep copy of game state"""
        return copy.deepcopy(state)
    
    def board_to_simple_fen(self, board):
        """Convert board to FEN-like string for Stockfish"""
        fen_rows = []
        for row in board:
            fen_row = ""
            empty = 0
            for piece in row:
                if piece is None:
                    empty += 1
                else:
                    if empty > 0:
                        fen_row += str(empty)
                        empty = 0
                    piece_char = piece['type'][0].lower() if piece['color'] == 'black' else piece['type'][0].upper()
                    fen_row += piece_char
            if empty > 0:
                fen_row += str(empty)
            fen_rows.append(fen_row)
        return '/'.join(fen_rows)
    
    def get_legal_moves_local(self, game_id, state, row, col):
        """Get legal moves for a piece via API"""
        moves = self.api.get_legal_moves(game_id, row, col)
        return moves
    
    def get_all_legal_moves(self, game_id, state, color):
        """Get all legal moves for a color"""
        all_moves = []
        for r in range(8):
            for c in range(8):
                piece = state['board'][r][c]
                if piece and piece['color'] == color:
                    moves = self.get_legal_moves_local(game_id, state, r, c)
                    for move in moves:
                        all_moves.append(([r, c], move))
        return all_moves


class AchillesBot:
    """MCTS-based bot for Achilles Heel"""
    
    def __init__(self, backend_url=BACKEND_URL):
        self.backend_url = backend_url
        self.sf = sf
        self.sim = GameSimulator(self)
    
    def get_game_state(self, game_id):
        """Fetch current game state from backend"""
        resp = requests.get(f"{self.backend_url}/api/bot/game/{game_id}/state")
        return resp.json()
    
    def get_legal_moves(self, game_id, row, col):
        """Get legal moves for a piece"""
        resp = requests.get(f"{self.backend_url}/api/bot/game/{game_id}/legal-moves/{row}/{col}")
        data = resp.json()
        return data.get('moves', [])
    
    def apply_move_backend(self, game_id, from_pos, to_pos):
        """Apply a move on the backend"""
        resp = requests.post(
            f"{self.backend_url}/api/bot/game/{game_id}/move",
            json={'from': from_pos, 'to': to_pos}
        )
        return resp.json()
    
    def set_achilles_backend(self, game_id, color, row, col):
        """Set Achilles on the backend"""
        resp = requests.post(
            f"{self.backend_url}/api/bot/game/{game_id}/set-achilles",
            json={'color': color, 'row': row, 'col': col}
        )
        return resp.json()
    
    def stockfish_eval(self, fen):
        """Evaluate a position with Stockfish (centipawn, 100 = pawn)"""
        if not self.sf:
            return 0.0
        try:
            self.sf.set_fen_position(fen)
            eval_data = self.sf.get_evaluation()
            if eval_data['type'] == 'cp':
                return eval_data['value'] / 100.0  # Convert to pawn units
            else:  # Mate score
                return 10.0 if eval_data['value'] > 0 else -10.0
        except:
            return 0.0
    
    def mcts_search(self, game_id, iterations=50, color='white'):
        """
        Fast MCTS - evaluates current board + move heuristics without backend simulation
        Returns the best move for the given color
        """
        state = self.get_game_state(game_id)
        if state.get('winner'):
            return None, None
        
        legal_moves = self.sim.get_all_legal_moves(game_id, state, color)
        if not legal_moves:
            print(f"No legal moves for {color}!")
            return None, None
        
        print(f"MCTS Fast Eval: {len(legal_moves)} legal moves, {iterations} iterations")
        
        # Evaluate current board once
        current_fen = self.sim.board_to_simple_fen(state['board'])
        current_eval = self.stockfish_eval(current_fen)
        
        # Score each move heuristically
        move_scores = {}
        for i, (from_pos, to_pos) in enumerate(legal_moves):
            from_r, from_c = from_pos
            to_r, to_c = to_pos
            
            target = state['board'][to_r][to_c]
            moving_piece = state['board'][from_r][from_c]
            
            score = 0.5  # Neutral baseline
            
            # Bonus for capturing
            if target:
                piece_values = {'Pawn': 1, 'Knight': 3, 'Bishop': 3, 'Rook': 5, 'Queen': 9}
                value = piece_values.get(target['type'], 1)
                score += 0.05 * value  # Capture bonus
            
            # Bonus for advancing pawns
            if moving_piece['type'] == 'Pawn':
                if color == 'white':
                    score += 0.02 * (7 - to_r)  # Closer to enemy
                else:
                    score += 0.02 * to_r  # Closer to enemy
            
            # Bonus for centralizing
            dist_to_center = abs(to_c - 3.5) + abs(to_r - 3.5)
            score += 0.01 * (8 - dist_to_center)
            
            # Use tuple keys for dict
            move_key = (tuple(from_pos), tuple(to_pos))
            move_scores[move_key] = score
        
        # Softmax: pick moves probabilistically based on score
        import math
        exp_scores = [math.exp(score * 2) for score in move_scores.values()]
        total = sum(exp_scores)
        
        # Run iterations - pick best move probabilistically
        move_visits = {}
        move_wins = {}
        for move in legal_moves:
            move_key = (tuple(move[0]), tuple(move[1]))
            move_visits[move_key] = 0
            move_wins[move_key] = 0.0
        
        for i in range(iterations):
            # Sample move based on heuristic scores
            probs = [exp_scores[j] / total for j in range(len(legal_moves))]
            import random
            sampled_move = random.choices(legal_moves, weights=probs, k=1)[0]
            
            move_key = (tuple(sampled_move[0]), tuple(sampled_move[1]))
            move_visits[move_key] += 1
            # Value is the heuristic score
            move_wins[move_key] += move_scores[move_key]
            
            if (i + 1) % 25 == 0:
                print(f"  Iteration {i+1}/{iterations}")
        
        # Pick most visited
        best_move_key = max(move_visits.keys(), key=lambda m: move_visits.get(m, 0))
        from_pos = list(best_move_key[0])
        to_pos = list(best_move_key[1])
        
        visits = move_visits[best_move_key]
        avg_score = move_wins[best_move_key] / visits if visits > 0 else 0
        print(f"Best move: {from_pos} -> {to_pos} (Score: {avg_score:.3f})")
        
        return from_pos, to_pos
    
    def self_play_game(self, max_moves=200):
        """Play a complete game (white vs black) using MCTS"""
        print("🎮 Starting self-play game...")
        print("=" * 60)
        
        # Create game
        resp = requests.post(f"{self.backend_url}/api/bot/game/start")
        game_id = resp.json()['gameId']
        print(f"Game ID: {game_id}")
        
        # Set Achilles for both sides (random)
        state = self.get_game_state(game_id)
        
        for color in ['white', 'black']:
            while True:
                row, col = random.randint(0, 7), random.randint(0, 7)
                piece = state['board'][row][col]
                if piece and piece['color'] == color and piece['type'] != 'Pawn':
                    resp = self.set_achilles_backend(game_id, color, row, col)
                    state = resp['state']
                    print(f"✓ {color} Achilles: {piece['type']} at ({row},{col})")
                    break
        
        # Play moves
        move_count = 0
        while move_count < max_moves:
            state = self.get_game_state(game_id)
            
            if state.get('winner'):
                print(f"\n🏆 {state['winner'].upper()} WINS!")
                return state
            
            if state.get('promotion'):
                print(f"\n❌ Promotion pending (not auto-handled yet)")
                return state
            
            color = 'white' if state['turn'] % 2 == 0 else 'black'
            print(f"\n--- Move {move_count + 1}: {color.upper()}'s Turn ---")
            
            # MCTS search (fast version)
            from_pos, to_pos = self.mcts_search(game_id, iterations=20, color=color)
            
            if from_pos is None:
                print(f"❌ No move found, {color} loses")
                return state
            
            # Apply move on backend
            result = self.apply_move_backend(game_id, from_pos, to_pos)
            if not result.get('success'):
                print(f"❌ Move failed!")
                return state
            
            move_count += 1
            print(f"✓ Played: {from_pos} -> {to_pos}")
        
        print(f"\n⏱️  Game ended after {move_count} moves (move limit reached)")
        return self.get_game_state(game_id)


if __name__ == "__main__":
    bot = AchillesBot()
    
    print("🤖 Achilles Heel - MCTS Bot with Stockfish")
    print("=" * 60)
    
    # Play a test game
    final_state = bot.self_play_game(max_moves=30)
