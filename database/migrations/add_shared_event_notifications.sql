-- 공유 일정 알림 설정 마이그레이션
-- 공유받은 사용자에게 어떤 알림 타입을 발송할지 설정

INSERT INTO system_settings (key, value, description)
VALUES ('shared_event_notifications', '{
  "EVENT_REMINDER": true,
  "EVENT_DUE_SOON": false,
  "EVENT_OVERDUE": false
}', '공유 일정 알림 설정 (시작 전/마감임박/일정 지연)')
ON CONFLICT (key) DO NOTHING;
