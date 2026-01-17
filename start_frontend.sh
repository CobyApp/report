#!/bin/bash
cd "$(dirname "$0")/frontend"

echo "프론트엔드 서버 시작 중..."

# node_modules 확인 및 설치
if [ ! -d "node_modules" ]; then
    echo "npm 패키지 설치 중..."
    npm install
fi

# 개발 서버 실행
echo "프론트엔드 서버 실행: http://localhost:3000"
npm run dev
