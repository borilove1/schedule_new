-- 조직 순서 정렬을 위한 sort_order 컬럼 추가
-- divisions, offices, departments 테이블에 각각 추가

-- 1. 본부(divisions) 순서
ALTER TABLE divisions
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. 처/실(offices) 순서
ALTER TABLE offices
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. 부서(departments) 순서
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 4. 기존 데이터에 순서 부여 (id 순서대로)
UPDATE divisions SET sort_order = id WHERE sort_order = 0;
UPDATE offices SET sort_order = id WHERE sort_order = 0;
UPDATE departments SET sort_order = id WHERE sort_order = 0;

-- 5. 인덱스 추가 (정렬 성능 향상)
CREATE INDEX IF NOT EXISTS idx_divisions_sort_order ON divisions(sort_order);
CREATE INDEX IF NOT EXISTS idx_offices_sort_order ON offices(division_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_departments_sort_order ON departments(office_id, sort_order);

COMMENT ON COLUMN divisions.sort_order IS '본부 표시 순서';
COMMENT ON COLUMN offices.sort_order IS '처/실 표시 순서 (같은 본부 내)';
COMMENT ON COLUMN departments.sort_order IS '부서 표시 순서 (같은 처/실 내)';
