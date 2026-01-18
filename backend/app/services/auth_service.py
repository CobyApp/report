import json
import hashlib
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime
from jose import JWTError, jwt
import bcrypt

# bcrypt rounds (default: 12)
BCRYPT_ROUNDS = 12

# JWT configuration
SECRET_KEY = "your-secret-key-change-in-production"  # Use environment variable in production
ALGORITHM = "HS256"


class AuthService:
    """Authentication and user management service"""
    
    def __init__(self, users_dir: Path):
        self.users_dir = users_dir
        self.users_dir.mkdir(parents=True, exist_ok=True)
        self.users_file = users_dir / "users.json"
        self._ensure_users_file()
    
    def _ensure_users_file(self):
        """Create users file if it doesn't exist"""
        if not self.users_file.exists():
            with open(self.users_file, "w", encoding="utf-8") as f:
                json.dump({}, f)
    
    def _load_users(self) -> Dict:
        """Load user list"""
        with open(self.users_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _save_users(self, users: Dict):
        """Save user list"""
        with open(self.users_file, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
    
    def _hash_password(self, password: str) -> str:
        """Hash password (auto truncate if exceeds 72 bytes) - using bcrypt directly"""
        # Encode to UTF-8 bytes
        password_bytes = password.encode('utf-8')
        # Auto truncate if exceeds 72 bytes (bcrypt limit)
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # Hash with bcrypt (using bytes directly)
        salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        hashed = bcrypt.hashpw(password_bytes, salt)
        # Return as string (bcrypt hash is always ASCII)
        return hashed.decode('ascii')
    
    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password (auto truncate if exceeds 72 bytes) - using bcrypt directly"""
        # Encode to UTF-8 bytes
        password_bytes = plain_password.encode('utf-8')
        # Auto truncate if exceeds 72 bytes (bcrypt limit)
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # Verify with bcrypt (using bytes directly)
        hashed_bytes = hashed_password.encode('ascii')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    
    def register_user(self, username: str, email: str, password: str) -> Dict:
        """Register user"""
        users = self._load_users()
        
        # Check for duplicates
        if username in users:
            raise ValueError("Username already exists")
        
        # Check email duplicates
        for user_data in users.values():
            if user_data.get("email") == email:
                raise ValueError("Email already exists")
        
        # Create new user
        user_id = str(hashlib.md5(username.encode()).hexdigest())
        users[username] = {
            "user_id": user_id,
            "username": username,
            "email": email,
            "hashed_password": self._hash_password(password),
            "created_at": datetime.now().isoformat(),
        }
        
        self._save_users(users)
        
        return {
            "user_id": user_id,
            "username": username,
            "email": email,
        }
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        """Authenticate user"""
        users = self._load_users()
        
        if username not in users:
            return None
        
        user = users[username]
        if not self._verify_password(password, user["hashed_password"]):
            return None
        
        return {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
        }
    
    def get_user(self, username: str) -> Optional[Dict]:
        """Get user information"""
        users = self._load_users()
        return users.get(username)
    
    def create_access_token(self, data: Dict) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            return None
