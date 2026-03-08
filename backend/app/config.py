from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///data/chessmaster.db"
    stockfish_path: str = ""
    anthropic_api_key: str = ""
    stockfish_depth: int = 20
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def resolve_stockfish(self) -> str | None:
        import shutil

        if self.stockfish_path:
            p = Path(self.stockfish_path)
            if not p.is_absolute():
                p = Path(__file__).parent.parent / self.stockfish_path
            if p.exists():
                return str(p)
            return self.stockfish_path
        # Check local stockfish directory
        local = Path(__file__).parent.parent / "stockfish" / "stockfish.exe"
        if local.exists():
            return str(local)
        local_unix = Path(__file__).parent.parent / "stockfish" / "stockfish"
        if local_unix.exists():
            return str(local_unix)
        # Check system PATH
        found = shutil.which("stockfish")
        if found:
            return found
        return None


settings = Settings()
