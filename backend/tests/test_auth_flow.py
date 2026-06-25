from app.auth.users import fastapi_users, auth_backend


def test_auth_objects_exist():
    assert auth_backend.name == "cookie"
    assert fastapi_users is not None
