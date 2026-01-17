#!/bin/bash
cd "$(dirname "$0")"

echo "🛑 서버 종료 중..."

# PID 파일에서 읽기
if [ -f .server_pids ]; then
    PIDS=$(cat .server_pids)
    kill $PIDS 2>/dev/null
    rm .server_pids
fi

# 포트로도 확인하여 종료
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "✅ 서버 종료 완료"
