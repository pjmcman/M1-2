# Firebase Project

홍성군 숙박업 분석을 위한 관리자용 웹앱 프로젝트입니다. 현재는 Firebase Admin SDK와 관리자 데이터 관리에만 집중하며, 기존 Vercel 공개 웹앱과의 연동은 마지막 단계에서 진행합니다.

## 설치

```powershell
npm install
Copy-Item .env.example .env
```

`.env`의 `GOOGLE_APPLICATION_CREDENTIALS`를 Firebase 서비스 계정 JSON 파일의 실제 경로로 수정합니다. 서비스 계정 JSON은 이 프로젝트 폴더에 복사하지 않습니다.

## 실행

연결 상태 확인:

```powershell
npm start
```

120일 객실 데이터 생성:

```powershell
npm run rooms:generate
```

Firestore에 객실 데이터 입력:

```powershell
npm run rooms:seed
```

객실 분석 레포트 생성:

```powershell
npm run rooms:report
```

## Firestore 구조

- `room_daily/{date}-room-{number}`: 날짜별 객실 예약 상태
- 객실 수: 4개
- 기간: 120일
- 1박 요금: 220,000원
- 목표 예약률: 70%
- 가상 데이터: `data/hongseong-room-120-days.json`

레포트: `reports/hongseong-room-report.md`

## FastAPI 로컬 실행

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

- 관리자 화면: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- 상태 확인: `http://127.0.0.1:8000/health`

## Render 배포

Render에서 이 저장소를 선택하면 `render.yaml`을 기준으로 백엔드가 배포됩니다.

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- 필수 환경변수: `FIREBASE_SERVICE_ACCOUNT_JSON`, `OPENAI_API_KEY`, `ALLOWED_ORIGINS`

서비스 계정 JSON과 API 키는 GitHub에 올리지 않고 Render 환경변수에 직접 입력합니다.

## 작업 범위

- 현재 단계: 관리자용 데이터 생성, 조회, 분석
- 인증 및 권한: 관리자 기능 기준으로 구성
- 나중 단계: 기존 Vercel 웹앱과 API 또는 Firebase 데이터 연동
