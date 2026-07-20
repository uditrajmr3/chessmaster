"""Fetches secrets from Azure Key Vault (when AZURE_KEY_VAULT_URL is set) and
sets them as environment variables before execing uvicorn. No-op locally when
AZURE_KEY_VAULT_URL isn't set — pydantic-settings then reads .env as usual.

Runs BEFORE uvicorn imports app.main (and therefore app.config's module-level
`settings = Settings()` singleton), since env vars must be in os.environ
before that instantiation happens.
"""

import os
import sys

SECRET_MAP = [
    ("DATABASE_URL", "CHESSMASTER-DATABASE-URL"),
    ("ANTHROPIC_API_KEY", "CHESSMASTER-ANTHROPIC-API-KEY"),
]


def load_secrets_from_key_vault():
    # Pop (not get) — pydantic-settings' Settings model validates the whole
    # environment strictly (extra="forbid"), so this var must not still be
    # present by the time the uvicorn child process instantiates Settings().
    vault_url = os.environ.pop("AZURE_KEY_VAULT_URL", None)
    if not vault_url:
        print("[secrets] AZURE_KEY_VAULT_URL not set — using .env file only")
        return

    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient

    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_url, credential=credential)

    loaded = 0
    for env_var, secret_name in SECRET_MAP:
        try:
            secret = client.get_secret(secret_name)
            os.environ[env_var] = secret.value
            loaded += 1
        except Exception as exc:  # noqa: BLE001 - deliberately broad, re-raised below unless 404
            status_code = getattr(exc, "status_code", None)
            if status_code == 404:
                print(f"[secrets] {secret_name} not found in vault — leaving {env_var} unset")
                continue
            raise

    print(f"[secrets] Loaded {loaded}/{len(SECRET_MAP)} secrets from Key Vault")


if __name__ == "__main__":
    load_secrets_from_key_vault()
    os.execvp(sys.executable, [sys.executable, "-m", "uvicorn"] + sys.argv[1:])
