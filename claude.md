# 🔄 반복 일정 기능 구현 작업 로그

**날짜**: 2026년 2월 1일  
**목표**: 업무일정 관리 시스템에 반복 일정 기능 추가

---

## 📋 작업 개요

기존 DB에 이미 반복 일정 구조(`event_series`, `event_exceptions`)가 존재하는 것을 확인하고, 이에 맞춰 백엔드 API를 구현.

---

## ✅ 완료된 작업

### 1. DB 구조 확인 (2026-02-01 09:00)

**확인 사항:**
```sql
-- 기존 테이블 확인
\dt

-- 결과:
- event_series (반복 일정 마스터)
- event_exceptions (제외 날짜)
- events (개별 일정 + occurrence)

-- recurrence_type enum 확인
\dT+ recurrence_type

-- 결과: day, week, month, year
```

**DB 스키마:**
- `event_series`: 반복 일정 정의
  - `recurrence_type`: day, week, month, year
  - `recurrence_interval`: 반복 간격
  - `recurrence_end_date`: 종료일
  - `start_time`, `end_time`: 시간
  - `first_occurrence_date`: 첫 발생일
  
- `event_exceptions`: 제외 날짜
  - `series_id`: event_series FK
  - `exception_date`: 제외할 날짜
  
- `events`: 일반 일정 + 예외 일정
  - `series_id`: 반복 일정 참조 (nullable)
  - `is_exception`: 예외 일정 여부
  - `original_series_id`: 원본 시리즈 참조

---

### 2. 백엔드 파일 작성 (2026-02-01 09:30)

#### 📁 `backend/src/utils/recurringEvents.js`

**핵심 함수:**
```javascript
generateOccurrencesFromSeries(series, startDate, endDate, exceptions)
```

**역할:**
- `event_series` 데이터로부터 개별 occurrence 생성
- 예외 날짜 필터링
- 반복 패턴에 따라 날짜 계산

**파일 위치:**
```
/var/www/schedule-app/backend/src/utils/recurringEvents.js
```

---

#### 📁 `backend/src/controllers/eventController.js`

**구현된 API:**

1. **`getEvents()`** - 일정 목록 조회
   - 일반 일정 (series_id = null)
   - 예외 일정 (is_exception = true)
   - 반복 일정 자동 확장

2. **`createEvent()`** - 일정 생성
   - 일반 일정 → `events` 테이블
   - 반복 일정 → `event_series` 테이블

3. **`updateEvent()`** - 일정 수정
   - 이 날짜만 → 예외 이벤트 생성 + `event_exceptions` 추가
   - 전체 → `event_series` 업데이트

4. **`deleteEvent()`** - 일정 삭제
   - 이 날짜만 → `event_exceptions` 추가
   - 전체 → `event_series` 삭제

5. **`getEventById()`** - 일정 상세 조회

**파일 위치:**
```
/var/www/schedule-app/backend/src/controllers/eventController.js
```

---

#### 📁 `backend/routes/events.js`

**변경 사항:**
- 기존: 라우터에서 직접 DB 쿼리 처리
- 수정: 컨트롤러 함수 사용

```javascript
const eventController = require('../src/controllers/eventController');

router.get('/', eventController.getEvents);
router.post('/', eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);
router.get('/:id', eventController.getEventById);
```

**파일 위치:**
```
/var/www/schedule-app/backend/routes/events.js
```

---

### 3. 문제 해결 과정

#### ❌ 문제 1: 모듈 경로 오류
```
Error: Cannot find module '../config/database'
```

**원인:**  
`src/controllers/` 폴더 구조 때문에 상대 경로가 틀림

**해결:**
```javascript
// 변경 전
const pool = require('../config/database');

// 변경 후
const { query, transaction } = require('../../config/database');
```

---

#### ❌ 문제 2: recurringEvents 모듈 없음
```
Error: Cannot find module '../utils/recurringEvents'
```

**원인:**  
파일명이 `recurringEvents-updated.js`로 저장됨

**해결:**
```bash
mv recurringEvents-updated.js recurringEvents.js
```

