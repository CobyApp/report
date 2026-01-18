import json
import hashlib
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime
from jose import JWTError, jwt
import bcrypt

# bcrypt 라운드 수 (기본값: 12)
BCRYPT_ROUNDS = 12

# JWT 설정
SECRET_KEY = "your-secret-key-change-in-production"  # 프로덕션에서는 환경변수로 관리
ALGORITHM = "HS256"


class AuthService:
    """인증 및 사용자 관리 서비스"""
    
    def __init__(self, users_dir: Path):
        self.users_dir = users_dir
        self.users_dir.mkdir(parents=True, exist_ok=True)
        self.users_file = users_dir / "users.json"
        self._ensure_users_file()
    
    def _ensure_users_file(self):
        """사용자 파일이 없으면 생성"""
        if not self.users_file.exists():
            with open(self.users_file, "w", encoding="utf-8") as f:
                json.dump({}, f)
    
    def _load_users(self) -> Dict:
        """사용자 목록 로드"""
        with open(self.users_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _save_users(self, users: Dict):
        """사용자 목록 저장"""
        with open(self.users_file, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
    
    def _hash_password(self, password: str) -> str:
        """비밀번호 해싱 (72바이트 초과 시 자동 truncate) - bcrypt 직접 사용"""
        # UTF-8로 인코딩하여 바이트로 변환
        password_bytes = password.encode('utf-8')
        # 72바이트를 초과하면 자동으로 잘라냄 (bcrypt 제한)
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # bcrypt로 해싱 (바이트를 직접 사용)
        salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        hashed = bcrypt.hashpw(password_bytes, salt)
        # 문자열로 반환 (bcrypt 해시는 항상 ASCII)
        return hashed.decode('ascii')
    
    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """비밀번호 검증 (72바이트 초과 시 자동 truncate) - bcrypt 직접 사용"""
        # UTF-8로 인코딩하여 바이트로 변환
        password_bytes = plain_password.encode('utf-8')
        # 72바이트를 초과하면 자동으로 잘라냄 (bcrypt 제한)
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # bcrypt로 검증 (바이트를 직접 사용)
        hashed_bytes = hashed_password.encode('ascii')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    
    def register_user(self, username: str, email: str, password: str) -> Dict:
        """사용자 등록"""
        users = self._load_users()
        
        # 중복 확인
        if username in users:
            raise ValueError("Username already exists")
        
        # 이메일 중복 확인
        for user_data in users.values():
            if user_data.get("email") == email:
                raise ValueError("Email already exists")
        
        # 새 사용자 생성
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
        """사용자 인증"""
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
        """사용자 정보 조회"""
        users = self._load_users()
        return users.get(username)
    
    def create_access_token(self, data: Dict) -> str:
        """JWT 액세스 토큰 생성"""
        to_encode = data.copy()
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict]:
        """JWT 토큰 검증"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            return None
