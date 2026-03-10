from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from dependencies import get_db, get_current_user
from models.user import User

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me")
def get_me(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "profile_pic_url": getattr(user, "profile_pic_url", None),
        "is_profile_complete": getattr(user, "is_profile_complete", False),
    }

@router.patch("/me")
def update_me(data: dict, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if "name" in data and isinstance(data.get("name"), str):
        user.name = data["name"].strip() or user.name

    if "profile_pic_url" in data:
        val = data.get("profile_pic_url")
        if val is None or isinstance(val, str):
            user.profile_pic_url = val

    # Setup flow: allow explicitly marking profile completion
    if "is_profile_complete" in data and isinstance(data.get("is_profile_complete"), bool):
        user.is_profile_complete = data["is_profile_complete"]

    db.commit()
    return {"success": True}

@router.post("/me/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are supported")

    raw = await file.read()
    # 2MB guardrail (keeps DB from ballooning)
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large (max 2MB)")

    import base64

    encoded = base64.b64encode(raw).decode("utf-8")
    user.profile_pic_url = f"data:{file.content_type};base64,{encoded}"
    db.commit()

    return {"success": True, "profile_pic_url": user.profile_pic_url}


@router.delete("/me/profile-picture")
def remove_profile_picture(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.profile_pic_url = None
    db.commit()
    return {"success": True}
