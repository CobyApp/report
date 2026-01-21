# 폰트 설치 가이드

이 프로젝트는 일본어, 한국어, 영어 텍스트를 지원하기 위해 여러 폰트를 사용합니다.

## 필요한 폰트

### 일본어 폰트 (우선순위 순)

1. **MS Gothic (MS ゴシック)** - 일본 관공서 문서 표준 폰트
   - 가장 일반적으로 사용되는 일본어 폰트
   - Windows에 기본 설치되어 있음
   - 파일명: `msgothic.ttc` 또는 `msgothic.ttf`

2. **MS Mincho (MS 明朝)** - 공식 문서용
   - 공식 문서에 자주 사용되는 세리프 폰트
   - Windows에 기본 설치되어 있음
   - 파일명: `msmincho.ttc` 또는 `msmincho.ttf`

3. **Noto Sans JP** - 오픈소스 대안
   - Google의 오픈소스 폰트
   - 이미 프로젝트에 포함되어 있음 (`backend/fonts/NotoSansJP-VF.ttf`)

### 한국어 폰트 (우선순위 순)

1. **Malgun Gothic (맑은 고딕)**
   - Windows 기본 폰트
   - 한국 문서에서 가장 일반적으로 사용
   - 파일명: `malgun.ttf` 또는 `malgun.ttc`

2. **Nanum Gothic (나눔고딕)**
   - 공공기관에서 자주 사용
   - 오픈소스 폰트
   - 파일명: `NanumGothic.ttf`

3. **Noto Sans KR** - 오픈소스 대안
   - Google의 오픈소스 폰트
   - 이미 프로젝트에 포함되어 있음 (`backend/fonts/NotoSansKR-VF.ttf`)

### 영어 폰트

- **Times-Roman** - PyMuPDF 기본 폰트 (설치 불필요)
- **Helvetica** - PyMuPDF 기본 폰트 (설치 불필요)
- **Arial** - PyMuPDF 기본 폰트 (설치 불필요)
- **Courier** - PyMuPDF 기본 폰트 (설치 불필요)

## 폰트 다운로드 링크

### MS Gothic (MS ゴシック) - 일본어

**Windows에서 복사 (권장):**
- 위치: `C:\Windows\Fonts\msgothic.ttc`
- 파일을 `backend/fonts/msgothic.ttc`로 복사

**직접 다운로드 (대안):**
- MS Gothic은 Microsoft의 라이선스 제한으로 공식 다운로드가 제한적입니다
- **Windows PC가 있는 경우**: 위 경로에서 파일 복사
- **Mac/Linux 사용자**: 아래 오픈소스 대안 사용 권장

**오픈소스 대안 (Mac/Linux 권장):**
- **Noto Sans JP** (이미 프로젝트에 포함): `backend/fonts/NotoSansJP-VF.ttf`
  - 다운로드: https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwdth%2Cwght%5D.ttf
- **Source Han Code JP**: https://github.com/adobe-fonts/source-han-code-jp/releases
- **Google Fonts**: https://fonts.google.com/noto/specimen/Noto+Sans+JP

### MS Mincho (MS 明朝) - 일본어

**Windows에서 복사 (권장):**
- 위치: `C:\Windows\Fonts\msmincho.ttc`
- 파일을 `backend/fonts/msmincho.ttc`로 복사

**직접 다운로드 (대안):**
- MS Mincho는 Microsoft의 라이선스 제한으로 공식 다운로드가 제한적입니다
- **Windows PC가 있는 경우**: 위 경로에서 파일 복사
- **Mac/Linux 사용자**: 아래 오픈소스 대안 사용 권장

**오픈소스 대안 (Mac/Linux 권장):**
- **Noto Serif JP**: https://fonts.google.com/noto/specimen/Noto+Serif+JP
  - 다운로드: https://github.com/google/fonts/raw/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf
- **Source Han Serif**: https://github.com/adobe-fonts/source-han-serif/releases
- **Google Fonts**: https://fonts.google.com/noto/specimen/Noto+Serif+JP

### Malgun Gothic (맑은 고딕) - 한국어

**Windows에서 복사 (권장):**
- 위치: `C:\Windows\Fonts\malgun.ttf`
- 파일을 `backend/fonts/malgun.ttf`로 복사

