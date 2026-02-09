-- 일정 지연 알림(EVENT_OVERDUE) 추가 마이그레이션
-- 실행: docker-compose exec database psql -U scheduleuser -d schedule_management -f /path/to/add_event_overdue.sql

-- notification_config에 EVENT_OVERDUE 타입 추가
UPDATE system_settings
SET value = value || '{"EVENT_OVERDUE": {"enabled": true, "scope": "creator"}}'::jsonb
WHERE key = 'notification_config'
AND NOT (value ? 'EVENT_OVERDUE');

-- 확인
SELECT key, value FROM system_settings WHERE key = 'notification_config';
