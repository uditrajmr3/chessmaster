from fastapi import Depends, HTTPException, status

from .users import fastapi_users
from .models import User

current_active_user = fastapi_users.current_user(active=True)


def current_verified_user(user: User = Depends(current_active_user)) -> User:
    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email not verified")
    return user