**직접 다운로드 (대안):**
- Malgun Gothic은 Microsoft의 라이선스 제한으로 공식 다운로드가 제한적입니다
- **Windows PC가 있는 경우**: 위 경로에서 파일 복사
- **Mac/Linux 사용자**: 아래 오픈소스 대안 사용 권장

**오픈소스 대안 (Mac/Linux 권장):**
- **Nanum Gothic** (권장): 아래 Nanum Gothic 섹션 참고
- **Noto Sans KR** (이미 프로젝트에 포함): `backend/fonts/NotoSansKR-VF.ttf`

### Nanum Gothic (나눔고딕) - 한국어

**직접 다운로드 (권장):**
- **네이버 나눔고딕 공식 사이트**: https://hangeul.naver.com/2017/nanum
  1. 위 링크 접속
  2. "나눔고딕" 클릭
  3. ZIP 파일 다운로드
  4. 압축 해제 후 `NanumGothic.ttf` 파일을 `backend/fonts/` 디렉토리에 복사

**대안 다운로드:**
- **GitHub Releases**: https://github.com/naver/nanumfont/releases
  - 최신 릴리즈에서 ZIP 파일 다운로드
  - 압축 해제 후 `NanumGothic.ttf` 파일 복사

**설치 후 파일명**: `NanumGothic.ttf` 또는 `NanumGothic-Regular.ttf`

**참고**: 자동 다운로드가 실패하는 경우, 위 링크에서 수동으로 다운로드하거나 Noto Sans KR을 사용할 수 있습니다 (이미 설치됨).

### Noto Sans JP - 일본어 (오픈소스)

**직접 다운로드:**
- **Google Fonts**: https://fonts.google.com/noto/specimen/Noto+Sans+JP
  - 직접 다운로드: https://fonts.google.com/download?family=Noto%20Sans%20JP
- **GitHub**: https://github.com/google/fonts/tree/main/ofl/notosansjp
  - Variable Font: https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwdth%2Cwght%5D.ttf
- **이미 프로젝트에 포함**: `backend/fonts/NotoSansJP-VF.ttf`

### Noto Sans KR - 한국어 (오픈소스)

**직접 다운로드:**
- **Google Fonts**: https://fonts.google.com/noto/specimen/Noto+Sans+KR
  - 직접 다운로드: https://fonts.google.com/download?family=Noto%20Sans%20KR
- **GitHub**: https://github.com/google/fonts/tree/main/ofl/notosanskr
  - Variable Font: https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwdth%2Cwght%5D.ttf
- **이미 프로젝트에 포함**: `backend/fonts/NotoSansKR-VF.ttf`

## 빠른 설치 가이드 (Mac/Linux)

### 방법 1: 자동 설치 스크립트 실행

```bash
# 프로젝트 루트에서
./install-fonts.sh
```

**참고**: Nanum Gothic 자동 다운로드가 실패할 수 있습니다. 이 경우 아래 수동 설치 방법을 사용하세요.

### 방법 2: 수동 설치 (Nanum Gothic)

**Nanum Gothic 수동 다운로드:**

1. **네이버 나눔고딕 사이트 접속**
   - https://hangeul.naver.com/2017/nanum

2. **다운로드**
   - "나눔고딕" 클릭
   - ZIP 파일 다운로드

3. **설치**
   ```bash
   # 다운로드한 ZIP 파일 압축 해제
   unzip nanum-gothic.zip
   
   # NanumGothic.ttf 파일을 backend/fonts/ 디렉토리로 복사
   cp NanumGothic*.ttf backend/fonts/NanumGothic.ttf
   ```

**또는 Noto Sans KR 사용 (이미 설치됨):**
- Noto Sans KR이 이미 설치되어 있어 한국어 텍스트는 자동으로 작동합니다
- Nanum Gothic이 없어도 문제없이 사용 가능합니다

### 방법 2: MS 폰트 사용 (Windows에서 복사)

Windows PC가 있는 경우:
1. `C:\Windows\Fonts\msgothic.ttc` → `backend/fonts/msgothic.ttc`로 복사
2. `C:\Windows\Fonts\msmincho.ttc` → `backend/fonts/msmincho.ttc`로 복사
3. `C:\Windows\Fonts\malgun.ttf` → `backend/fonts/malgun.ttf`로 복사

