-- ========================================
-- 업무일정 관리 시스템 - PostgreSQL 스키마
-- ========================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- ENUM 타입 정의
-- ========================================

-- 사용자 권한
CREATE TYPE user_role AS ENUM ('USER', 'DEPT_LEAD', 'ADMIN');

-- 부서장 조회 범위
CREATE TYPE admin_scope AS ENUM ('DEPARTMENT', 'OFFICE', 'DIVISION');

-- 일정 상태
CREATE TYPE event_status AS ENUM ('PENDING', 'DONE');

-- 반복 일정 타입
CREATE TYPE recurrence_type AS ENUM ('day', 'week', 'month', 'year');

-- 알림 시간
CREATE TYPE alert_time AS ENUM ('none', '30min', '1hour', '3hour', '1day');

-- ========================================
-- 1. 조직 구조 테이블
-- ========================================

-- 본부
CREATE TABLE divisions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 처/실
CREATE TABLE offices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, division_id)
);

-- 부서
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, office_id)
);

-- 조직 구조 인덱스
CREATE INDEX idx_offices_division ON offices(division_id);
CREATE INDEX idx_departments_office ON departments(office_id);

-- ========================================
-- 2. 사용자 테이블
-- ========================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(50) NOT NULL, -- 사원, 대리, 과장, 차장, 부장, 실장, 처장, 본부장, 관리자
    
    -- 조직 정보
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL,
    division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
    
    -- 권한 정보
    role user_role NOT NULL DEFAULT 'USER',
    scope admin_scope, -- 부서장/관리자의 조회 범위
    
    -- 메타 정보
    is_active BOOLEAN DEFAULT false,
    approved_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 이메일 알림 설정
    email_notifications_enabled BOOLEAN DEFAULT false,
    email_preferences JSONB DEFAULT '{
        "EVENT_REMINDER": true,
        "EVENT_UPDATED": true,
        "EVENT_COMPLETED": true,
        "EVENT_DELETED": true,
        "USER_REGISTERED": true,
        "ACCOUNT_APPROVED": true
    }'::jsonb,
    
    -- 제약 조건
    CONSTRAINT check_admin_scope CHECK (
        (role = 'DEPT_LEAD' AND scope IS NOT NULL) OR
        (role = 'ADMIN') OR
        (role = 'USER' AND scope IS NULL)
    )
);

-- 사용자 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_office ON users(office_id);
CREATE INDEX idx_users_division ON users(division_id);
CREATE INDEX idx_users_role ON users(role);

-- ========================================
-- 3. 일정 테이블
-- ========================================

-- 반복 일정 시리즈 (반복 일정의 기본 정보)
CREATE TABLE event_series (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    
    -- 반복 설정
    recurrence_type recurrence_type NOT NULL,
    recurrence_interval INTEGER NOT NULL DEFAULT 1, -- 간격 (예: 2주마다 = 2)
    recurrence_end_date DATE, -- 반복 종료일 (NULL이면 무한 반복)
    
    -- 시간 설정 (기준 시간)
    start_time TIME NOT NULL, -- 시작 시간
    end_time TIME NOT NULL, -- 종료 시간
    first_occurrence_date DATE NOT NULL, -- 첫 발생일
    
    -- 상태
    status event_status NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMP WITH TIME ZONE,

    -- 알림
    alert alert_time DEFAULT 'none',

    -- 다일(multi-day) 일정 지원
    duration_days INTEGER DEFAULT 0,

    -- 작성자 및 조직 정보
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL,
    division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 일정 (단일 일정 + 반복 일정의 개별 발생)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    
    -- 시간 정보
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- 상태
    status event_status NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- 알림
    alert alert_time DEFAULT 'none',
    
    -- 반복 일정 관련
    series_id INTEGER REFERENCES event_series(id) ON DELETE CASCADE, -- NULL이면 단일 일정
    occurrence_date DATE, -- 반복 일정의 발생일 (반복 일정인 경우)
    is_exception BOOLEAN DEFAULT false, -- 반복 일정의 예외 (수정된 개별 발생)
    original_series_id INTEGER REFERENCES event_series(id) ON DELETE CASCADE, -- 예외인 경우 원본 시리즈
    
    -- 작성자 및 조직 정보
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL,
    division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 제약 조건
    CONSTRAINT check_time_range CHECK (end_at > start_at),
    CONSTRAINT check_series_occurrence CHECK (
        (series_id IS NOT NULL AND occurrence_date IS NOT NULL) OR
        (series_id IS NULL AND occurrence_date IS NULL)
    )
);

-- 반복 일정 예외 (건너뛴 발생)
CREATE TABLE event_exceptions (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL, -- 건너뛸 날짜
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(series_id, exception_date)
);

-- 일정 인덱스
CREATE INDEX idx_events_start_at ON events(start_at);
CREATE INDEX idx_events_end_at ON events(end_at);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_creator ON events(creator_id);
CREATE INDEX idx_events_department ON events(department_id);
CREATE INDEX idx_events_office ON events(office_id);
CREATE INDEX idx_events_division ON events(division_id);
CREATE INDEX idx_events_series ON events(series_id);
CREATE INDEX idx_event_series_creator ON event_series(creator_id);
CREATE INDEX idx_event_exceptions_series ON event_exceptions(series_id);

