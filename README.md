# PDF 템플릿 자동화 엔진

PDF 템플릿에 데이터를 자동으로 매핑하여 완성된 PDF를 생성하는 웹 애플리케이션입니다.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.9+-green)
![React](https://img.shields.io/badge/react-18.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📋 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [빠른 시작](#빠른-시작)
- [사용 방법](#사용-방법)
- [API 문서](#api-문서)
- [프로젝트 구조](#프로젝트-구조)

## ✨ 주요 기능

### 🎯 핵심 기능

- **📄 PDF 템플릿 업로드**: A4 PDF 템플릿을 업로드하고 관리
- **🎨 시각적 필드 매핑**: 드래그 앤 드롭으로 템플릿 필드에 데이터 경로 지정
- **⚡ 실시간 미리보기**: 필드 배치를 즉시 확인
- **💾 실시간 테스트**: 저장 전에도 테스트 렌더링 가능
- **🔄 자동 PDF 생성**: JSON 데이터로 완성된 PDF 자동 생성
- **🔌 REST API**: HTTP API로 프로그램에서 사용 가능

### 🛠️ 편집 기능

- **속성 편집**: 위치(X, Y), 크기(너비, 높이), 폰트, 정렬 실시간 조정
- **필드 관리**: 필드 추가, 삭제, 선택
- **템플릿 관리**: 개별/전체 삭제 지원

## 🏗️ 기술 스택

### Backend

- **FastAPI** (0.104.1) - 고성능 Python 웹 프레임워크
- **PyMuPDF (fitz)** (1.23.8) - PDF 정보 추출 및 이미지 렌더링
- **ReportLab** (4.0.7) - 오버레이 PDF 생성
- **pypdf** (3.17.1) - PDF 병합
- **Uvicorn** - ASGI 서버

### Frontend

- **React** (18.2.0) - UI 프레임워크
- **Vite** (5.0.8) - 빠른 빌드 도구
- **Axios** (1.6.2) - HTTP 클라이언트

## 🚀 빠른 시작

### 사전 요구사항

- Python 3.9 이상
- Node.js 16 이상
- npm 또는 yarn

### 1. 저장소 클론

```bash
git clone https://github.com/CobyApp/report.git
cd report
```

### 2. 한 번에 실행 (권장)

```bash
# 백엔드 + 프론트엔드 동시 실행
./start.sh

# 종료
./stop.sh

# 재시작
./restart.sh
```

### 3. 개별 실행

**터미널 1 - 백엔드:**

```bash
cd backend

# 가상환경 생성 (최초 1회)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 패키지 설치 (최초 1회)
pip install -r requirements.txt

# 서버 실행
python -m app.main
```

**터미널 2 - 프론트엔드:**

```bash
cd frontend

# 패키지 설치 (최초 1회)
npm install

# 개발 서버 실행
npm run dev
```

### 4. 접속

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs (Swagger UI)

## 📖 사용 방법

### 1. 템플릿 업로드

1. 웹 브라우저에서 `http://localhost:3000` 접속
2. "PDF 템플릿 업로드" 버튼 클릭
3. A4 PDF 템플릿 파일 선택

### 2. 필드 매핑

1. 업로드된 템플릿 카드를 클릭하여 편집 모드 진입
2. PDF 미리보기에서 **드래그**하여 필드 영역 선택
3. 데이터 경로 입력 팝업에서 경로 입력 (예: `customer.name`, `items[0].price`)
4. 필요한 만큼 필드 추가

### 3. 속성 편집

1. 필드를 클릭하여 선택
2. 오른쪽 속성 패널에서 수정:
   - **데이터 경로**: 필드에 매핑할 JSON 경로
   - **X, Y**: 필드 위치 (PDF 좌표)
   - **너비, 높이**: 필드 크기
   - **폰트 크기**: 텍스트 크기
   - **정렬**: 왼쪽/중앙/오른쪽

### 4. 테스트 렌더링

1. "🧪 테스트 렌더링" 버튼 클릭
2. 각 필드에 넣을 값 입력 (프롬프트)
3. 완성된 PDF 자동 다운로드
4. **저장 전에도 변경사항이 반영됩니다**

### 5. 저장

1. "💾 저장" 버튼 클릭
2. 템플릿 매핑 정보가 서버에 저장됨

## 📡 API 문서

### 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/templates` | PDF 템플릿 업로드 |
| `GET` | `/api/templates` | 템플릿 목록 조회 |
| `GET` | `/api/templates/{id}` | 템플릿 상세 조회 |
| `PUT` | `/api/templates/{id}/mapping` | 템플릿 매핑 저장 |
| `POST` | `/api/render/{id}` | PDF 생성 (데이터 필요) |
| `GET` | `/api/templates/{id}/preview` | 페이지 미리보기 이미지 |
| `DELETE` | `/api/templates/{id}` | 템플릿 삭제 |
| `DELETE` | `/api/templates` | 전체 템플릿 삭제 |

### 사용 예시

#### 템플릿 업로드

```bash
curl -X POST http://localhost:8000/api/templates \
  -F "file=@template.pdf"
```

**응답:**
```json
{
  "template_id": "uuid-here",
  "filename": "template.pdf",
  "page_count": 1,
  "page_size": {"w_pt": 595.28, "h_pt": 841.89}
}
```

#### 템플릿 매핑 저장

```bash
curl -X PUT http://localhost:8000/api/templates/{template_id}/mapping \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {
        "id": "elem1",
        "type": "text",
        "page": 1,
        "bbox": {"x": 100, "y": 100, "w": 200, "h": 20},
        "data_path": "customer.name",
        "style": {"font": "Helvetica", "size": 10, "align": "left"}
      }
    ]
  }'
```

#### PDF 생성

```bash
curl -X POST http://localhost:8000/api/render/{template_id} \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"name": "홍길동"},
    "items": [{"name": "상품1", "price": 10000}]
  }' \
  --output result.pdf
```

**실시간 elements 전송 (테스트 렌더링):**

```bash
curl -X POST http://localhost:8000/api/render/{template_id} \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"name": "홍길동"},
    "_elements": [
      {
        "id": "elem1",
        "type": "text",
        "page": 1,
        "bbox": {"x": 100, "y": 100, "w": 200, "h": 20},
        "data_path": "customer.name"
      }
    ]
  }' \
  --output result.pdf
```

## 📁 프로젝트 구조

```
report/
├── backend/                 # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py         # FastAPI 앱 및 API 엔드포인트
│   │   └── services/
│   │       ├── pdf_service.py      # PDF 처리 (업로드, 미리보기)
│   │       ├── template_service.py # 템플릿 저장/로드
│   │       └── render_service.py   # PDF 렌더링 엔진
│   ├── templates/          # 템플릿 JSON 저장 (자동 생성)
│   ├── uploads/            # 업로드된 PDF 및 생성된 PDF (자동 생성)
│   └── requirements.txt    # Python 패키지 의존성
│
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── App.jsx         # 메인 앱 컴포넌트
│   │   └── components/
│   │       ├── TemplateList.jsx    # 템플릿 목록
│   │       └── TemplateEditor.jsx  # 템플릿 편집기
│   ├── package.json        # Node.js 패키지 의존성
│   └── vite.config.js      # Vite 설정
│
├── start.sh               # 백엔드 + 프론트엔드 동시 실행
├── stop.sh                # 서버 종료
├── restart.sh             # 서버 재시작
└── README.md              # 이 파일
```

## 📐 템플릿 JSON 구조

템플릿은 JSON 형식으로 저장됩니다:

```json
{
  "template_id": "uuid",
  "filename": "template.pdf",
  "page_size": {
    "w_pt": 595.28,
    "h_pt": 841.89
  },
  "pages": [
    {
      "page": 1,
      "width": 595.28,
      "height": 841.89,
      "width_pt": 595.28,
      "height_pt": 841.89
    }
  ],
  "elements": [
    {
      "id": "elem_1234567890",
      "type": "text",
      "page": 1,
      "bbox": {
        "x": 100,
        "y": 200,
        "w": 200,
        "h": 20
      },
      "data_path": "customer.name",
      "style": {
        "font": "Helvetica",
        "size": 10,
        "align": "left"
      },
      "overflow": {
        "mode": "shrink_to_fit",
        "min_size": 7
      }
    }
  ],
  "created_at": "2026-01-17T..."
}
```

### 필드 설명

- `bbox`: 필드 위치 및 크기 (PDF 좌표계, 포인트 단위)
  - `x`, `y`: 왼쪽 위 모서리 좌표 (화면 좌표계로 저장, 렌더링 시 변환)
  - `w`, `h`: 너비, 높이
- `data_path`: JSON 데이터 경로 (예: `customer.name`, `items[0].price`)
- `style`: 텍스트 스타일 설정
- `overflow`: 텍스트 넘침 처리 (현재 `shrink_to_fit` 지원)

## ✅ 지원 기능

- ✅ **텍스트 필드**: 데이터 경로 매핑, 정렬, 자동 축소
- ✅ **체크박스**: Boolean 값 표시
- ✅ **반복 테이블**: 리스트 데이터 반복 렌더링
- ✅ **다중 페이지**: 여러 페이지 지원
- ✅ **실시간 편집**: 저장 전에도 테스트 가능
- ✅ **속성 편집**: 위치, 크기, 스타일 실시간 조정

## 🔮 향후 개선 사항

- [ ] 이미지 필드 (서명, 도장, QR 코드)
- [ ] 조건부 표시 (if 문)
- [ ] 페이지 넘침 자동 처리
- [ ] 한글 폰트 지원 개선
- [ ] 리치텍스트 (부분 bold, 색상 등)
- [ ] 데이터 스키마 검증 UI
- [ ] 템플릿 버전 관리
- [ ] 사용자 인증 및 권한 관리

## 🐛 문제 해결

### 포트가 이미 사용 중

```bash
# 포트 확인
lsof -ti:8000  # 백엔드
lsof -ti:3000  # 프론트엔드

# 프로세스 종료
kill -9 $(lsof -ti:8000)
kill -9 $(lsof -ti:3000)
```

### 패키지 설치 오류

**백엔드:**
```bash
# 가상환경 확인
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**프론트엔드:**
```bash
# 캐시 정리 후 재설치
rm -rf node_modules package-lock.json
npm install
```

## 🤝 기여

이슈와 풀 리퀘스트를 환영합니다!

## 📄 라이선스

MIT License

---

**프로젝트 링크**: [https://github.com/CobyApp/report](https://github.com/CobyApp/report)
