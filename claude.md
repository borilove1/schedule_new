# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

업무 일정 관리 시스템. 반복 일정, 알림(인앱/푸시/이메일), SSE 실시간 동기화, 일정 검색, 일정 공유, 댓글, 마감임박, 사용자 승인, 관리자 페이지, 프로필 관리, 다크모드를 지원하는 풀스택 웹 애플리케이션이며 Docker로 배포됩니다.

**기술 스택:**
- **백엔드**: Node.js 18+ / Express 4 / PostgreSQL 13+
- **프론트엔드**: React 18 (CRA) / lucide-react (아이콘)
- **인증**: JWT (jsonwebtoken) + bcrypt (12 rounds)
- **보안**: helmet (CSP/HSTS), cors (명시적 whitelist), express-rate-limit (5단계), express-validator, compression
- **알림**: pg-boss 9 (PostgreSQL 기반 큐) 리마인더 + 인앱 알림 + Web Push (web-push) + 이메일 (nodemailer)
- **실시간**: SSE (Server-Sent Events) 브로드캐스트 + Service Worker
- **배포**: Docker Compose (3 컨테이너: backend, frontend, database)
- **배포 경로**: `/var/www/schedule-app`
- **프로덕션 URL**: `https://teamschedule.mywire.org`

## 프로젝트 구조

```
schedule/
├── CLAUDE.md                           # Claude Code 가이드 (이 파일)
├── docker-compose.yml                  # Docker 오케스트레이션 (SSL 포함)
├── .env                                # Docker 환경변수 (⚠️ .gitignore 대상)
├── .env.example                        # 환경변수 템플릿 (민감 정보 제외)
│
├── backend/
│   ├── server.js                       # Express 진입점 + 보안 설정 + Rate Limit(5단계) + pg-boss 큐 + SSE + Push 초기화
│   ├── Dockerfile                      # node:18-alpine, production 빌드
│   ├── package.json
│   ├── .env                            # 백엔드 환경변수 (⚠️ .gitignore 대상)
│   ├── .env.example                    # 환경변수 템플릿
│   ├── config/
│   │   └── database.js                 # PG Pool (max:20) + query/transaction 헬퍼
│   ├── middleware/
│   │   ├── auth.js                     # JWT 인증 + 역할 권한(authorize) + 일정 권한(canViewEvent/canEditEvent)
│   │   └── errorHandler.js             # 중앙 에러 처리 (Validation/JWT/PG/커스텀 에러)
│   ├── routes/
│   │   ├── auth.js                     # 회원가입/로그인/로그아웃/내정보/프로필수정/비밀번호변경/이메일설정
│   │   ├── events.js                   # 일정 CRUD + 완료/완료취소 + 검색
│   │   ├── users.js                    # 사용자 관리 + 승인 (ADMIN 전용)
│   │   ├── organizations.js            # 조직 구조 CRUD (본부/처/부서)
│   │   ├── comments.js                 # 댓글 조회/CRUD + 댓글 알림 + SSE broadcast + 입력 검증 (2000자)
│   │   ├── notifications.js            # 알림 조회/읽음/삭제/리마인더체크
│   │   ├── settings.js                 # 시스템 설정 (ADMIN 전용) + SMTP 캐시 무효화 + 큐 재스케줄링
│   │   └── push.js                     # Web Push 구독/해제/VAPID 키 조회
│   └── src/
│       ├── controllers/
│       │   ├── eventController.js      # 일정 CRUD + 반복 일정 처리 + 검색 + 공유 + 큐 연동 + SSE broadcast (~1650줄)
│       │   └── notificationController.js # 알림 CRUD + notifyByScope(범위별 발송) + 이메일/푸시 연동
│       └── utils/
│           ├── recurringEvents.js      # 반복 일정 확장 로직 (duration_days 지원)
│           ├── reminderQueueService.js  # pg-boss 큐 기반 리마인더 + 마감임박 스케줄링/취소/재스케줄링
│           ├── sseManager.js           # SSE 연결 관리 (broadcast/sendToUser/heartbeat)
│           ├── pushService.js          # Web Push 발송 (VAPID, stale 구독 자동 정리)
│           └── emailService.js         # 이메일 발송 (nodemailer, SMTP 설정 캐시, HTML 템플릿)
│
├── schedule-frontend/
│   ├── Dockerfile                      # node:18-alpine 빌드 → nginx:alpine
│   ├── nginx.conf                      # SPA 라우팅 + /api/ 프록시 + 보안 헤더 (HSTS/CSP/X-Frame)
│   ├── package.json
│   ├── public/
│   │   └── sw.js                       # Service Worker (캐시 + Push 수신 + 알림 클릭 처리)
│   └── src/
│       ├── App.js                      # 루트 (ThemeProvider → AuthProvider → AppContent)
│       ├── index.js
│       ├── contexts/
│       │   ├── AuthContext.js          # 인증 상태 (user, login, register, logout, updateProfile)
│       │   ├── ThemeContext.jsx         # 다크모드 토글 (localStorage 저장)
│       │   └── NotificationContext.jsx  # 읽지 않은 알림 개수 (30초 폴링 + SSE + Push + Visibility API)
│       ├── hooks/
│       │   ├── useThemeColors.js       # 다크/라이트 색상 팔레트 반환
│       │   ├── useIsMobile.js          # 모바일 뷰포트 감지 (768px)
│       │   ├── useResponsive.js        # 반응형 screen/isMobile/isTablet/isDesktop
│       │   ├── useActionGuard.js       # 중복 클릭 방지 (execute/isGuarded/reset)
│       │   └── useCommonStyles.js      # 공통 스타일 객체 (fontFamily, input, label 등)
│       ├── components/
│       │   ├── common/
│       │   │   ├── Button.jsx          # 범용 버튼 (variant/size/loading/fullWidth)
│       │   │   ├── Input.jsx           # 입력 필드 (label/error/required)
│       │   │   ├── LoadingSpinner.jsx   # 로딩 스피너
│       │   │   ├── ErrorAlert.jsx      # 에러 알림 박스
│       │   │   ├── SuccessAlert.jsx    # 성공 알림 박스
│       │   │   ├── ConfirmDialog.jsx   # 확인 다이얼로그 (actions 배열)
│       │   │   └── Skeleton.jsx        # 로딩 플레이스홀더 (pulse 애니메이션)
│       │   ├── auth/
│       │   │   ├── LoginPage.jsx       # 로그인 폼 (비밀번호 토글, 다크모드 토글)
│       │   │   └── SignupPage.jsx      # 회원가입 폼 (조직 구조 연동, 승인 필요 안내)
│       │   ├── layout/
│       │   │   └── MainLayout.jsx      # 헤더(사용자정보/다크모드/알림벨/관리자/로그아웃) + 컨텐츠 (PC maxWidth: 1200px)
│       │   ├── calendar/
│       │   │   ├── Calendar.jsx        # 월간 캘린더 뷰 (메인 컨테이너, SSE 연동, 검색 모달)
│       │   │   ├── CalendarHeader.jsx  # 월/년 표시, 이전/다음 월, TODAY, 검색, + 버튼
│       │   │   ├── CalendarGrid.jsx    # 캘린더 그리드 (유연 레인: 멀티→단일 배치)
│       │   │   ├── calendarHelpers.js  # 날짜/주/멀티데이/단일/레인 할당 유틸
│       │   │   └── EventList.jsx       # 일정 목록 (탭 필터/날짜 필터/더보기/댓글 카운트/마감임박 뱃지)
│       │   ├── events/
│       │   │   ├── EventModal.jsx      # 일정 생성 모달 (반복 설정 + 처/실 공유)
│       │   │   ├── EventDetailModal.jsx # 일정 상세/수정/삭제/완료 모달
│       │   │   ├── EventDetailView.jsx # 일정 상세 표시 (상태/제목/시간/작성자/반복/공유/댓글)
│       │   │   ├── CommentSection.jsx  # 댓글 인라인 섹션 (조회/작성/수정/삭제)
│       │   │   ├── EventEditForm.jsx   # 일정 수정 폼 (반복/공유 설정 포함)
│       │   │   └── EventSearchModal.jsx # 일정 검색 모달 (디바운스 검색/페이징/결과 클릭)
│       │   ├── notifications/
│       │   │   ├── NotificationBell.jsx # 헤더 알림 벨 아이콘 + 뱃지 (99+) + 알림→일정 이동
│       │   │   └── NotificationModal.jsx # 알림 목록 모달 (전체/읽지않음 탭, 읽은 알림 삭제, 일정 이동)
│       │   ├── admin/
│       │   │   ├── AdminPage.jsx        # 관리자 탭 (사용자/조직/설정)
│       │   │   ├── UserManagement.jsx   # 사용자 목록/검색/역할/상태 필터/승인/페이징
│       │   │   ├── UserDetailModal.jsx  # 사용자 상세/수정 모달 (직급→역할 자동매핑)
│       │   │   ├── OrganizationManagement.jsx # 본부/처/부서 트리 관리
│       │   │   ├── OrgNodeEditModal.jsx # 조직 노드 편집 모달
│       │   │   └── SystemSettings.jsx   # 시스템 설정 관리 (17개 항목, multiSelect/SMTP/알림범위 설정)
│       │   └── profile/
│       │       └── ProfilePage.jsx      # 내 정보 수정 (기본정보 + 비밀번호 + 푸시 알림 토글 + 이메일 알림 설정)
│       └── utils/
│           ├── api.js                   # ApiClient 클래스 (fetch 기반, 싱글톤)
│           ├── eventHelpers.js          # 상태 색상/텍스트, 반복 설명, 날짜 정규화
│           ├── mockNotifications.js     # 알림 타입 enum, 상대시간, 아이콘 매핑
│           ├── sseClient.js            # SSE 클라이언트 (연결/해제/리스너/자동 재연결)
│           └── pushHelper.js           # Web Push 헬퍼 (구독/해제/상태 확인/권한 체크)
│
├── database/
│   ├── init.sql                        # 전체 스키마 + 시드 데이터
│   └── migrations/
│       ├── add_notifications_table.sql  # 알림 테이블
│       ├── add_event_shared_offices.sql # 일정 공유 테이블
│       └── add_user_approval.sql        # 사용자 승인 (approved_at)
│
├── load-tests/                         # Artillery 부하 테스트
│   ├── scenario1-login.yml             # 로그인 부하 (bcrypt CPU)
│   ├── scenario2-events-query.yml      # 반복 일정 조회 부하
│   ├── scenario3-crud.yml              # CRUD 동시 트랜잭션
│   ├── scenario4-notifications.yml     # 알림 폴링 부하
│   └── production/                     # 프로덕션 URL 버전
│
├── docs/
│   ├── TEST_PLAN.md                    # 종합 점검계획 (12단계 100+ 케이스)
│   ├── claude.md                       # (구) 반복 일정 프로젝트 개요
│   └── CLAUDE_CODE_GUIDE.md            # (구) 배포 및 트러블슈팅 가이드
│
└── .claude/
    └── agents/                         # Claude Code 에이전트 설정
        ├── security-expert.md          # 보안 취약점 분석
        ├── ui-designer.md              # UI/UX 디자인 가이드
        └── code-reviewer.md            # 코드 리뷰/디버깅
```

