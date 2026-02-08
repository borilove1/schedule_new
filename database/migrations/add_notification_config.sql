-- 알림 타입별 활성화 및 수신 범위 설정
-- 각 타입: { enabled: boolean, scope: string }
-- scope 옵션: creator, department, dept_leads, office, admins, target

INSERT INTO system_settings (key, value, description)
VALUES ('notification_config', '{
  "EVENT_REMINDER":   { "enabled": true,  "scope": "creator" },
  "EVENT_UPDATED":    { "enabled": false, "scope": "creator" },
  "EVENT_COMPLETED":  { "enabled": true,  "scope": "dept_leads" },
  "EVENT_DELETED":    { "enabled": false, "scope": "creator" },
  "EVENT_COMMENTED":  { "enabled": true,  "scope": "creator" },
  "USER_REGISTERED":  { "enabled": true,  "scope": "admins" },
  "ACCOUNT_APPROVED": { "enabled": true,  "scope": "target" }
}'::jsonb, '알림 타입별 활성화 및 수신 범위 설정')
ON CONFLICT (key) DO NOTHING;
