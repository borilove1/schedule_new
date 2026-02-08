-- due_soon_threshold: 숫자(시간) → 배열 형식으로 변환 (reminder_times와 동일 포맷)
-- 기존 값 '3' → '["3hour"]'
UPDATE system_settings
SET value = '["3hour"]'::jsonb
WHERE key = 'due_soon_threshold';

-- notification_config에 EVENT_DUE_SOON 타입 추가
UPDATE system_settings
SET value = value || '{"EVENT_DUE_SOON": {"enabled": true, "scope": "creator"}}'::jsonb
WHERE key = 'notification_config'
AND NOT (value ? 'EVENT_DUE_SOON');
