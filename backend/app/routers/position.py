from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..config import settings
from ..services.position_vision import PositionReadError, read_position_from_image

router = APIRouter(tags=["position"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10MB


@router.get("/position/access")
def get_position_access(user: User = Depends(current_verified_user)):
    """Whether this user can use the position analyzer right now, and why."""
    if user.has_own_api_key:
        return {"allowed": True, "reason": "own_key"}
    if user.premium_active:
        return {"allowed": True, "reason": "premium"}
    return {"allowed": False, "reason": "locked"}


@router.post("/position/analyze")
async def analyze_position(
    image: UploadFile = File(...),
    user: User = Depends(current_verified_user),
):
    own_key = user.own_anthropic_api_key
    if own_key:
        api_key = own_key
    elif user.premium_active:
        if not settings.anthropic_api_key:
            raise HTTPException(500, "ANTHROPIC_API_KEY not set in .env")
        api_key = settings.anthropic_api_key
    else:
        raise HTTPException(
            402,
            "The position analyzer uses the Claude API, which costs real money "
            "per use. Add your own Anthropic API key in Settings to use it for "
            "free, or upgrade to premium.",
        )

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 10MB).")

    media_type = image.content_type or "application/octet-stream"
    try:
        result = await read_position_from_image(image_bytes, media_type, api_key)
    except PositionReadError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(502, f"Position analysis failed: {e}")

    return result
