#!/usr/bin/env python3
"""
Bot Interface Layer - Provides clean APIs for interactive UIs
Adapts fast_mcts_bot.py and other bots to UI-friendly interfaces
"""

from achilles_game import AchillesGame
from fast_mcts_bot import MCTSBot
from random_bot import RandomBot

class BotInterface:
    """Unified interface for bot move selection"""
    
    def __init__(self, bot_type='mcts', iterations=30):
        self.bot_type = bot_type
        self.iterations = iterations
        
        if bot_type == 'mcts':
            self.bot = MCTSBot()
        elif bot_type == 'random':
            self.bot = RandomBot()
        else:
            self.bot = MCTSBot()
    
    def get_best_move(self, game, color, iterations=None):
        """
        Get best move from bot
        
        Args:
            game: AchillesGame instance
            color: 'white' or 'black'
            iterations: MCTS iterations (defaults to self.iterations)
        
        Returns:
            (move, stats) tuple where:
            - move: ((from_row, from_col), (to_row, to_col))
            - stats: {'visits': int, 'win_pct': float}
        """
        if iterations is None:
            iterations = self.iterations
        
        try:
            if self.bot_type == 'mcts':
                # Use fast_mcts_bot interface
                return self._get_mcts_move(game, color, iterations)
            elif self.bot_type == 'random':
                # Use random_bot interface
                return self._get_random_move(game, color)
        except Exception as e:
            print(f"Error getting move: {e}")
            return None
    
    def _get_mcts_move(self, game, color, iterations):
        """Get move from MCTS bot"""
        # Find all legal moves
        legal_moves = []
        for piece in game.pieces:
            if piece.color == color:
                moves = game.get_legal_moves((piece.row, piece.col))
                for move in moves:
                    legal_moves.append(((piece.row, piece.col), move))
        
        if not legal_moves:
            return None
        
        # Use MCTS to find best move
        best_move = None
        best_score = -1
        move_stats = None
        
        for attempt in range(min(3, len(legal_moves))):  # Try top 3 moves
            # Simulate the move
            test_game = AchillesGame()
            test_game.board = [row[:] for row in game.board]
            test_game.pieces = [p for p in game.pieces]
            test_game.achilles = game.achilles
            test_game.black_achilles = game.black_achilles
            
            try:
                move = legal_moves[attempt]
                test_game.apply_move(move[0], move[1])
                
                # Evaluate with MCTS
                root = self.bot.MCTSNode(None, 1.0, test_game, opposite_color(color))
                
                for _ in range(iterations // len(legal_moves)):
                    self.bot._mcts_search(root)
                
                # Get best child based on visits
                if root.children:
                    best_child = max(root.children.values(), 
                                   key=lambda n: n.visits if n.visits > 0 else 0)
                    
                    score = best_child.wins / best_child.visits if best_child.visits > 0 else 0
                    
                    if score > best_score:
                        best_score = score
                        best_move = move
                        move_stats = {
                            'visits': best_child.visits,
                            'win_pct': (score * 100)
                        }
            except:
                continue
        
        if best_move is None and legal_moves:
            best_move = legal_moves[0]
            move_stats = {'visits': 0, 'win_pct': 50.0}
        
        return (best_move, move_stats) if best_move else None
    
    def _get_random_move(self, game, color):
        """Get move from random bot"""
        import random
        
        legal_moves = []
        for piece in game.pieces:
            if piece.color == color:
                moves = game.get_legal_moves((piece.row, piece.col))
                for move in moves:
                    legal_moves.append(((piece.row, piece.col), move))
        
        if not legal_moves:
            return None
        
        move = random.choice(legal_moves)
        return (move, {'visits': 1, 'win_pct': 50.0})

def opposite_color(color):
    """Get opposite color"""
    return 'black' if color == 'white' else 'white'

def play_game(white_bot, black_bot, max_moves=200):
    """
    Play a complete game between two bots
    
    Args:
        white_bot: BotInterface instance for white
        black_bot: BotInterface instance for black
        max_moves: Maximum moves before draw
    
    Returns:
        {
            'winner': 'white', 'black', or 'draw',
            'moves': [(move, stats), ...],
            'move_count': int
        }
    """
    game = AchillesGame()
    
    # Set random Achilles
    import random
    game.set_achilles('white', random.randint(0, 7), random.randint(0, 7))
    game.set_achilles('black', random.randint(0, 7), random.randint(0, 7))
    
    moves = []
    current_color = 'white'
    move_count = 0
    
    while move_count < max_moves:
        bot = white_bot if current_color == 'white' else black_bot
        
        result = bot.get_best_move(game, current_color)
        
        if result is None:
            # No legal moves = loss
            winner = 'black' if current_color == 'white' else 'white'
            return {
                'winner': winner,
                'moves': moves,
                'move_count': move_count,
                'reason': 'no_legal_moves'
            }
        
        move, stats = result
        moves.append((move, stats))
        
        try:
            game.apply_move(move[0], move[1])
        except Exception as e:
            print(f"Error applying move: {e}")
            return {
                'winner': 'black' if current_color == 'white' else 'white',
                'moves': moves,
                'move_count': move_count,
                'reason': 'error'
            }
        
        # Check if game over (Achilles captured)
        white_achilles_alive = any(
            p.color == 'white' and (p.row, p.col) == game.achilles
            for p in game.pieces
        ) if game.achilles else False
        
        black_achilles_alive = any(
            p.color == 'black' and (p.row, p.col) == game.black_achilles
            for p in game.pieces
        ) if game.black_achilles else False
        
        if not white_achilles_alive:
            return {
                'winner': 'black',
                'moves': moves,
                'move_count': move_count + 1,
                'reason': 'achilles_captured'
            }
        
        if not black_achilles_alive:
            return {
                'winner': 'white',
                'moves': moves,
                'move_count': move_count + 1,
                'reason': 'achilles_captured'
            }
        
        move_count += 1
        current_color = opposite_color(current_color)
    
    return {
        'winner': 'draw',
        'moves': moves,
        'move_count': move_count,
        'reason': 'max_moves'
    }

# Export
__all__ = ['BotInterface', 'play_game', 'opposite_color']