---

#### ❌ 문제 3: pool.connect is not a function
```
TypeError: pool.connect is not a function
```

**원인:**  
기존 프로젝트는 `transaction` 헬퍼 함수 사용

**해결:**
```javascript
// 변경 전
const client = await pool.connect();
await client.query('BEGIN');
// ...
await client.query('COMMIT');

// 변경 후
await transaction(async (client) => {
  // ...
});
```

---

#### ❌ 문제 4: Docker 컨테이너 파일 업데이트 안됨

**원인:**  
볼륨 마운트 없이 이미지 빌드 방식 사용

**해결:**
```bash
# 호스트 파일 수정 후 재빌드
docker-compose build --no-cache backend
docker-compose up -d
```

---

### 4. 적용된 파일 목록

#### 백엔드 파일:
1. `/var/www/schedule-app/backend/src/utils/recurringEvents.js` ✅
2. `/var/www/schedule-app/backend/src/controllers/eventController.js` ✅
3. `/var/www/schedule-app/backend/routes/events.js` ✅

#### 백업 파일:
1. `/var/www/schedule-app/backend/routes/events.js.backup.*` (기존 라우터)

---

## 🔄 현재 상태

### ✅ 완료:
- DB 구조 확인
- 헬퍼 함수 작성
- 컨트롤러 작성 (transaction 헬퍼 사용)
- 라우터 수정
- 경로 오류 해결
- 파일명 수정
- Docker 빌드 완료

### 🚧 진행 중:
- **반복 일정 생성 API 테스트**
  - 상태: 서버 크래시 → transaction 헬퍼로 수정 → 재테스트 필요

---

## 📝 다음 단계

### 1. 백엔드 테스트 (최우선)

```bash
# 1. 수정된 파일 적용
cp eventController-fixed.js /var/www/schedule-app/backend/src/controllers/eventController.js

# 2. Docker 재빌드
docker-compose build backend
docker-compose up -d

# 3. 반복 일정 생성 테스트
curl -X POST http://localhost:3001/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "주간 스탠드업",
    "content": "매주 월요일 회의",
    "start_at": "2026-02-03T10:00:00",
    "end_at": "2026-02-03T11:00:00",
    "is_recurring": true,
    "recurrence_type": "week",
    "recurrence_interval": 1,
    "recurrence_end_date": "2026-03-31"
  }'

# 4. DB 확인
docker-compose exec database psql -U scheduleuser -d schedule_management
SELECT * FROM event_series;

# 5. 일정 조회 테스트
curl -X GET "http://localhost:3001/api/v1/events?startDate=2026-02-01&endDate=2026-03-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 2. 프론트엔드 적용

#### 📁 필요한 파일:
1. `frontend-EventModal.jsx` - 반복 일정 생성 UI
2. `frontend-EventDetailModal.jsx` - 수정/삭제 모달
3. `frontend-Calendar-recurring-icon.jsx` - 반복 아이콘 표시

#### 적용 위치:
```
/var/www/schedule-app/schedule-frontend/src/components/events/EventModal.jsx
/var/www/schedule-app/schedule-frontend/src/components/events/EventDetailModal.jsx
/var/www/schedule-app/schedule-frontend/src/components/calendar/Calendar.jsx
```

---

### 3. v4 디자인 적용

사용자가 업로드한 이미지 기반:
- 새 일정 모달 스타일
- 메인 캘린더 레이아웃
- 탭 필터
- + 버튼 디자인

---

### 4. 알림 기능 추가 🔔

#### DB 스키마:
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50),
  title VARCHAR(255),
  content TEXT,
  event_id INTEGER REFERENCES events(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### API:
- GET `/api/v1/notifications` - 알림 목록
- PUT `/api/v1/notifications/:id/read` - 읽음 처리
- DELETE `/api/v1/notifications/:id` - 삭제

#### 프론트엔드:
- 헤더 알림 아이콘
- 알림 드롭다운
- 실시간 알림 (WebSocket/SSE)

---

## 🗂️ 파일 위치 정리

### 백엔드:
```
backend/
├── src/
│   ├── controllers/
│   │   └── eventController.js          [수정됨]
│   └── utils/
│       └── recurringEvents.js           [신규]
├── routes/
│   └── events.js                        [수정됨]
└── config/
    └── database.js                      [기존]
