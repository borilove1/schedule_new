const webpush = require('web-push');
const { query } = require('../../config/database');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@admin.com';

let pushEnabled = false;

function initPush() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID 키가 설정되지 않았습니다. 푸시 알림이 비활성화됩니다.');
    return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  pushEnabled = true;
  console.log('[Push] Web Push 초기화 완료');
}

function isPushEnabled() {
  return pushEnabled;
}

function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * 사용자의 모든 구독에 푸시 알림 발송
 * 410/404 응답 시 stale 구독 자동 정리
 */
async function sendPushToUser(userId, payload) {
  if (!pushEnabled) {
    console.log(`[Push] 비활성화 상태 - userId=${userId} 발송 스킵`);
    return;
  }

  try {
    const result = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log(`[Push] 구독 없음 - userId=${userId}`);
      return;
    }

    console.log(`[Push] 발송 시도 - userId=${userId}, 구독=${result.rows.length}개, title="${payload.title}"`);

    const payloadStr = JSON.stringify(payload);
    const staleIds = [];

    await Promise.allSettled(
      result.rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr,
            { TTL: 86400 }
          );
          console.log(`[Push] 발송 성공 - userId=${userId}, subId=${sub.id}`);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleIds.push(sub.id);
          } else {
            console.error(`[Push] 발송 실패 (subscription ${sub.id}):`, err.statusCode || err.message);
          }
        }
      })
    );

    if (staleIds.length > 0) {
      await query('DELETE FROM push_subscriptions WHERE id = ANY($1)', [staleIds]);
      console.log(`[Push] 만료된 구독 ${staleIds.length}개 정리 (user ${userId})`);
    }
  } catch (error) {
    console.error(`[Push] sendPushToUser 오류 (user ${userId}):`, error.message);
  }
}

module.exports = { initPush, isPushEnabled, getVapidPublicKey, sendPushToUser };
