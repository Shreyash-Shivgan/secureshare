"""
SecureShare – Database Models
Users and Files tables for zero-trust encrypted document sharing.
"""

import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    public_key = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owned_files = relationship("File", foreign_keys="File.owner_id", back_populates="owner")
    received_files = relationship("File", foreign_keys="File.recipient_id", back_populates="recipient")


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    file_path = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_files")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_files")
