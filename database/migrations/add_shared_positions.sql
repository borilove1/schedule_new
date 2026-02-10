-- 공유 일정에 부서/직급 필터 추가
-- event_shared_offices 테이블에 department_id, positions 컬럼 추가

-- 1. 컬럼 추가
ALTER TABLE event_shared_offices
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE event_shared_offices
ADD COLUMN IF NOT EXISTS positions JSONB DEFAULT NULL;

-- 2. 기존 유니크 제약조건 삭제
ALTER TABLE event_shared_offices DROP CONSTRAINT IF EXISTS event_shared_offices_event_id_office_id_key;
ALTER TABLE event_shared_offices DROP CONSTRAINT IF EXISTS event_shared_offices_series_id_office_id_key;

-- 3. 새 유니크 인덱스 추가 (department_id NULL 여부에 따라 분리)
DROP INDEX IF EXISTS idx_eso_event_office_dept;
DROP INDEX IF EXISTS idx_eso_event_office_nodept;
DROP INDEX IF EXISTS idx_eso_series_office_dept;
DROP INDEX IF EXISTS idx_eso_series_office_nodept;

CREATE UNIQUE INDEX idx_eso_event_office_dept ON event_shared_offices(event_id, office_id, department_id)
    WHERE event_id IS NOT NULL AND department_id IS NOT NULL;
CREATE UNIQUE INDEX idx_eso_event_office_nodept ON event_shared_offices(event_id, office_id)
    WHERE event_id IS NOT NULL AND department_id IS NULL;
CREATE UNIQUE INDEX idx_eso_series_office_dept ON event_shared_offices(series_id, office_id, department_id)
    WHERE series_id IS NOT NULL AND department_id IS NOT NULL;
CREATE UNIQUE INDEX idx_eso_series_office_nodept ON event_shared_offices(series_id, office_id)
    WHERE series_id IS NOT NULL AND department_id IS NULL;

-- 사용 예시:
-- { office_id: 1, department_id: NULL, positions: NULL } → 기획관리실 전체
-- { office_id: 1, department_id: 5, positions: NULL } → 전략경영부 전체
-- { office_id: 1, department_id: 5, positions: ["부장", "차장"] } → 전략경영부 부장/차장만
-- { office_id: 1, department_id: NULL, positions: ["실장"] } → 기획관리실장만

COMMENT ON COLUMN event_shared_offices.department_id IS '공유 대상 부서 (NULL이면 처/실 전체)';
COMMENT ON COLUMN event_shared_offices.positions IS '공유 대상 직급 배열 (NULL이면 전체)';
