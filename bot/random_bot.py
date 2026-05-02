"""
Random Bot - Baseline for benchmarking
Plays random legal moves
"""

import random
from achilles_game import AchillesGame, Color, PieceType


class RandomBot:
    """Bot that plays random legal moves"""
    
    def get_move(self, game: AchillesGame, color: Color):
        """Return a random legal move"""
        legal_moves = game.get_legal_moves(color)
        if not legal_moves:
            return None, None
        
        from_pos, to_pos = random.choice(legal_moves)
        return from_pos, to_pos


class SelfPlayRandom:
    """Random vs Random self-play for testing"""
    
    def play_game(self, max_moves: int = 100) -> tuple:
        """Play a game between two random bots"""
        game = AchillesGame()
        bot = RandomBot()
        
        # Random Achilles selection
        for color in [Color.WHITE, Color.BLACK]:
            while True:
                row, col = random.randint(0, 7), random.randint(0, 7)
                piece = game.board[row][col]
                if piece and piece.color == color and piece.type != PieceType.PAWN:
                    game.set_achilles(color, row, col)
                    break
        
        # Play moves
        for move_num in range(1, max_moves + 1):
            if game.winner:
                return game.winner, move_num
            
            if game.promotion:
                # Random promotion choice
                color = game.promotion['color']
                option = random.choice(['discover', 'change'])
                new_type = random.choice([PieceType.ROOK, PieceType.KNIGHT, 
                                         PieceType.BISHOP, PieceType.QUEEN])
                game.handle_promotion(color, option, new_type)
                continue
            
            color = Color.WHITE if game.turn % 2 == 0 else Color.BLACK
            from_pos, to_pos = bot.get_move(game, color)
            
            if from_pos is None:
                return None, move_num  # Draw
            
            game.apply_move(from_pos, to_pos)
        
        return None, max_moves  # Draw
    
    def play_multiple(self, n_games: int = 100):
        """Play N games and return stats"""
        results = {'white_wins': 0, 'black_wins': 0, 'draws': 0, 'avg_length': 0}
        total_length = 0
        
        for i in range(n_games):
            winner, length = self.play_game()
            total_length += length
            
            if winner == Color.WHITE:
                results['white_wins'] += 1
            elif winner == Color.BLACK:
                results['black_wins'] += 1
            else:
                results['draws'] += 1
            
            if (i + 1) % 20 == 0:
                print(f"  Completed {i+1}/{n_games} random games")
        
        results['avg_length'] = total_length / n_games
        return results


if __name__ == "__main__":
    player = SelfPlayRandom()
    print("Testing Random vs Random (100 games)...")
    results = player.play_multiple(100)
    print(f"\nResults:")
    print(f"  White wins: {results['white_wins']}")
    print(f"  Black wins: {results['black_wins']}")
    print(f"  Draws: {results['draws']}")
    print(f"  Avg game length: {results['avg_length']:.1f} moves")
