from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# 1. Load the secrets
load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Create the Engine
# check_same_thread=False is needed only for SQLite. Postgres handles threading natively.
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Create the Session Local
# Each request will get its own database session.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base class for our Models
Base = declarative_base()

# 5. Dependency Injection
# This function ensures the DB connection opens and closes with every request safely.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
