-- 1. 시스템 설정 확인 (reminder_times, due_soon_threshold)
SELECT key, value FROM system_settings
WHERE key IN ('reminder_times', 'due_soon_threshold', 'notification_config');

-- 2. pg-boss 대기 중인 작업 확인
SELECT name, state, singletonkey, data, startafter, createdon
FROM pgboss.job
WHERE name = 'event-reminder' AND state = 'created'
ORDER BY startafter;

-- 3. 최근 완료/실패 작업 확인
SELECT name, state, singletonkey, completedon, output
FROM pgboss.job
WHERE name = 'event-reminder' AND state IN ('completed', 'failed')
ORDER BY completedon DESC LIMIT 10;

-- 4. 최근 알림 확인
SELECT id, type, title, message, created_at
FROM notifications
WHERE type IN ('EVENT_REMINDER', 'EVENT_DUE_SOON')
ORDER BY created_at DESC LIMIT 10;

-- 5. notification_config에서 알림 타입 활성화 여부 확인
SELECT value->'EVENT_REMINDER' as reminder_enabled,
       value->'EVENT_DUE_SOON' as duesoon_enabled
FROM system_settings WHERE key = 'notification_config';