## 설치 방법

### 자동 설치 스크립트 (권장)

프로젝트 루트에서 다음 스크립트를 실행하세요:

```bash
#!/bin/bash
# install-fonts.sh

cd backend/fonts

echo "Downloading Nanum Gothic..."
curl -L -o NanumGothic.ttf "https://cdn.jsdelivr.net/gh/naver/nanumfont@master/packages/nanumgothic/dist/NanumGothic-Regular.ttf"

echo "Downloading Noto Sans JP (if not exists)..."
if [ ! -f "NotoSansJP-VF.ttf" ]; then
    curl -L -o NotoSansJP-VF.ttf "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwdth%2Cwght%5D.ttf"
fi

echo "Downloading Noto Sans KR (if not exists)..."
if [ ! -f "NotoSansKR-VF.ttf" ]; then
    curl -L -o NotoSansKR-VF.ttf "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwdth%2Cwght%5D.ttf"
fi

echo "Font installation complete!"
ls -lh
```

**실행 방법:**
```bash
chmod +x install-fonts.sh
./install-fonts.sh
```

### 수동 설치

1. **폰트 파일 다운로드**
   - 위 링크에서 필요한 폰트 파일을 다운로드
   - 또는 Windows PC에서 `C:\Windows\Fonts\` 폴더의 파일 복사

2. **폰트 파일 복사**
   ```bash
   # 프로젝트 루트에서
   cp /path/to/downloaded/font.ttf backend/fonts/
   # 또는
   cp /path/to/downloaded/font.ttc backend/fonts/
   ```

3. **파일명 확인**
   - 다음 파일명 중 하나로 저장되어야 합니다:
     - 일본어: `msgothic.ttc`, `msgothic.ttf`, `msmincho.ttc`, `msmincho.ttf`
     - 한국어: `malgun.ttf`, `malgun.ttc`, `NanumGothic.ttf`, `NanumGothic-Regular.ttf`

4. **Docker 재빌드** (Docker 사용 시)
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

## 폰트 우선순위

시스템은 텍스트 내용을 분석하여 언어를 자동 감지하고, 다음 우선순위로 폰트를 선택합니다:

### 일본어
1. MS Gothic (관공서 표준)
2. MS Mincho (공식 문서용)
3. Noto Sans JP (오픈소스)

### 한국어
1. Malgun Gothic (일반 문서)
2. Nanum Gothic (공공기관)
3. Noto Sans KR (오픈소스)

### 영어
- Times-Roman (공식 문서 스타일)

## 수동 폰트 선택

템플릿 에디터에서 텍스트 요소를 선택하면, 폰트를 "Auto" 또는 특정 폰트로 수동 선택할 수 있습니다.

- **Auto**: 텍스트 내용에 따라 자동으로 적절한 폰트 선택
- **특정 폰트**: 원하는 폰트를 직접 선택

## 문제 해결

### 폰트가 표시되지 않는 경우

1. **폰트 파일 확인**
   ```bash
   ls -la backend/fonts/
   ```

2. **파일명 확인**
   - 파일명이 정확한지 확인 (대소문자 구분)

3. **로그 확인**
   - 백엔드 로그에서 폰트 등록 메시지 확인:
     ```
     ✓ Font registered on page 1: MSGothic (...)
     ```

4. **폴백 폰트 사용**
   - MS Gothic/Mincho가 없으면 Noto Sans JP가 자동으로 사용됩니다
   - Malgun Gothic이 없으면 Nanum Gothic 또는 Noto Sans KR이 사용됩니다

## 라이선스

- **MS Gothic / MS Mincho**: Microsoft 소유, 상업적 사용 시 라이선스 확인 필요
- **Malgun Gothic**: Microsoft 소유, Windows 사용자에게는 무료
- **Nanum Gothic**: SIL Open Font License 1.1 (자유 사용 가능)
- **Noto Sans JP/KR**: SIL Open Font License 1.1 (자유 사용 가능)

## 참고

- 프로덕션 환경에서는 라이선스를 확인하고 적절한 폰트를 사용하세요
- 오픈소스 폰트(Noto Sans, Nanum Gothic)는 상업적 사용이 자유롭습니다
