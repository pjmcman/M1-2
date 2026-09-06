# Firebase Project

홍성군 숙박업 분석을 위한 관리자용 웹앱 프로젝트입니다. 기존 온기로 Vercel 웹앱에는 관리자 대시보드 링크를 연결하고, 데이터·AI 백엔드는 Render에서 운영합니다.

## 최종 배포 현황

- GitHub 백엔드: [pjmcman/M1-2](https://github.com/pjmcman/M1-2)
- GitHub 프론트: [pjmcman/B2-3](https://github.com/pjmcman/B2-3)
- Render API: [https://m1-2-egj5.onrender.com](https://m1-2-egj5.onrender.com)
- Swagger: [https://m1-2-egj5.onrender.com/docs](https://m1-2-egj5.onrender.com/docs)
- Health check: [https://m1-2-egj5.onrender.com/health](https://m1-2-egj5.onrender.com/health)
- 기존 온기로 웹앱: [https://b2-3-psi.vercel.app](https://b2-3-psi.vercel.app)
- 백엔드 최종 수정 커밋: `1363370`
- Vercel 관리자 링크 커밋: `ed026e6`

Render 서비스와 Swagger는 배포되어 있으며, `FIREBASE_CREDENTIALS_JSON` 또는 `FIREBASE_SERVICE_ACCOUNT_JSON` 환경변수로 Firebase 서비스 계정을 연결합니다.

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

미션 API:

- `POST /api/data`, `GET /api/data`, `PUT /api/data/{id}`, `DELETE /api/data/{id}`
- `GET /api/data/summary`
- `POST /api/chat`
- `POST /api/conversations`, `GET /api/conversations`, `GET /api/conversations/{id}`, `DELETE /api/conversations/{id}`

## Render 배포

Render에서 이 저장소를 선택하면 `render.yaml`을 기준으로 백엔드가 배포됩니다.

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- 필수 환경변수: `FIREBASE_CREDENTIALS_JSON` 또는 `FIREBASE_SERVICE_ACCOUNT_JSON`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ALLOWED_ORIGINS`

서비스 계정 JSON과 API 키는 GitHub에 올리지 않고 Render 환경변수에 직접 입력합니다.

## 미션 및 보너스 현황

- 완료: FastAPI, Firebase, 480개 시계열 데이터, CRUD, 요약 API, 대화 저장/불러오기, AI 채팅, Swagger, Render 배포, Vercel 관리자 링크
- 보류: OpenAI 키 교체 및 비용 확인, 기존 Vercel AI 상담과 Render API의 세부 통합
- 보너스 기반: Function Calling 도구 스키마, 통계 API 확장 구조
- 추가 보너스: 그래프, CSV/JSON 내보내기, 다크 모드는 후속 작업
