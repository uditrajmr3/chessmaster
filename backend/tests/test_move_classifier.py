"""Tests for move classification based on centipawn loss."""

from app.services.move_classifier import classify_move


class TestClassifyMove:
    # ── Best-move paths ──────────────────────────────────────────────

    def test_brilliant_move(self):
        """Brilliant: best move, was losing (eval < -50), now winning (eval > 50)."""
        assert classify_move(0, -100, 200, is_best_move=True) == "brilliant"

    def test_great_move(self):
        """Great: best move with zero CPL but not a turnaround."""
        assert classify_move(0, 50, 50, is_best_move=True) == "great"

    def test_great_move_no_eval(self):
        """Great: best move when evals are None (no turnaround check possible)."""
        assert classify_move(0, None, None, is_best_move=True) == "great"

    # ── CPL-based classifications ────────────────────────────────────

    def test_good_tiny_loss(self):
        assert classify_move(5, 100, 95, is_best_move=False) == "good"

    def test_good_small_loss(self):
        assert classify_move(20, 100, 80, is_best_move=False) == "good"

    def test_inaccuracy_lower_bound(self):
        assert classify_move(30, 100, 70, is_best_move=False) == "inaccuracy"

    def test_inaccuracy_upper_bound(self):
        assert classify_move(50, 100, 50, is_best_move=False) == "inaccuracy"

    def test_mistake_lower_bound(self):
        assert classify_move(60, 100, 40, is_best_move=False) == "mistake"

    def test_mistake_upper_bound(self):
        assert classify_move(150, 100, -50, is_best_move=False) == "mistake"

    def test_blunder(self):
        assert classify_move(200, 100, -100, is_best_move=False) == "blunder"

    def test_blunder_large(self):
        assert classify_move(500, 300, -200, is_best_move=False) == "blunder"

    # ── Edge cases ───────────────────────────────────────────────────

    def test_negative_cpl_treated_as_zero(self):
        """Negative CPL should be clamped to 0 → 'good' for non-best move."""
        assert classify_move(-10, 100, 110, is_best_move=False) == "good"

    def test_zero_cpl_non_best(self):
        assert classify_move(0, 100, 100, is_best_move=False) == "good"

    def test_boundary_25_is_good(self):
        assert classify_move(25, 100, 75, is_best_move=False) == "good"

    def test_boundary_26_is_inaccuracy(self):
        assert classify_move(26, 100, 74, is_best_move=False) == "inaccuracy"

    def test_boundary_151_is_blunder(self):
        assert classify_move(151, 100, -51, is_best_move=False) == "blunder"