## 데이터베이스 스키마

### ENUM 타입
- `user_role`: USER, DEPT_LEAD, ADMIN
- `admin_scope`: DEPARTMENT, OFFICE, DIVISION
- `event_status`: PENDING, DONE
- `recurrence_type`: day, week, month, year
- `alert_time`: none, 30min, 1hour, 3hour, 1day

### 테이블 요약

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `divisions` | 본부 | name (UNIQUE) |
| `offices` | 처/실/지사 | name, division_id (FK), UNIQUE(name, division_id) |
| `departments` | 부서 | name, office_id (FK), UNIQUE(name, office_id) |
| `users` | 사용자 | email, password_hash, name, position, role, scope, department_id, office_id, division_id, is_active, **approved_at**, last_login_at, **email_notifications_enabled**, **email_preferences** (JSONB) |
| `event_series` | 반복 일정 템플릿 | title, content, recurrence_type/interval/end_date, start_time, end_time, first_occurrence_date, **duration_days**, status, completed_at, alert, creator_id, department_id, office_id, division_id |
| `events` | 단일+예외 일정 | title, content, start_at, end_at, status, completed_at, alert, series_id (FK), occurrence_date, is_exception, original_series_id, creator_id, department_id, office_id, division_id |
| `event_exceptions` | 반복 일정 예외 날짜 | series_id (FK), exception_date, UNIQUE(series_id, exception_date) |
| `event_shared_offices` | 일정 공유 처/실 | event_id XOR series_id, office_id (FK) |
| `comments` | 댓글 | content, event_id XOR series_id, author_id, is_edited |
| `notifications` | 인앱 알림 | user_id, type, title, message, is_read, related_event_id, related_series_id, metadata (JSONB) |
| `system_settings` | 시스템 설정 | key (UNIQUE), value (JSONB), description, updated_by |
| `push_subscriptions` | 푸시 구독 | user_id (FK), endpoint (UNIQUE), p256dh, auth, user_agent |
| `sessions` | 세션 (미사용) | user_id, token, expires_at |

### 주요 제약 조건
- `users.check_admin_scope`: DEPT_LEAD는 scope 필수, USER는 scope NULL, ADMIN은 scope 무관
- `events.check_time_range`: end_at > start_at
- `events.check_series_occurrence`: series_id와 occurrence_date는 둘 다 있거나 둘 다 NULL
- `event_shared_offices.check_event_or_series`: event_id XOR series_id (정확히 하나만)
- `comments.check_comment_target`: event_id XOR series_id

### 뷰 (View)
- `v_users_with_org`: 사용자 + 조직 정보 + approved_at 조인
- `v_events_with_details`: 일정 + 작성자/조직 정보 조인
- `v_comments_with_details`: 댓글 + 작성자 정보 조인

### 트리거
- 모든 테이블에 `update_updated_at_column()` 트리거: UPDATE 시 `updated_at` 자동 갱신

### PG 함수
- `can_view_event(user_id, division_id, office_id, department_id)`: 역할 기반 일정 조회 권한 확인

### 시드 데이터
- 부산울산본부 1개, 20개 처/실/지사, 19개 부서 (기획관리실 4, 전력사업처 7, 전력관리처 8)
- 기본 관리자: `admin@admin.com` / `admin1234`
- 시스템 설정 기본값 17개 (reminder_times, due_soon_threshold, SMTP, notification_config 포함)

## 핵심 아키텍처

### 인증/권한 체계
- **USER**: 같은 부서 + 공유된 처/실의 일정만 조회 가능
- **DEPT_LEAD**: scope에 따라 DEPARTMENT/OFFICE/DIVISION 범위 조회
- **ADMIN**: 모든 일정 조회/수정 가능, 관리자 페이지 접근

미들웨어 체인: `authenticate` (JWT 검증 → req.user 설정) → `authorize(...roles)` (역할 체크)

**스코프 필터링** (`buildScopeFilter()`):
- ADMIN → 필터 없음 (1=1)
- 본부장 → division_id 일치
- 처장/실장 → office_id 일치
- 사원~부장 → department_id 일치
- 추가로 `event_shared_offices`를 통한 공유 일정도 조회 가능

