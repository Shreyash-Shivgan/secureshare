import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine, Base
from routes.auth_routes import router as auth_router
from routes.file_routes import router as file_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    os.makedirs("storage", exist_ok=True)
    yield
    # Shutdown (if needed)


app = FastAPI(
    title="SecureShare API",
    description="Zero-trust end-to-end encrypted document sharing platform",
    version="1.0.0",
    lifespan=lifespan,
)


# CORS configuration
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://secureshare-mocha-iota.vercel.app",  # your deployed frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Encrypted-Key", "X-Original-Filename"],
)


# Include API routes
app.include_router(auth_router)
app.include_router(file_router)


# Root endpoint
@app.get("/")
def root():
    return {"message": "SecureShare API is running", "version": "1.0.0"}


# Database health check
@app.get("/health/db")
def health_db():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "connected", "database": "PostgreSQL"}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}