-- 일정 공유 처/실 테이블
CREATE TABLE event_shared_offices (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    series_id INTEGER REFERENCES event_series(id) ON DELETE CASCADE,
    office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_event_or_series CHECK (
        (event_id IS NOT NULL AND series_id IS NULL) OR
        (event_id IS NULL AND series_id IS NOT NULL)
    ),
    UNIQUE(event_id, office_id),
    UNIQUE(series_id, office_id)
);

CREATE INDEX idx_eso_event_id ON event_shared_offices(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_eso_series_id ON event_shared_offices(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX idx_eso_office_id ON event_shared_offices(office_id);

-- ========================================
-- 4. 알림 테이블
-- ========================================

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    related_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    related_series_id INTEGER REFERENCES event_series(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ========================================
-- 5. 댓글 테이블
-- ========================================

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,

    -- 관계
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE, -- 단일 일정 댓글
    series_id INTEGER REFERENCES event_series(id) ON DELETE CASCADE, -- 반복 일정 시리즈 댓글
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 반복 일정 회차별 날짜 (series_id와 함께 사용)
    occurrence_date DATE,

    -- 수정 여부
    is_edited BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 제약 조건: 단일 일정 또는 시리즈 중 하나에만 댓글
    CONSTRAINT check_comment_target CHECK (
        (event_id IS NOT NULL AND series_id IS NULL) OR
        (event_id IS NULL AND series_id IS NOT NULL)
    )
);

-- 댓글 인덱스
CREATE INDEX idx_comments_event ON comments(event_id);
CREATE INDEX idx_comments_series ON comments(series_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_created ON comments(created_at);

-- ========================================
-- 6. 시스템 설정 테이블
-- ========================================

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 기본 설정 데이터 삽입
INSERT INTO system_settings (key, value, description) VALUES
    ('due_soon_threshold', '["3hour"]', '마감임박 기준 시간 (복수 선택 가능: 30min, 1hour, 3hour)'),
    ('reminder_times', '["1hour"]', '일정 시작 전 알림 시간 (복수 선택 가능: 30min, 1hour, 3hour)'),
    ('email_enabled', 'false', '이메일 알림 활성화 여부'),
    ('smtp_auth_type', '"LOGIN"', 'SMTP 인증 방식 (LOGIN, NONE, API_KEY)'),
    ('smtp_host', '""', 'SMTP 서버 호스트'),
    ('smtp_port', '587', 'SMTP 서버 포트'),
    ('smtp_secure', 'false', 'SSL/TLS 사용 여부 (포트 465인 경우 true)'),
    ('smtp_user', '""', 'SMTP 사용자명'),
    ('smtp_password', '""', 'SMTP 비밀번호'),
    ('smtp_api_key', '""', 'SMTP API 키 (SendGrid/Mailgun)'),
    ('smtp_from_email', '""', '발신 이메일 주소'),
    ('smtp_from_name', '"업무일정 관리 시스템"', '발신자 이름'),
    ('notification_config', '{"EVENT_REMINDER":{"enabled":true,"scope":"creator"},"EVENT_DUE_SOON":{"enabled":true,"scope":"creator"},"EVENT_OVERDUE":{"enabled":true,"scope":"creator"},"EVENT_UPDATED":{"enabled":false,"scope":"creator"},"EVENT_COMPLETED":{"enabled":true,"scope":"dept_leads"},"EVENT_DELETED":{"enabled":false,"scope":"creator"},"EVENT_COMMENTED":{"enabled":true,"scope":"creator"},"EVENT_SHARED":{"enabled":true,"scopes":["shared_offices"]},"USER_REGISTERED":{"enabled":true,"scope":"admins"},"ACCOUNT_APPROVED":{"enabled":true,"scope":"target"}}', '알림 타입별 활성화 및 수신 범위 설정');

-- ========================================
-- 7. 세션 테이블 (JWT 대신 사용 가능)
-- ========================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 만료된 세션 자동 삭제를 위한 인덱스
    CONSTRAINT check_expires_future CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ========================================
-- 8. 업데이트 트리거 함수
-- ========================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER update_divisions_updated_at BEFORE UPDATE ON divisions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON offices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_series_updated_at BEFORE UPDATE ON event_series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 8-1. 푸시 구독 테이블
-- ========================================

CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(endpoint)
);

CREATE INDEX idx_push_subs_user_id ON push_subscriptions(user_id);

CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 9. 샘플 데이터 (개발/테스트용)
-- ========================================

-- 본부
INSERT INTO divisions (name) VALUES ('부산울산본부');

-- 처/실/지사
INSERT INTO offices (name, division_id) VALUES
    ('기획관리실', 1),
    ('전력사업처', 1),
    ('전력관리처', 1),
    ('안전재난부', 1),
    ('울산지사', 1),
    ('김해지사', 1),
    ('동래지사', 1),
    ('남부산지사', 1),
    ('양산지사', 1),
    ('중부산지사', 1),
    ('북부산지사', 1),
    ('동울산지사', 1),
    ('서부산지사', 1),
    ('기장지사', 1),
    ('서울산지사', 1),
    ('영도지사', 1),
    ('울산전력지사', 1),
    ('북부산전력지사', 1),
    ('동부산전력지사', 1),
    ('서부산전력지사', 1);

-- 부서 (기획관리실 산하)
INSERT INTO departments (name, office_id) VALUES
    ('전략경영부', 1),
    ('경영지원부', 1),
    ('재무자재부', 1),
    ('AI혁신부', 1);

-- 부서 (전력사업처 산하)
INSERT INTO departments (name, office_id) VALUES
    ('고객지원부', 2),
    ('전력공급부', 2),
    ('요금관리부', 2),
    ('배전운영부', 2),
    ('에너지효율부', 2),
    ('배전건설부', 2),
    ('ICT운영부', 2);

-- 부서 (전력관리처 산하)
INSERT INTO departments (name, office_id) VALUES
    ('송변전안전팀', 3),
    ('지역협력부', 3),
    ('계통운영부', 3),
    ('송전운영부', 3),
    ('변전운영부', 3),
    ('설비보강부', 3),
    ('전자제어부', 3),
    ('토건운영부', 3);

-- 안전재난부, 각 지사는 하위 부서 없음

-- 기본 관리자 계정 (비밀번호: admin1234)
INSERT INTO users (email, password_hash, name, position, department_id, office_id, division_id, role, is_active, approved_at)
VALUES ('admin@admin.com', '$2b$10$KhDtW2rngfY.kTP84M6JoOyP2Pap.HHPIpfALbXjMei4wOrYftjC.', '관리자', '관리자', 1, 1, 1, 'ADMIN', true, NOW());

-- ========================================
-- 10. 유용한 뷰 (View)
-- ========================================

-- 사용자 전체 정보 뷰 (조직 정보 포함)
CREATE VIEW v_users_with_org AS
SELECT
    u.id,
    u.email,
    u.name,
    u.position,
    u.role,
    u.scope,
    d.name AS department_name,
    o.name AS office_name,
    div.name AS division_name,
    u.is_active,
    u.approved_at,
    u.last_login_at,
    u.created_at
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN offices o ON u.office_id = o.id
LEFT JOIN divisions div ON u.division_id = div.id;

-- 일정 전체 정보 뷰 (작성자 및 조직 정보 포함)
CREATE VIEW v_events_with_details AS
SELECT 
    e.id,
    e.title,
    e.content,
    e.start_at,
    e.end_at,
    e.status,
    e.completed_at,
    e.alert,
    e.series_id,
    e.is_exception,
    u.name AS creator_name,
    u.id AS creator_id,
    d.name AS department_name,
    o.name AS office_name,
    div.name AS division_name,
    e.created_at,
    e.updated_at
FROM events e
JOIN users u ON e.creator_id = u.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN offices o ON e.office_id = o.id
LEFT JOIN divisions div ON e.division_id = div.id;

-- 댓글 전체 정보 뷰
CREATE VIEW v_comments_with_details AS
SELECT
    c.id,
    c.content,
    c.event_id,
    c.series_id,
    c.occurrence_date,
    u.name AS author_name,
    u.id AS author_id,
    c.is_edited,
    c.created_at,
    c.updated_at
FROM comments c
JOIN users u ON c.author_id = u.id;

-- ========================================
-- 11. 권한 체크 함수 (헬퍼)
-- ========================================

-- 사용자가 일정을 볼 수 있는지 확인하는 함수
CREATE OR REPLACE FUNCTION can_view_event(
    p_user_id INTEGER,
    p_event_division_id INTEGER,
    p_event_office_id INTEGER,
    p_event_department_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_role user_role;
    v_scope admin_scope;
    v_user_division_id INTEGER;
    v_user_office_id INTEGER;
    v_user_department_id INTEGER;
BEGIN
    SELECT role, scope, division_id, office_id, department_id
    INTO v_role, v_scope, v_user_division_id, v_user_office_id, v_user_department_id
    FROM users WHERE id = p_user_id;
    
    -- ADMIN은 모든 일정 조회 가능
    IF v_role = 'ADMIN' THEN
        RETURN TRUE;
    END IF;
    
    -- DEPT_LEAD는 scope에 따라 조회
    IF v_role = 'DEPT_LEAD' THEN
        IF v_scope = 'DIVISION' THEN
            RETURN p_event_division_id = v_user_division_id;
        ELSIF v_scope = 'OFFICE' THEN
            RETURN p_event_office_id = v_user_office_id AND p_event_division_id = v_user_division_id;
        ELSIF v_scope = 'DEPARTMENT' THEN
            RETURN p_event_department_id = v_user_department_id;
        END IF;
    END IF;
    
    -- USER는 같은 부서만 조회
    RETURN p_event_department_id = v_user_department_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 완료!
-- ========================================

-- 스키마 정보 확인 쿼리
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
