from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash

db = SessionLocal()

# Find the CEO
user = db.query(User).filter(User.email == "ceo@digitalsanctum.com.au").first()

if user:
    print(f"Found user: {user.email}")
    # Update with a hashed version of 'sovereign2025'
    user.password_hash = get_password_hash("sovereign2025")
    db.commit()
    print("Password successfully hashed and updated.")
else:
    print("User not found.")
    
db.close()
