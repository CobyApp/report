#!/bin/bash
cd "$(dirname "$0")"

echo "🔄 서버 재시작 중..."
echo ""

# 기존 서버 종료
if [ -f stop.sh ]; then
    ./stop.sh
else
    echo "기존 프로세스 정리 중..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
fi

sleep 2

# 서버 시작
if [ -f start.sh ]; then
    ./start.sh
else
    echo "❌ start.sh 파일을 찾을 수 없습니다."
    exit 1
fi
