# 폰트 설치 가이드 (Mac)

Mac에서 개발 중인 경우, 다음 폰트들을 설치해야 합니다.

## 필수 폰트 (이미 설치됨)

- ✅ **Noto Sans JP** - 일본어 (9.1M)
- ✅ **Noto Sans KR** - 한국어 (9.9M)

이 두 폰트만으로도 일본어, 한국어, 영어 텍스트가 정상 작동합니다.

## 추가 폰트 설치 (선택사항)

### 1. Nanum Gothic (나눔고딕) - 한국어

**설치 방법:**

1. **네이버 나눔고딕 사이트 접속**
   - https://hangeul.naver.com/2017/nanum

2. **다운로드**
   - "나눔고딕" 클릭
   - ZIP 파일 다운로드

3. **설치**
   ```bash
   # 다운로드한 ZIP 파일 압축 해제
   unzip nanum-gothic.zip
   
   # NanumGothic.ttf 파일 찾기
   find . -name "NanumGothic*.ttf" -type f
   
   # backend/fonts/ 디렉토리로 복사
   cp NanumGothic*.ttf backend/fonts/NanumGothic.ttf
   ```

### 2. MS Gothic / MS Mincho - 일본어 (Windows에서 복사 필요)

**Windows PC가 있는 경우:**

1. Windows PC에서 다음 파일 복사:
   - `C:\Windows\Fonts\msgothic.ttc` → `backend/fonts/msgothic.ttc`
   - `C:\Windows\Fonts\msmincho.ttc` → `backend/fonts/msmincho.ttc`

2. Mac으로 전송:
   - USB 드라이브, 클라우드 스토리지, 또는 네트워크 공유 사용

### 3. Malgun Gothic - 한국어 (Windows에서 복사 필요)

**Windows PC가 있는 경우:**

1. Windows PC에서 다음 파일 복사:
   - `C:\Windows\Fonts\malgun.ttf` → `backend/fonts/malgun.ttf`

2. Mac으로 전송

## 설치 확인

```bash
# 폰트 디렉토리 확인
ls -lh backend/fonts/

# 예상 출력:
# NotoSansJP-VF.ttf (9.1M)
# NotoSansKR-VF.ttf (9.9M)
# NanumGothic.ttf (선택사항)
# msgothic.ttc (선택사항)
# msmincho.ttc (선택사항)
# malgun.ttf (선택사항)
```

## Docker 재빌드 (필요 시)

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## 참고

- **Noto Sans JP/KR만으로도 충분합니다**: 이미 설치되어 있어 일본어, 한국어, 영어 텍스트가 모두 정상 작동합니다.
- **Nanum Gothic**: 한국 공공기관 문서 스타일이 필요한 경우에만 설치
- **MS Gothic/Mincho**: 일본 관공서 문서 스타일이 필요한 경우에만 설치 (Windows PC 필요)
