#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 PDF 템플릿 자동화 엔진 시작..."
echo ""

# 포트 8000, 3000 사용 중인 프로세스 종료
echo "기존 프로세스 정리 중..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# 백엔드 시작
echo "📦 백엔드 서버 시작 중..."
cd backend

# 가상환경 확인 및 생성
if [ ! -d "venv" ]; then
    echo "가상환경 생성 중..."
    python3 -m venv venv
fi

# 가상환경 활성화
source venv/bin/activate

# Python 경로 확인
PYTHON_BIN=$(which python || echo "$PWD/venv/bin/python")
PIP_BIN=$(which pip || echo "$PWD/venv/bin/pip")

# 패키지 설치 (필요시)
if ! $PYTHON_BIN -c "import fastapi" 2>/dev/null; then
    echo "패키지 설치 중..."
    $PIP_BIN install -q -r requirements.txt
else
    # passlib, bcrypt 확인 및 설치
    if ! $PYTHON_BIN -c "import passlib" 2>/dev/null; then
        echo "인증 패키지 설치 중..."
        $PIP_BIN install -q passlib[bcrypt] bcrypt
    fi
fi

# 백엔드 백그라운드 실행
echo "✅ 백엔드 서버 시작: http://localhost:8000"
$PYTHON_BIN -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ../backend.log 2>&1 &
BACKEND_PID=$!

cd ..

# 프론트엔드 시작
echo "🎨 프론트엔드 서버 시작 중..."
cd frontend

# node_modules 확인 및 설치
if [ ! -d "node_modules" ]; then
    echo "npm 패키지 설치 중..."
    npm install
fi

# 프론트엔드 백그라운드 실행
echo "✅ 프론트엔드 서버 시작: http://localhost:3000"
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 서버 실행 완료!"
echo ""
echo "  백엔드:   http://localhost:8000"
echo "  프론트엔드: http://localhost:3000"
echo ""
echo "  프로세스 ID:"
echo "    백엔드:   $BACKEND_PID"
echo "    프론트엔드: $FRONTEND_PID"
echo ""
echo "  로그 파일:"
echo "    백엔드:   backend.log"
echo "    프론트엔드: frontend.log"
echo ""
echo "  종료: kill $BACKEND_PID $FRONTEND_PID"
echo "  또는: ./stop.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# PID 저장 (stop.sh에서 사용)
echo "$BACKEND_PID $FRONTEND_PID" > .server_pids

# 대기 (Ctrl+C로 종료)
wait
