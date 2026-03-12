"""
SecureShare – File Routes
POST /upload, GET /files, GET /download/{file_id}
The backend NEVER decrypts anything – it only stores and serves encrypted blobs.
"""

import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import File as FileModel, User
from auth import get_current_user

router = APIRouter(tags=["Files"])

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class FileInfo(BaseModel):
    id: int
    filename: str
    owner_id: int
    owner_email: str
    recipient_id: int
    recipient_email: str
    encrypted_key: str
    uploaded_at: str

    class Config:
        from_attributes = True


class UserInfo(BaseModel):
    id: int
    email: str
    public_key: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    encrypted_key: str = Form(...),
    recipient_id: int = Form(...),
    original_filename: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload an encrypted file.
    Expects:
      - file: the AES-GCM encrypted file blob (binary)
      - encrypted_key: base64-encoded RSA-wrapped AES key
      - recipient_id: target user ID
      - original_filename: original name of the file
    """
    # Validate recipient exists
    recipient = db.query(User).filter(User.id == recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    # Read file content and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50MB limit")

    # Save encrypted file to storage
    os.makedirs(STORAGE_DIR, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}_{original_filename}.enc"
    file_path = os.path.join(STORAGE_DIR, stored_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Save metadata to DB
    db_file = FileModel(
        filename=original_filename,
        owner_id=current_user.id,
        recipient_id=recipient_id,
        encrypted_key=encrypted_key,
        file_path=file_path,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {"message": "File uploaded successfully", "file_id": db_file.id}


@router.get("/files", response_model=List[FileInfo])
def list_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List files where current user is owner or recipient."""
    files = (
        db.query(FileModel)
        .filter(
            (FileModel.owner_id == current_user.id)
            | (FileModel.recipient_id == current_user.id)
        )
        .all()
    )

    result = []
    for f in files:
        owner = db.query(User).filter(User.id == f.owner_id).first()
        recipient = db.query(User).filter(User.id == f.recipient_id).first()
        result.append(
            FileInfo(
                id=f.id,
                filename=f.filename,
                owner_id=f.owner_id,
                owner_email=owner.email if owner else "unknown",
                recipient_id=f.recipient_id,
                recipient_email=recipient.email if recipient else "unknown",
                encrypted_key=f.encrypted_key,
                uploaded_at=f.uploaded_at.isoformat() if f.uploaded_at else "",
            )
        )
    return result


@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download an encrypted file. Only owner or recipient can access."""
    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Authorization: only owner or recipient
    if db_file.owner_id != current_user.id and db_file.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=404, detail="Encrypted file not found on disk")

    return FileResponse(
        path=db_file.file_path,
        filename=f"{db_file.filename}.enc",
        media_type="application/octet-stream",
        headers={
            "X-Encrypted-Key": db_file.encrypted_key,
            "X-Original-Filename": db_file.filename,
        },
    )


@router.get("/users", response_model=List[UserInfo])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all users (for selecting recipients). Excludes current user."""
    users = db.query(User).filter(User.id != current_user.id).all()
    return [
        UserInfo(id=u.id, email=u.email, public_key=u.public_key)
        for u in users
    ]


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return current user's profile including their public key."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "public_key": current_user.public_key,
    }

