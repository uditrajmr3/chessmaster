from sqlalchemy import text
from app.database import engine

def test_postgres_connects():
    with engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1