### 사용자 승인 워크플로우
1. 회원가입 → `is_active=false`, `approved_at=NULL`
2. 로그인 시도 → AUTH_006 ("관리자 승인 필요")
3. 관리자에게 USER_REGISTERED 알림 (`notifyByScope` → admins scope)
4. 관리자가 `PATCH /users/:id/approve` → `is_active=true`, `approved_at=NOW()`
5. ACCOUNT_APPROVED 알림 → 사용자에게 전달 (`notifyByScope` → target scope)
6. 승인 후 로그인 가능

### 반복 일정 시스템

**데이터 흐름:**
1. 반복 일정 생성 → `event_series`에 템플릿 저장 (duration_days로 다일 지원)
2. 조회 시 `generateOccurrencesFromSeries()`가 날짜 범위에 맞게 가상 일정 생성
3. 가상 일정 ID 형식: `series-{seriesId}-{occurrenceTimestamp}` (예: `series-1-1770076800000`)
4. "이번만 수정/삭제/완료" → `event_exceptions`에 날짜 추가 + `events`에 예외 이벤트 생성
5. "전체 수정" → `event_series` 직접 UPDATE
6. "전체 완료" → `event_series.status = 'DONE'` + 관련 예외 이벤트도 DONE
7. 단일→반복 변환: transaction 내에서 series INSERT + 기존 event 삭제

**중요 패턴:**
- series-* ID를 가진 이벤트에 "이번만" 작업 시, 새 예외 이벤트(숫자 ID)가 생성됨
- 따라서 프론트엔드에서 series-* 이벤트 작업 후에는 **모달을 닫고 캘린더를 새로고침** (원래 series-* ID로는 수정 결과 조회 불가)
- `event_series`의 `status`/`completed_at`이 가상 일정 생성 시 기본값으로 사용됨

### 일정 공유 시스템
- `event_shared_offices` 테이블: event_id 또는 series_id + office_id
- 생성/수정 시 선택한 처/실을 INSERT (기존 DELETE 후 재INSERT)
- "이번만 수정" 시 시리즈 공유 처를 예외 이벤트로 복사
- 조회 시 `buildScopeFilter()`에서 shared office도 포함하여 필터링

