import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from database import engine, Base, get_db
from routes.auth_routes import router as auth_router
from routes.file_routes import router as file_router

# Create tables on startup
Base.metadata.create_all(bind=engine)

# Create storage directory
os.makedirs("storage", exist_ok=True)

app = FastAPI(
    title="SecureShare API",
    description="Zero-trust end-to-end encrypted document sharing platform",
    version="1.0.0",
)

# CORS – allow the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Encrypted-Key", "X-Original-Filename"],
)

# Include routers
app.include_router(auth_router)
app.include_router(file_router)


@app.get("/")
def root():
    return {"message": "SecureShare API is running", "version": "1.0.0"}


@app.get("/health/db")
def health_db():
    """Check if the database connection is working."""
    try:
        # Try to execute a simple query
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "connected", "database": "PostgreSQL"}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}
