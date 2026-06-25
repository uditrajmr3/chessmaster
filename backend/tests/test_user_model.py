from app.auth.models import User


def test_user_has_platform_username_columns():
    cols = User.__table__.columns.keys()
    assert "lichess_username" in cols
    assert "chesscom_username" in cols
    assert "is_verified" in cols