### 일정 검색 시스템
- **백엔드**: `GET /api/v1/events/search?q=검색어&page=1&limit=20`
- events + event_series 모두 검색 (title/content ILIKE)
- 스코프 필터 적용 (권한 범위 내 일정만 검색)
- ILIKE 와일드카드 이스케이핑 (`%`, `_`, `\`)
- 이벤트 우선, 이후 시리즈 순으로 페이지네이션
- **프론트엔드**: `EventSearchModal` (디바운스 검색, 2글자 이상, 페이징, 결과 클릭 시 상세 모달)

### 마감임박 시스템 (Due Soon)
- **시스템 설정**: `due_soon_threshold` (복수 선택: 30min/1hour/3hour)
- **판정 로직**: `getEvents()`에서 각 일정의 **종료 시간**이 현재~threshold 이내 + PENDING 상태 → `isDueSoon: true`
- **캘린더 표시**: 앰버(amber) 색상 뱃지로 마감임박 일정 강조
- **알림**: `EVENT_DUE_SOON` 타입으로 별도 알림 발송 (pg-boss 큐, `duesoon-*` singletonKey)
- **스케줄링**: `scheduleEventReminder()`에서 리마인더와 마감임박 알림을 동시 스케줄링 (**종료 시간 기준**)
- **알림 메시지**: "○○○ 일정이 N분 후에 종료됩니다."

### 일정 지연 시스템 (Overdue)
- **시스템 설정**: `notification_config.EVENT_OVERDUE` (활성화 토글 + 수신 범위)
- **판정 로직 (API)**: `getEvents()`, `getEventById()`, `searchEvents()`에서 **종료 시간** < 현재 시간 + PENDING 상태 → `status: 'OVERDUE'` 반환
- **캘린더 표시**: 빨간색(#ef4444) 뱃지로 지연 일정 강조
- **알림 발송**: 일정 **종료 시간**에 pg-boss 작업 실행 → 해당 일정이 여전히 PENDING 상태면 `EVENT_OVERDUE` 알림 발송
- **스케줄링**: `scheduleEventReminder()`에서 **종료 시간**에 지연 체크 작업 스케줄링 (`overdue-*` singletonKey)
- **취소**: 일정 완료/삭제 시 `cancelEventReminders()`에서 overdue 작업도 함께 취소
- **알림 메시지**: "○○○ 일정의 종료시간이 지났으나 완료처리 되지 않았습니다."

### 타임존 처리 (KST 보정)

**문제 상황:**
- 사용자가 KST(한국시간)로 17:30 입력 → 프론트엔드가 `2026-02-09T17:30:00` 전송
- Docker(UTC) 환경의 PostgreSQL이 이를 UTC 17:30으로 해석하여 저장
- 실제 의도는 KST 17:30 = UTC 08:30이지만, DB에는 UTC 17:30으로 저장됨 (9시간 차이)

**해결 방법:**
- `KST_OFFSET_MS = 9 * 60 * 60 * 1000` (9시간 밀리초)
- DB에서 읽은 시간에서 9시간을 빼서 실제 UTC로 변환 후 비교
- 예: DB 17:30 → `new Date(storedTime).getTime() - KST_OFFSET_MS` → UTC 08:30

**적용 위치:**
| 파일 | 함수 | 용도 |
|------|------|------|
| `eventController.js` | `getEvents()` | isDueSoon/isOverdue 판정 |
| `eventController.js` | `getEventById()` | 단일 일정 isOverdue 판정 |
| `eventController.js` | `searchEvents()` | 검색 결과 isOverdue 판정 |
| `reminderQueueService.js` | `scheduleEventReminder()` | 알림 스케줄링 시간 계산 |

**프론트엔드 전달:**
- `toNaiveDateTimeString()`으로 getUTC*를 사용하여 원래 입력값 복원
- 타임존 없는 `YYYY-MM-DDTHH:mm:ss` 문자열로 전달 (프론트엔드에서 로컬 시간으로 표시)

**주의사항:**
- 시간 비교 시 반드시 KST 오프셋 보정 필요 (isDueSoon, isOverdue, 알림 스케줄링)
- DB 저장/조회는 기존 방식 유지 (나이브 문자열)

### SSE 실시간 동기화

**아키텍처:**
- **백엔드** (`sseManager.js`): userId별 SSE 연결 관리 (Map<userId, Set<res>>)
- **프론트엔드** (`sseClient.js`): EventSource 기반 SSE 클라이언트
- **SSE 엔드포인트**: `GET /api/v1/sse/events?token=JWT` (EventSource는 커스텀 헤더 미지원 → 쿼리 파라미터 토큰)

**연결 관리:**
- 서버: 30초 하트비트, 연결 종료 시 자동 정리
- 클라이언트: 연속 에러 3회 시 강제 재연결 (5초 딜레이), Visibility API로 앱 복귀 시 재연결
- nginx: `X-Accel-Buffering: no`로 SSE 스트리밍 프록시
- compression 미들웨어: SSE 응답 제외 (`text/event-stream` 필터)

**브로드캐스트 이벤트:**
- `event_changed`: 일정 CRUD/완료/완료취소 시 모든 연결 클라이언트에 전송 (action: created/updated/deleted/completed/uncompleted)
- `event_changed` (action: comment_updated): 댓글 작성/삭제 시 전송
- 프론트엔드: `Calendar.jsx`에서 `onSSE('event_changed', ...)` → 스켈레톤 없이 즉시 데이터 새로고침
- 프론트엔드: `NotificationContext`에서 `onSSE('event_changed', ...)` → 알림 카운트 갱신

**함수:**
- `broadcast(eventType, data, excludeUserId)`: 전체 클라이언트에 전송 (선택적 사용자 제외)
- `sendToUser(userId, eventType, data)`: 특정 사용자에게만 전송
- `handleSSEConnection(req, res)`: SSE 연결 핸들러

### 알림 시스템 (3채널: 인앱 + 푸시 + 이메일)

**알림 발송 아키텍처 (`notifyByScope`):**
1. `notification_config` 시스템 설정에서 해당 알림 타입 활성화 여부 확인
2. `scope`에 따라 수신자 목록 결정 (`resolveRecipients()`)
3. 행위자 본인 제외 (자기 알림 방지)
4. 각 수신자에게 `createNotification()` 호출 → 인앱 + 이메일 + 푸시 동시 발송

**알림 scope 종류:**
| scope | 수신 대상 |
|-------|-----------|
| `creator` | 일정 작성자 |
| `target` | 특정 대상 사용자 (예: 승인된 사용자) |
| `department` | 같은 부서 전체 |
| `dept_leads` | 상위 부서장 (DEPARTMENT/OFFICE/DIVISION scope) - 레거시 |
| `dept_lead_department` | 같은 부서 부장 (DEPT_LEAD + scope=DEPARTMENT) |
| `dept_lead_office` | 같은 처 처장/실장 (DEPT_LEAD + scope=OFFICE) |
| `dept_lead_division` | 같은 본부 본부장 (DEPT_LEAD + scope=DIVISION) |
| `office` | 같은 처 전체 |
| `shared_offices` | 공유된 처/실 전체 (sharedOfficeIds 기반) |
| `admins` | 모든 ADMIN |

**알림 scopes 배열 지원:**
- `notifyByScope()`가 단일 scope 또는 scopes 배열 모두 지원
- 예: `notification_config.EVENT_COMPLETED.scopes = ["creator", "dept_lead_office"]`
- 배열 내 각 scope를 순회하며 수신자 목록 합산 (중복 제거)

**알림 타입:**
| 타입 | 기본 scope | 설명 |
|------|-----------|------|
| `EVENT_REMINDER` | creator | 일정 시작 전 리마인더 |
| `EVENT_DUE_SOON` | creator | 마감임박 알림 |
| `EVENT_OVERDUE` | creator | 일정 지연 알림 |
| `EVENT_UPDATED` | creator | 일정 수정 알림 |
| `EVENT_COMPLETED` | dept_leads | 일정 완료 알림 |
| `EVENT_DELETED` | creator | 일정 삭제 알림 |
| `EVENT_COMMENTED` | creator | 댓글 알림 |
| `EVENT_SHARED` | shared_offices | 공유 일정 알림 (일정 공유 시 공유된 처/실에 발송) |
| `USER_REGISTERED` | admins | 신규 가입 승인 요청 |
| `ACCOUNT_APPROVED` | target | 계정 승인 완료 |

#### pg-boss 큐 기반 리마인더

**큐 아키텍처:**
- **pg-boss 9** (PostgreSQL 기반 작업 큐): 별도 인프라(Redis) 없이 기존 DB 활용
- 서버 시작 시 `boss.start()` → `pgboss` 스키마에 작업 테이블 자동 생성
- `event-reminder` 워커: `teamConcurrency: 5`로 동시 처리
- `series-reminder-scheduler`: 매일 자정+정오(`0 0,12 * * *`) 반복 일정 스케줄링

**리마인더 스케줄링 흐름:**
- **단일 일정**: CRUD 시점에 `scheduleEventReminder()` → pg-boss에 지연 작업 등록 (`startAfter`)
- **반복 일정**: daily scheduler가 48시간 이내 occurrence를 스캔 → 작업 등록
- **알림 시간**: 시스템 설정 `reminder_times`에서 읽음 (기본: `["1hour"]`, 옵션: 30min/1hour/3hour)
- **마감임박**: 시스템 설정 `due_soon_threshold`에서 읽음 → `duesoon-*` singletonKey로 별도 스케줄링
- **일정 지연**: `notification_config.EVENT_OVERDUE.enabled`가 true면 시작 시간에 `overdue-*` 작업 스케줄링
- **관리자 설정 변경**: `rescheduleAllReminders()` → 기존 대기 작업 전체 삭제 후 재스케줄링
- **중복 방지**: `singletonKey`로 작업 고유성 보장 (예: `reminder-event-123-1hour`, `duesoon-event-123-3hour`, `overdue-event-123`)

**큐 연동 포인트 (eventController.js):**
| 액션 | 큐 호출 |
|------|---------|
| 일정 생성 (단일) | `scheduleEventReminder(eventId, startAt, creatorId)` |
| 일정 수정 (단일) | `cancelEventReminders(id)` → `scheduleEventReminder(...)` |
| 일정 수정 (시리즈 "이번만") | `scheduleEventReminder(newEventId, ...)` (새 예외 이벤트) |
| 일정 수정 (시리즈 "전체") | `cancelSeriesReminders(seriesId)` (daily scheduler가 재스케줄링) |
| 일정 삭제 (단일) | `cancelEventReminders(id)` |
| 일정 삭제 (시리즈 전체) | `cancelSeriesReminders(seriesId)` |
| 일정 완료 (단일) | `cancelEventReminders(id)` |
| 일정 완료 (시리즈 전체) | `cancelSeriesReminders(seriesId)` |
| 완료 취소 (단일) | `scheduleEventReminder(eventId, ...)` |

**워커 처리 로직 (processEventReminder):**
1. 이벤트 아직 유효한지 확인 (삭제/완료 안됨)
2. 반복 일정은 해당 날짜가 예외인지 추가 확인
3. 4시간 이내 중복 알림 체크 (`metadata->>'timeKey'`)
4. `notifyByScope()` 호출 (알림 타입에 따라 EVENT_REMINDER 또는 EVENT_DUE_SOON)

#### Web Push 알림

**아키텍처:**
- **VAPID 인증**: 환경변수 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` 사용
- **백엔드** (`pushService.js`): `web-push` 라이브러리, `sendPushToUser()` → 사용자의 모든 구독에 발송
- **프론트엔드** (`pushHelper.js`): `subscribeToPush()`, `unsubscribeFromPush()`, `isSubscribedToPush()`
- **Service Worker** (`sw.js`): Push 이벤트 수신 → `showNotification()`, 클릭 시 앱 포커스/오픈

**흐름:**
1. 프론트 로그인 → Service Worker 등록 → Push 권한 요청
2. 권한 granted → `PushManager.subscribe()` → 구독 정보를 `POST /api/v1/push/subscribe`
3. `createNotification()` 호출 시 → `sendPushToUser()` 비동기 발송
4. Service Worker가 Push 수신 → 시스템 알림 표시 + `NOTIFICATION_RECEIVED` 메시지 → 앱 내 카운트 즉시 갱신
5. 알림 클릭 → 앱 창 포커스 또는 새 탭 오픈

**stale 구독 정리:**
- 410/404 응답 시 해당 구독 자동 DELETE (브라우저가 구독 해제한 경우)

#### 이메일 알림

**아키텍처:**
- **백엔드** (`emailService.js`): `nodemailer` 기반, SMTP 설정은 `system_settings`에서 동적 로드
- **인증 방식 3가지**: LOGIN (사용자명/비밀번호), NONE (내부 릴레이), API_KEY (SendGrid/Mailgun)
- **트랜스포터 캐시**: 설정 변경 전까지 재사용, 설정 변경 시 `invalidateTransporterCache()` 호출

**발송 조건 (모두 충족 시):**
1. 시스템 설정 `email_enabled` = true
2. 사용자 `email_notifications_enabled` = true (마스터 토글)
3. 사용자 `email_preferences[type]` !== false (타입별 수신 설정)
4. SMTP 설정 완료 (`smtp_from_email` 필수)

**흐름:**
- `createNotification()` → `sendEmailNotification()` 비동기 호출 (인앱 알림에 영향 없음)
- 사용자 설정 + 시스템 설정 확인 후 조건 통과 시 `sendEmail()` 호출
- HTML 템플릿 기반 이메일 발송

### 댓글 시스템
- **인라인 UI**: EventDetailView 하단에 CommentSection 컴포넌트 (구분선 아래)
- **데이터 흐름**: eventId가 `series-*` 형식이면 seriesId 추출 → 시리즈 댓글 API 호출
- **CRUD**: 조회(GET)/작성(POST)/수정(PUT, 본인만)/삭제(DELETE, 본인 또는 ADMIN), express-validator로 content 필수+2000자 제한
- **알림**: `notifyByScope('EVENT_COMMENTED', ...)` → scope 설정에 따라 수신자 결정 (기본: creator)
- **SSE**: 댓글 작성/삭제 시 `broadcast('event_changed', { action: 'comment_updated' })` → 실시간 UI 갱신
- **EventList 뱃지**: `getEvents()` 응답에 `commentCount` 포함 → 카드에 💬 N 뱃지 표시
- **UX**: Enter 전송/Shift+Enter 줄바꿈, 이니셜 아바타(작성자별 색상), 상대 시간, (수정됨) 뱃지
- **권한**: canEdit=true면 댓글 작성 가능, 수정은 본인만, 삭제는 본인 또는 ADMIN

### 캘린더 그리드 레인 시스템
- 멀티데이 이벤트를 `assignLanes()`로 비충돌 레인 배치 (최대 PC:5, 모바일:3)
- **유연 레인 배치**: 멀티데이 우선 배치 후 각 셀의 빈 레인에 단일 일정을 절대 위치로 배치
- 빈 레인이 부족한 셀은 +n 오버플로우로 표시
- 소유 일정: 상태 색상 표시 / 타인 일정: 회색 + 작성자명
- 마감임박 일정: 앰버(amber) 색상 뱃지

### 프론트엔드 네비게이션
- SPA (라우터 미사용), `currentPage` state로 페이지 전환
- `calendar`: 기본 캘린더 뷰
- `admin`: ADMIN 역할 전용 관리자 페이지
- `profile`: 내 정보 수정 페이지
- Context Provider 순서: ThemeProvider → AuthProvider → NotificationProvider
- **알림→일정 이동**: `pendingEventId` state로 알림 클릭 시 해당 일정 상세 모달 자동 오픈

### 프론트엔드 공통 컴포넌트
- `Button`: primary/secondary/danger/success/ghost 변형, loading 상태
- `Input`: label + error + required 지원
- `ConfirmDialog`: 확인/취소 다이얼로그 (actions 배열)
- `Skeleton`: 로딩 플레이스홀더 (pulse 애니메이션)
- `ErrorAlert`, `SuccessAlert`: 알림 박스

### Service Worker (`sw.js`)
- **캐시 전략**: 앱 셸 프리캐시 (/, index.html, manifest.json, logo)
  - 정적 자산: cache-first (JS/CSS/PNG/SVG/WOFF)
  - 네비게이션: network-first, 오프라인 시 캐시된 index.html 폴백
  - API 요청: 네트워크 직접 전달 (캐시 안 함)
- **Push 수신**: `push` 이벤트 → `showNotification()` + 앱 내 `NOTIFICATION_RECEIVED` 메시지
- **알림 클릭**: 기존 앱 창 포커스 또는 새 탭 오픈, `NOTIFICATION_CLICKED` 메시지

## API 엔드포인트

모든 API는 `/api/v1` 프리픽스. 인증 필요 시 `Authorization: Bearer {token}` 헤더.

### 인증 (`/auth`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | /register | X | 회원가입 → is_active=false, 관리자 알림 |
| POST | /login | X | 로그인 → token + user (승인 상태 검증) |
| POST | /logout | O | 로그아웃 |
| GET | /me | O | 현재 사용자 정보 (조직 포함) |
| PUT | /me | O | 프로필 수정 (이름, 직급, 소속) |
| PUT | /change-password | O | 비밀번호 변경 (현재 비밀번호 검증) |
| GET | /email-preferences | O | 이메일 알림 설정 조회 (시스템 + 사용자 설정) |
| PUT | /email-preferences | O | 이메일 알림 설정 수정 (마스터 토글 + 타입별) |

### 일정 (`/events`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | / | O | 일정 목록 (startDate, endDate 쿼리, 반복 자동 확장, 공유 일정 포함, isDueSoon 포함) |
| GET | /search | O | 일정 검색 (q, page, limit 쿼리, 이벤트+시리즈 검색, 스코프 필터) |
| GET | /:id | O | 일정 상세 (series-* ID 지원) |
| POST | / | O | 일정 생성 (isRecurring + sharedOfficeIds) |
| PUT | /:id | O | 일정 수정 (seriesEditType: 'this'/'all', isRecurring으로 단일→반복 변환) |
| DELETE | /:id | O | 일정 삭제 (deleteType: 'this'/'all' 또는 'single'/'series') |
| POST | /:id/complete | O | 완료 처리 (completeType: 'this'/'all') |
| POST | /:id/uncomplete | O | 완료 취소 |

### 사용자 (`/users`) - ADMIN 전용
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | / | O (ADMIN) | 사용자 목록 (search, role, active, departmentId 등 필터 + 페이징) |
| GET | /pending-count | O (ADMIN) | 승인 대기 사용자 수 |
| GET | /:id | O | 사용자 상세 (본인 또는 ADMIN) |
| PUT | /:id | O (ADMIN) | 사용자 수정 (직급→역할 자동매핑) |
| PATCH | /:id/approve | O (ADMIN) | 사용자 승인 (is_active=true, approved_at) |
| PATCH | /:id/toggle-active | O (ADMIN) | 활성화/비활성화 토글 |
| DELETE | /:id | O (ADMIN) | 사용자 삭제 |

### 조직 (`/organizations`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /structure | X | 전체 조직 구조 (계층형) |
| GET | /divisions | X | 본부 목록 |
| GET | /offices | X | 처 목록 (?divisionId 필터) |
| GET | /departments | X | 부서 목록 (?officeId 필터) |
| POST | /divisions | O (ADMIN) | 본부 생성 |
| PUT | /divisions/:id | O (ADMIN) | 본부 수정 |
| DELETE | /divisions/:id | O (ADMIN) | 본부 삭제 (소속 사용자 있으면 거부) |
| POST | /offices | O (ADMIN) | 처 생성 |
| PUT | /offices/:id | O (ADMIN) | 처 수정 |
| DELETE | /offices/:id | O (ADMIN) | 처 삭제 |
| POST | /departments | O (ADMIN) | 부서 생성 |
| PUT | /departments/:id | O (ADMIN) | 부서 수정 |
| DELETE | /departments/:id | O (ADMIN) | 부서 삭제 |

### 댓글 (`/comments`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /events/:eventId | O | 일정 댓글 목록 (v_comments_with_details, ASC) |
| GET | /series/:seriesId | O | 시리즈 댓글 목록 |
| POST | /events/:eventId | O | 일정에 댓글 추가 (canViewEvent 확인) + 알림 + SSE broadcast |
| POST | /series/:seriesId | O | 시리즈에 댓글 추가 + 알림 + SSE broadcast |
| PUT | /:id | O | 댓글 수정 (본인만, is_edited=true) |
| DELETE | /:id | O | 댓글 삭제 (본인 또는 ADMIN) + SSE broadcast |

### 알림 (`/notifications`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | / | O | 알림 목록 (?limit, ?isRead 필터) |
| GET | /unread-count | O | 읽지 않은 알림 수 |
| PATCH | /:id/read | O | 알림 읽음 처리 |
| POST | /read-all | O | 전체 읽음 처리 |
| DELETE | /read | O | 읽은 알림 전체 삭제 |
| DELETE | /:id | O | 알림 삭제 |
| POST | /check-reminders | O | 수동 리마인더 체크 (기존 이벤트 + 시리즈 재스케줄링) |

### 푸시 알림 (`/push`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /vapid-public-key | O | VAPID 공개키 조회 |
| POST | /subscribe | O | 푸시 구독 등록 (endpoint, keys 검증) |
| DELETE | /unsubscribe | O | 푸시 구독 해제 |

### SSE (`/sse`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /events?token=JWT | O | SSE 실시간 이벤트 스트림 (쿼리 파라미터 토큰 인증) |

### 시스템 설정 (`/settings`) - ADMIN 전용
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | / | O (ADMIN) | 전체 설정 조회 |
| PUT | / | O (ADMIN) | 설정 일괄 수정 (reminder_times/due_soon_threshold 변경 시 큐 재스케줄링, SMTP 변경 시 캐시 무효화) |
| GET | /:key | O (ADMIN) | 개별 설정 조회 |
| PUT | /:key | O (ADMIN) | 개별 설정 수정 |
| POST | /test-email | O (ADMIN) | SMTP 연결 테스트 + 관리자 이메일로 테스트 발송 |

## API 응답 패턴

```json
// 성공
{ "success": true, "data": { ... } }

// 에러
{ "success": false, "error": { "code": "ERROR_CODE", "message": "에러 메시지" } }
```

**주요 에러 코드**: AUTH_003 (토큰 없음), AUTH_004 (토큰 만료), AUTH_005 (권한 없음), AUTH_006 (승인 대기), AUTH_007 (비활성화), VALIDATION_ERROR, DUPLICATE_EMAIL, DUPLICATE_NAME, INVALID_PASSWORD, USER_001 (사용자 없음), HAS_USERS (소속원 존재), RATE_LIMIT (요청 초과)

## Rate Limiting

5개 Rate Limiter 활성화 (`server.js`, `trust proxy: 1`로 실제 IP 기반):
- **로그인**: 15분당 10회 (`/api/v1/auth/login`)
- **인증 전체**: 15분당 N회 (`/api/v1/auth`, `RATE_LIMIT_MAX_REQUESTS` 환경변수)
- **일정**: 30초당 100회 (`/api/v1/events`)
- **댓글**: 1분당 30회 (`/api/v1/comments`)
- **푸시**: 1분당 20회 (`/api/v1/push`)

**프론트엔드 Rate Limit UX**:
- Calendar.jsx에서 카운트다운 상태 관리 (`rateLimitCountdown`, `startCountdown`)
- EventDetailModal/EventModal에 `rateLimitCountdown`과 `onRateLimitStart` props 전달
- 모달 내 API 에러 catch에서 rate limit 감지 시 `onRateLimitStart(30)` 호출
- EventDetailView/EventEditForm/EventModal에 노란색 카운트다운 배너 표시 (30→0초)
- 카운트다운이 Calendar에서 공유 관리되므로 모달 닫고 다른 일정 열어도 카운트다운 유지
- loadEvents에서 rate limit 시 30초 후 자동 재시도

## 주요 코드 패턴

### 프론트엔드 api.js
- `ApiClient` 클래스, 싱글톤 `export const api = new ApiClient()`
- `API_BASE_URL`은 `REACT_APP_API_URL` 환경변수 또는 `/api/v1` (nginx 프록시 사용 시)
- **중요**: `getEvent()`는 `response?.event || response` 반환
- `request()` 메서드가 `{ success: true, data: {...} }` 형태면 `data`만 자동 추출
- 메서드 그룹: Auth, Events (CRUD + search), Users, Organizations, Settings, Comments, Notifications, Push (subscribe/unsubscribe/vapidKey), EmailPreferences

### 프론트엔드 상태 관리
- React Context API만 사용 (외부 상태 관리 라이브러리 없음)
- `AuthContext`: user 객체, login/register/logout/updateProfile
- `ThemeContext`: isDarkMode, toggleDarkMode (localStorage 연동)
- `NotificationContext`: unreadCount, refreshNotifications (30초 폴링 + SSE + Push + Visibility API), pushSupported/pushSubscribed 상태

### 프론트엔드 실시간 갱신 패턴
- **SSE 연결**: `Calendar.jsx` mount 시 `connectSSE()` → `onSSE('event_changed', loadEvents)`
- **알림 갱신 경로** (4가지):
  1. 30초 폴링 (`setInterval`)
  2. SSE `event_changed` 이벤트 수신
  3. Visibility API (`visibilitychange` → 앱 복귀 시 즉시 갱신)
  4. Service Worker `NOTIFICATION_RECEIVED` 메시지 (푸시 도착 시 즉시 갱신)

### 프론트엔드 스타일링
- CSS-in-JS (인라인 스타일), 외부 CSS 파일 없음
- lucide-react 아이콘만 사용
- 다크모드: `useThemeColors()` 훅으로 색상 팔레트 공급
- 디자인 토큰: `styles/design-tokens.js` (spacing, fontSize, shadow, breakpoints)
- 폰트: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- 반응형: `useIsMobile()` / `useResponsive()` 훅

### 프론트엔드 UX 패턴
- `useActionGuard()`: 중복 클릭 방지 (execute/isGuarded/reset)
- `React.memo`: CalendarGrid, EventList 등 무거운 컴포넌트 메모이제이션
- ESC 키: 모든 모달 닫기 지원
- 클릭 외부 감지: 드롭다운/모달 닫기 (useRef + useEffect)
- requestAnimationFrame: 모달 열림 애니메이션
- **모달 닫기 애니메이션**: `isClosing` state로 슬라이드 다운 애니메이션 후 unmount (EventModal, EventDetailModal)
- **캘린더 월 이동 애니메이션**: PC/모바일 모두 좌/우 슬라이드 효과 (`animateMonthChange`, `slideStyle`)

### 백엔드 eventController.js
- `toNaiveDateTimeString()`: PG TIMESTAMPTZ → 나이브 문자열 변환 (UTC 기준)
- `formatEventRow()`: DB row의 모든 타임스탬프 필드를 나이브 문자열로 변환
- `buildScopeFilter()`: 역할/직급 기반 SQL WHERE절 동적 생성
- camelCase(프론트엔드)와 snake_case(DB) 양방향 지원
- `getEvents()`에서 반복 일정 자동 확장 + 예외 이벤트 상태 반영 + 공유 일정 포함 + isDueSoon 판정 + commentCount 집계
- `searchEvents()`: 이벤트+시리즈 검색, 스코프 필터, 페이지네이션
- CRUD 시 `reminderQueueService` 호출 (큐 연동) + `broadcast()` 호출 (SSE 실시간 갱신)
- 모든 CRUD 작업에서 `notifyByScope()` 호출 (범위별 알림 발송)

### 백엔드 database.js
- `query(text, params)`: 파라미터화된 쿼리 실행 (SQL injection 방지)
- `transaction(callback)`: BEGIN/COMMIT/ROLLBACK 자동 처리
- 개발 모드에서 쿼리 실행 시간 로깅, 프로덕션에서는 에러 메시지만 로깅 (파라미터 제외)
- Pool: max 20, idle 30s, connect timeout 2s

## 로컬 개발 환경

### 백엔드
```bash
cd backend
npm install
cp .env.example .env   # DB_PASSWORD, JWT_SECRET 수정
npm run dev             # nodemon 자동 재시작 (포트 3000)
```

### 프론트엔드
```bash
cd schedule-frontend
npm install
npm start               # CRA 개발 서버
```

### Health Check
```bash
curl http://localhost:3000/health
# → {"success": true, "message": "Server is running", "timestamp": "..."}
```

## 배포 (Docker)

### Docker Compose 구성
- `database`: postgres:13-alpine (내부 5432 expose만, 외부 포트 미노출), healthcheck 포함
- `backend`: node:18-alpine (포트 3001:3000), database healthy 이후 시작, JWT Secret 검증
- `frontend`: nginx:alpine (포트 8080:80, 443:443), SSL + 보안 헤더 (HSTS/X-Frame/CSP), /api/ → backend:3000 프록시

### 프론트엔드 배포
```bash
cd /var/www/schedule-app
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### 백엔드 배포
```bash
cd /var/www/schedule-app
docker-compose build --no-cache backend
docker-compose up -d backend
```

### 전체 재시작
```bash
cd /var/www/schedule-app
docker-compose restart backend frontend
```

### 로그 확인
```bash
docker-compose logs backend --tail=50 -f
docker-compose logs frontend --tail=50 -f
```

### DB 접속
```bash
docker-compose exec database psql -U scheduleuser -d schedule_management
```

### DB 마이그레이션 실행
```bash
docker-compose exec database psql -U scheduleuser -d schedule_management -f /path/to/migration.sql
```

## 환경 변수

> **주의**: `.env` 파일은 `.gitignore`에 등록됨. `.env.example`을 복사하여 사용.
> **JWT_SECRET 생성**: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
> 프로덕션에서 약한 JWT_SECRET 사용 시 서버가 시작 거부됨 (server.js 검증)

### 프로젝트 루트 `.env` (Docker Compose용)
```
NODE_ENV=production
DB_NAME=schedule_management
DB_USER=scheduleuser
DB_PASSWORD=<강력한 비밀번호>
JWT_SECRET=<64자 이상 랜덤 문자열>
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://teamschedule.mywire.org
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
VAPID_PUBLIC_KEY=<VAPID 공개키>
VAPID_PRIVATE_KEY=<VAPID 비밀키>
VAPID_SUBJECT=mailto:admin@admin.com
```

### `backend/.env` (로컬 개발용)
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5433
DB_NAME=schedule_management
DB_USER=scheduleuser
DB_PASSWORD=<비밀번호>
JWT_SECRET=<64자 이상 랜덤 문자열>
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
VAPID_PUBLIC_KEY=<VAPID 공개키 (없으면 푸시 비활성)>
VAPID_PRIVATE_KEY=<VAPID 비밀키>
VAPID_SUBJECT=mailto:admin@admin.com
```

> **VAPID 키 생성**: `npx web-push generate-vapid-keys`
> VAPID 키가 없으면 푸시 알림이 비활성화되며, 서버는 정상 작동합니다.

## 부하 테스트

Artillery 기반 4개 시나리오 (`load-tests/`):
- **시나리오1**: 로그인 부하 (bcrypt CPU, 5→20→50 req/s)
- **시나리오2**: 반복 일정 조회 (generateOccurrences 성능, 5→15→30 req/s)
- **시나리오3**: CRUD 동시 트랜잭션 (생성→조회→수정→삭제 라이프사이클, 3→10→20 req/s)
- **시나리오4**: 알림 폴링 (60 동시 사용자, 60초 간격)

```bash
npx artillery run load-tests/scenario1-login.yml
```

## 트러블슈팅

### Docker 프론트엔드 빌드에서 새 파일이 포함 안 되는 경우
```bash
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### 반복 일정 관련 디버깅
```sql
-- event_series 상태 확인
SELECT id, title, status, completed_at, duration_days FROM event_series WHERE creator_id = <userId>;

-- 예외 이벤트 확인
SELECT id, title, status, series_id, is_exception, occurrence_date FROM events WHERE series_id = <seriesId>;

-- 예외 날짜 확인
SELECT * FROM event_exceptions WHERE series_id = <seriesId>;

-- 공유 처/실 확인
SELECT eso.*, o.name FROM event_shared_offices eso JOIN offices o ON eso.office_id = o.id WHERE series_id = <seriesId>;
```

### pg-boss 큐 모니터링
```sql
-- 대기 중인 리마인더 작업 확인
SELECT name, state, singletonkey, startafter FROM pgboss.job
WHERE name = 'event-reminder' AND state = 'created' ORDER BY startafter;

-- 특정 이벤트의 대기 작업 확인 (리마인더 + 마감임박)
SELECT * FROM pgboss.job WHERE singletonkey LIKE 'reminder-event-123-%' OR singletonkey LIKE 'duesoon-event-123-%';

-- 특정 시리즈의 대기 작업 확인
SELECT * FROM pgboss.job WHERE name = 'event-reminder' AND state = 'created'
AND data->>'seriesId' = '42';

-- 완료/실패 작업 확인
SELECT name, state, completedon, output FROM pgboss.job
WHERE name = 'event-reminder' AND state IN ('completed', 'failed') ORDER BY completedon DESC LIMIT 20;
```

### SSE 연결 확인
```bash
# 서버 로그에서 SSE 연결 현황 확인
docker-compose logs backend --tail=20 -f | grep SSE

# 클라이언트 브라우저 DevTools → Network 탭 → EventStream 필터
```

### 푸시 알림 디버깅
```sql
-- 푸시 구독 현황
SELECT ps.id, ps.user_id, u.name, ps.endpoint, ps.created_at
FROM push_subscriptions ps JOIN users u ON ps.user_id = u.id;

-- stale 구독 정리 (수동)
DELETE FROM push_subscriptions WHERE updated_at < NOW() - INTERVAL '90 days';
```

### 이메일 알림 디버깅
```bash
# SMTP 연결 테스트 (관리자 로그인 후)
curl -X POST https://teamschedule.mywire.org/api/v1/settings/test-email -H "Authorization: Bearer <token>"
```
```sql
-- 이메일 설정 확인
SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%' OR key = 'email_enabled';

-- 사용자 이메일 설정 확인
SELECT id, name, email, email_notifications_enabled, email_preferences FROM users WHERE id = <userId>;
```

### JWT 토큰 오류
다시 로그인하여 새 토큰 발급. Authorization 헤더 형식: `Bearer <token>`

### Rate Limit 429 에러
`.env`에서 `RATE_LIMIT_MAX_REQUESTS` 값 조정. 현재 설정: 로그인 10/15분, 인증 100/15분, 일정 100/30초, 댓글 30/1분, 푸시 20/1분.

### 사용자 승인 관련
```sql
-- 승인 대기 사용자 확인
SELECT id, name, email, is_active, approved_at FROM users WHERE is_active = false AND approved_at IS NULL;

-- 수동 승인
UPDATE users SET is_active = true, approved_at = NOW() WHERE id = <userId>;
```

## 보안 설정

### Phase 1 보안 강화 (적용됨)
- **JWT Secret 검증**: 프로덕션 시작 시 32자 미만 또는 기본값 감지 → 서버 시작 거부
- **JWT 만료**: 7일 → 24시간으로 단축
- **.env 보호**: `.gitignore`에 `.env`, `backend/.env` 등록, `.env.example` 템플릿 분리
- **bcrypt rounds**: 10 → 12 (상수 `BCRYPT_ROUNDS`)
- **비밀번호 정책**: 영문 + 숫자 + **특수문자** 필수 8자 이상 (백엔드 + 프론트엔드 동기화)
- **에러 정보 노출 방지**: 프로덕션에서 스택트레이스/쿼리 파라미터 로그 제외
- **Body size**: 10MB → 1MB (server.js + nginx client_max_body_size)
- **trust proxy**: Nginx 뒤 실제 클라이언트 IP로 Rate Limit 적용
- **CORS 강화**: methods/headers/maxAge 명시적 설정
- **helmet CSP**: defaultSrc, scriptSrc, styleSrc, imgSrc, connectSrc, frameAncestors 세부 설정
- **DB 포트 차단**: docker-compose에서 `ports` → `expose` (Docker 내부 네트워크만)
- **Nginx 보안 헤더**: HSTS, X-Frame-Options(DENY), X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, server_tokens off, SSL ciphers
- **댓글 검증**: express-validator로 content 필수 + 2000자 제한
- **댓글 Rate Limit**: 1분당 30회
- **ILIKE 이스케이핑**: 사용자/일정 검색 시 `%`, `_`, `\` 와일드카드 이스케이핑
- **푸시 구독 검증**: endpoint URL 검증 + keys 필수 + Rate Limit 20/분
- **SSE 인증**: 쿼리 파라미터 토큰 → Authorization 헤더 변환 + authenticate 미들웨어

### 보안 주의사항
- `.env` 파일은 절대 Git에 커밋하지 않기 (`.env.example` 사용)
- JWT_SECRET은 반드시 `crypto.randomBytes(64)` 이상으로 생성
- 프로덕션 DB는 Docker 외부 네트워크에서 접근 불가 (로컬 개발 시에만 ports 주석 해제)
- `admin@admin.com` / `admin1234` 기본 관리자 비밀번호 반드시 변경
- VAPID 비밀키 노출 금지 (`.env`에만 저장)
- SMTP 비밀번호는 `system_settings`에 저장 (DB 접근 제한 필요)

## 해결된 이슈

1. camelCase/snake_case 불일치 → 양방향 지원
2. 반복 일정 "전체 완료" 시 일정 삭제됨 → DELETE를 UPDATE로 변경, event_series에 status/completed_at 컬럼 추가
3. 시리즈 관계 끊어진 일정에 "undefined 반복" 표시 → recurrenceType null 체크 추가
4. "이번만 완료" 후 모달 미갱신 → series-* ID 이벤트 작업 후 모달 닫기 패턴 적용
5. 반복 일정 수정 시 종료 시간 변경됨 → 타임존 변환 문제 해결 (naiveDateTimeString)
6. 중복 클릭으로 다중 요청 → useActionGuard 훅 도입
7. Rate Limit 비활성화 → 재활성화 (로그인/인증/일정 3단계) + 프론트엔드 입력 검증 추가
8. 캘린더 레인 고정 배치로 단일 일정 +n 과다 → 유연 레인 배치 (멀티데이 우선 → 빈 레인에 단일 일정)
9. 댓글 UI 미구현 → CommentSection 인라인 컴포넌트 구현 (조회/작성/수정/삭제 + 알림 + EventList 뱃지)
10. Rate Limit 에러 시 사용자 피드백 부족 → 모달 내 30초 카운트다운 배너 (상세/생성/수정 모달 공통, 모달 간 상태 공유)
11. 보안 취약점 Phase 1 수정 → JWT 강화/bcrypt 12/비밀번호 특수문자/에러 노출 방지/Body 1MB/DB 포트 차단/Nginx 보안 헤더/CORS·helmet 상세 설정/댓글 검증·Rate Limit/ILIKE 이스케이핑
12. 알림 시스템 cron → pg-boss 큐 전환: 최대 1시간 오차 문제 해결, 정확한 시간에 리마인더 발송, 관리자 설정에서 알림 시간(30분/1시간/3시간) 복수 선택 가능, node-cron 제거
13. 마감임박 기능 구현: 앰버 뱃지 + EVENT_DUE_SOON 알림 + due_soon_threshold 시스템 설정
14. 알림 발송 범위 제어: notification_config 시스템 설정 (타입별 ON/OFF + 수신 범위 scope), notifyByScope() 함수로 통합
15. 푸시 알림 시스템 구현: VAPID 기반 Web Push + Service Worker + push_subscriptions 테이블 + 프로필 페이지 토글
16. SSE 실시간 동기화 구현: 일정/댓글 CRUD 시 전체 클라이언트에 broadcast → 스켈레톤 없이 즉시 UI 갱신, 알림 카운트 실시간 갱신
17. 이메일 알림 구현: nodemailer + SMTP 설정 (3가지 인증 방식) + 사용자별 수신 설정 + HTML 템플릿
18. 일정 검색 기능 구현: 이벤트+시리즈 통합 검색 + 스코프 필터 + 페이지네이션 + 프론트엔드 검색 모달
19. 마감임박/일정지연 알림 기준 변경: 시작 시간 → 종료 시간 기준으로 변경, 알림 메시지도 "종료" 용어로 수정
20. 알림 모달 UX 개선: 읽은 알림 전체 삭제 버튼 추가, 헤더/푸터 고정 (flexShrink: 0)
21. 알림 클릭 시 일정 이동: relatedEventId가 있는 알림 클릭 → 해당 일정 상세 모달 자동 오픈
22. OVERDUE 상태 서버 계산: 클라이언트 10초 폴링 제거 → 서버 API(getEvents/getEventById/searchEvents)에서 isOverdue 판정 후 status='OVERDUE' 반환
23. 모달 닫기 애니메이션: EventModal/EventDetailModal에 `isClosing` state로 슬라이드 다운 애니메이션 적용 (300ms)
24. PC 캘린더 월 이동 슬라이드 애니메이션: 모바일과 동일하게 좌/우 슬라이드 효과 (`animateMonthChange`, `slideStyle` state)
25. 알림 수신자 다중 선택 UI: SystemSettings에서 드롭다운 → 토글 버튼 다중 선택 방식으로 변경, scopes 배열 지원
26. 공유 일정 알림 (EVENT_SHARED): 일정 생성 시 공유된 처/실에 알림 발송, `shared_offices` scope 추가
27. 상위관리자 직급별 분리: `dept_lead_department`(부장), `dept_lead_office`(처장/실장), `dept_lead_division`(본부장) 개별 scope로 분리
28. 로그인/회원가입 페이지 스크롤: `position: fixed`로 body `overflow: hidden`과 독립적으로 스크롤 가능
29. 부서 선택 필수화: 부서가 있는 처 선택 시 부서를 선택해야 직급 드롭다운 활성화 (회원가입/프로필 수정)
30. 일정 공유 직급 옵션 개선: 직할 부서 선택 시에만 실장/처장/지사장 표시, 부서 전체/일반 부서는 부장/차장/직원만
31. 드롭다운 탭 포커스 glow 효과: 모든 CustomSelect 및 일정 공유 드롭다운에 키보드 탭 이동 시 파란색 glow 효과 추가

## 알려진 이슈 및 남은 작업

1. 테스트 코드 작성 (유닛/통합 테스트 미구현)
2. 예외 이벤트에서 "전체 완료" 시 시리즈 미전파 (BUG-003)
3. DEPT_LEAD 스코프별 일정 조회 실제 테스트 필요
4. 보안 Phase 2: JWT 토큰 블랙리스트(로그아웃 무효화), Refresh Token 패턴
5. 보안 Phase 3: 로그인 계정 잠금(N회 실패 시), 비밀번호 이력 관리, 세션 관리 강화
6. Rate limit 카운트다운 페이지 새로고침(F5) 시 리셋됨 → localStorage/sessionStorage 저장 필요
