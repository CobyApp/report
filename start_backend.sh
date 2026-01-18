#!/bin/bash
cd "$(dirname "$0")/backend"

echo "백엔드 서버 시작 중..."

# 가상환경 확인 및 생성
if [ ! -d "venv" ]; then
    echo "가상환경 생성 중..."
    python3 -m venv venv
fi

# 가상환경 활성화
source venv/bin/activate

# 패키지 설치
echo "패키지 설치 중..."
pip install -q -r requirements.txt

# 서버 실행
echo "백엔드 서버 실행: http://localhost:8000"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