```

### 프론트엔드 (예정):
```
schedule-frontend/
└── src/
    ├── components/
    │   ├── events/
    │   │   ├── EventModal.jsx           [수정 예정]
    │   │   └── EventDetailModal.jsx     [수정 예정]
    │   └── calendar/
    │       └── Calendar.jsx              [수정 예정]
    └── utils/
        └── api.js                        [확인 필요]
```

---

## 📊 API 명세

### 1. 일정 목록 조회
```
GET /api/v1/events?startDate=2026-02-01&endDate=2026-02-28
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "series-1-1738483200000",
        "title": "주간 스탠드업",
        "start_at": "2026-02-03T10:00:00",
        "end_at": "2026-02-03T11:00:00",
        "series_id": 1,
        "is_generated": true,
        ...
      }
    ]
  }
}
```

---

### 2. 반복 일정 생성
```
POST /api/v1/events
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "title": "주간 스탠드업",
  "content": "매주 월요일 회의",
  "start_at": "2026-02-03T10:00:00",
  "end_at": "2026-02-03T11:00:00",
  "is_recurring": true,
  "recurrence_type": "week",
  "recurrence_interval": 1,
  "recurrence_end_date": "2026-03-31"
}

Response:
{
  "success": true,
  "data": {
    "series": {
      "id": 1,
      "title": "주간 스탠드업",
      "recurrence_type": "week",
      ...
    }
  }
}
```

---

### 3. 반복 일정 수정 (이 날짜만)
```
PUT /api/v1/events/:id
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "title": "주간 스탠드업 (변경)",
  "content": "특별 안건",
  "start_at": "2026-02-10T10:00:00",
  "end_at": "2026-02-10T11:00:00",
  "edit_type": "this",
  "occurrence_date": "2026-02-10"
}
```

---

### 4. 반복 일정 수정 (전체)
```
PUT /api/v1/events/:id
Body:
{
  "title": "주간 스탠드업 (전체 변경)",
  "content": "새로운 회의 내용",
  "edit_type": "all"
}
```

---

### 5. 반복 일정 삭제 (이 날짜만)
```
DELETE /api/v1/events/:id
Body:
{
  "delete_type": "this",
  "occurrence_date": "2026-02-10"
}
```

---

### 6. 반복 일정 삭제 (전체)
```
DELETE /api/v1/events/:id
Body:
{
  "delete_type": "all"
}
```

---

## 🐛 알려진 이슈

### 1. rate-limit 경고
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

**영향:** 없음 (경고만, 기능 정상 작동)

**해결 (선택):**
```javascript
// server.js
app.set('trust proxy', 1);
```

---

## 📚 참고 자료

### DB 스키마:
- `event_series` 테이블
- `event_exceptions` 테이블
- `recurrence_type` enum

### 기존 프로젝트 구조:
- `config/database.js` - query, transaction 헬퍼
- `routes/events.js.backup.*` - 기존 라우터 백업

---

## 👥 작업자 메모

**주니 (사용자):**
- 프로젝트: 회사 업무일정 관리 시스템
- 반복 일정 기능 추가 작업 진행 중
- 다음: 알림 기능 추가 예정

**Claude (AI):**
- 백엔드 API 구현 완료
- Docker 빌드 이슈 해결
- 프론트엔드 적용 대기 중

---

## ⏱️ 타임라인

- **09:00** - DB 구조 확인
- **09:30** - 백엔드 파일 작성 시작
- **09:45** - 경로 오류 해결
- **10:00** - 파일명 수정
- **10:15** - pool.connect 오류 발견
- **10:30** - transaction 헬퍼로 수정
- **10:45** - 현재 위치 (테스트 준비 중)

---

**마지막 업데이트:** 2026-02-01 10:45  
**다음 작업:** eventController-fixed.js 적용 및 API 테스트
