// backend/src/utils/reminderQueueService.js
// pg-boss 기반 알림 큐 서비스

const { query } = require('../../config/database');
const { notifyByScope } = require('../controllers/notificationController');
const { broadcast } = require('./sseManager');

// pg-boss 인스턴스 (server.js에서 주입)
let boss = null;

// KST 오프셋 (9시간 in milliseconds)
// DB에 저장된 시간은 나이브 datetime이지만 PostgreSQL이 UTC로 해석함
// 실제로는 KST 시간이므로 9시간을 빼서 실제 UTC로 변환해야 함
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const REMINDER_MINUTES = {
  '30min': 30,
  '1hour': 60,
  '3hour': 180,
};

/**
 * pg-boss 인스턴스 설정
 */
function setBoss(bossInstance) {
  boss = bossInstance;
}

/**
 * 시스템 설정에서 reminder_times 조회
 * @returns {string[]} 예: ['30min', '1hour']
 */
async function getReminderTimes() {
  try {
    const result = await query(
      "SELECT value FROM system_settings WHERE key = 'reminder_times'"
    );
    if (result.rows.length === 0) return ['1hour'];
    const value = result.rows[0].value;
    return Array.isArray(value) ? value : ['1hour'];
  } catch (error) {
    console.error('[ReminderQueue] Failed to get reminder_times setting:', error.message);
    return ['1hour'];
  }
}

/**
 * 시스템 설정에서 due_soon_threshold 조회
 * @returns {string[]} 예: ['3hour']
 */
async function getDueSoonTimes() {
  try {
    const result = await query(
      "SELECT value FROM system_settings WHERE key = 'due_soon_threshold'"
    );
    if (result.rows.length === 0) return [];
    const value = result.rows[0].value;
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error('[ReminderQueue] Failed to get due_soon_threshold setting:', error.message);
    return [];
  }
}

/**
 * 시스템 설정에서 EVENT_OVERDUE 알림 활성화 여부 조회
 * @returns {boolean}
 */
async function isOverdueEnabled() {
  try {
    const result = await query(
      "SELECT value FROM system_settings WHERE key = 'notification_config'"
    );
    if (result.rows.length === 0) return false;
    const config = result.rows[0].value;
    return config?.EVENT_OVERDUE?.enabled === true;
  } catch (error) {
    console.error('[ReminderQueue] Failed to get overdue setting:', error.message);
    return false;
  }
}

/**
 * 단일 이벤트에 대한 리마인더 + 마감임박 스케줄링
 * @param {number} eventId - 이벤트 ID
 * @param {string} startAt - 시작 시간 (리마인더용)
 * @param {string} endAt - 종료 시간 (마감임박용)
 * @param {number} creatorId - 작성자 ID
 */
async function scheduleEventReminder(eventId, startAt, endAt, creatorId) {
  if (!boss) return;

  const now = new Date();
  // DB에 저장된 시간은 KST가 UTC로 잘못 해석된 상태이므로, 실제 UTC로 변환
  const storedStartTime = new Date(startAt);
  const eventStart = new Date(storedStartTime.getTime() - KST_OFFSET_MS);

  const storedEndTime = new Date(endAt);
  const eventEnd = new Date(storedEndTime.getTime() - KST_OFFSET_MS);

  // 1) 일정 시작 알림 (EVENT_REMINDER) - 시작 시간 기준
  const reminderTimes = await getReminderTimes();
  for (const timeKey of reminderTimes) {
    const minutes = REMINDER_MINUTES[timeKey];
    if (!minutes) continue;
    // 일정 시작이 이미 지났으면 스킵
    if (eventStart <= now) continue;
    const alertAt = new Date(eventStart.getTime() - minutes * 60 * 1000);
    // 알림 시간이 과거면 즉시(1초 후) 스케줄링, 미래면 해당 시간에 스케줄링
    const scheduleAt = alertAt > now ? alertAt : new Date(now.getTime() + 1000);
    const jobKey = `reminder-event-${eventId}-${timeKey}`;
    try {
      await boss.send('event-reminder', {
        eventId, seriesId: null, occurrenceDate: null, creatorId,
        reminderMinutes: minutes, timeKey, notificationType: 'EVENT_REMINDER',
      }, { startAfter: scheduleAt, singletonKey: jobKey, retryLimit: 2, expireInMinutes: 60 });
      console.log(`[ReminderQueue] Scheduled reminder: event ${eventId}, ${timeKey} before start at ${scheduleAt.toISOString()}`);
    } catch (error) {
      console.error(`[ReminderQueue] Failed to schedule event ${eventId}:`, error.message);
    }
  }

  // 2) 마감임박 알림 (EVENT_DUE_SOON) - 종료 시간 기준
  const dueSoonTimes = await getDueSoonTimes();
  for (const timeKey of dueSoonTimes) {
    const minutes = REMINDER_MINUTES[timeKey];
    if (!minutes) continue;
    // 일정 종료가 이미 지났으면 스킵
    if (eventEnd <= now) continue;
    const alertAt = new Date(eventEnd.getTime() - minutes * 60 * 1000);
    // 알림 시간이 과거면 즉시(1초 후) 스케줄링, 미래면 해당 시간에 스케줄링
    const scheduleAt = alertAt > now ? alertAt : new Date(now.getTime() + 1000);
    const jobKey = `duesoon-event-${eventId}-${timeKey}`;
    try {
      await boss.send('event-reminder', {
        eventId, seriesId: null, occurrenceDate: null, creatorId,
        reminderMinutes: minutes, timeKey, notificationType: 'EVENT_DUE_SOON',
      }, { startAfter: scheduleAt, singletonKey: jobKey, retryLimit: 2, expireInMinutes: 60 });
      console.log(`[ReminderQueue] Scheduled due-soon: event ${eventId}, ${timeKey} before end at ${scheduleAt.toISOString()}`);
    } catch (error) {
      if (!error.message?.includes('singleton')) {
        console.error(`[ReminderQueue] Failed to schedule due-soon event ${eventId}:`, error.message);
      }
    }
  }

  // 3) 일정 지연 알림 (EVENT_OVERDUE) - 일정 종료 시간에 체크
  const overdueEnabled = await isOverdueEnabled();
  if (overdueEnabled) {
    const jobKey = `overdue-event-${eventId}`;
    // 이미 종료 시간이 지났으면 1분 후에 체크, 아니면 종료 시간에 체크
    const overdueCheckAt = eventEnd > now ? eventEnd : new Date(now.getTime() + 60 * 1000);
    try {
      await boss.send('event-reminder', {
        eventId, seriesId: null, occurrenceDate: null, creatorId,
        reminderMinutes: 0, timeKey: 'overdue', notificationType: 'EVENT_OVERDUE',
      }, { startAfter: overdueCheckAt, singletonKey: jobKey, retryLimit: 2, expireInMinutes: 60 });
      console.log(`[ReminderQueue] Scheduled overdue check: event ${eventId} at ${overdueCheckAt.toISOString()}`);
    } catch (error) {
      if (!error.message?.includes('singleton')) {
        console.error(`[ReminderQueue] Failed to schedule overdue event ${eventId}:`, error.message);
      }
    }
  }
}

/**
 * 단일 이벤트의 대기 중인 리마인더 취소
 * 일정 수정 시 기존 알림도 삭제하여 중복 체크에 걸리지 않도록 함
 */
async function cancelEventReminders(eventId) {
  if (!boss) return;

  try {
    // 1. reminder + duesoon + overdue 큐 작업 취소
    await query(`
      DELETE FROM pgboss.job
      WHERE name = 'event-reminder'
      AND state = 'created'
      AND (singletonkey LIKE $1 OR singletonkey LIKE $2 OR singletonkey = $3)
    `, [`reminder-event-${eventId}-%`, `duesoon-event-${eventId}-%`, `overdue-event-${eventId}`]);

    // 2. 최근 4시간 이내의 읽지 않은 리마인더/마감임박/지연 알림 삭제
    // (일정 수정 후 새 알림이 중복 체크에 걸리지 않도록)
    const deleteResult = await query(`
      DELETE FROM notifications
      WHERE related_event_id = $1
      AND type IN ('EVENT_REMINDER', 'EVENT_DUE_SOON', 'EVENT_OVERDUE')
      AND is_read = false
      AND created_at > NOW() - INTERVAL '4 hours'
    `, [eventId]);

    const deletedCount = deleteResult.rowCount || 0;
    console.log(`[ReminderQueue] Cancelled reminders for event ${eventId}, deleted ${deletedCount} pending notifications`);
  } catch (error) {
    console.error(`[ReminderQueue] Failed to cancel event ${eventId}:`, error.message);
  }
}

/**
 * 반복 일정 시리즈의 대기 중인 리마인더 취소
 */
async function cancelSeriesReminders(seriesId) {
  if (!boss) return;

  try {
    // pgboss.job에서 해당 시리즈의 모든 대기 작업 삭제
    await query(`
      DELETE FROM pgboss.job
      WHERE name = 'event-reminder'
      AND state = 'created'
      AND data->>'seriesId' = $1
    `, [seriesId.toString()]);

    console.log(`[ReminderQueue] Cancelled reminders for series ${seriesId}`);
  } catch (error) {
    console.error(`[ReminderQueue] Failed to cancel series ${seriesId}:`, error.message);
  }
}

/**
 * 48시간 이내 반복 일정 occurrence에 대해 리마인더 스케줄링
 */
async function scheduleSeriesReminders() {
  if (!boss) return;

  const reminderTimes = await getReminderTimes();
  const dueSoonTimes = await getDueSoonTimes();
  const overdueEnabled = await isOverdueEnabled();
  const allTimes = [
    ...reminderTimes.map(t => ({ timeKey: t, type: 'EVENT_REMINDER', prefix: 'reminder', minutes: REMINDER_MINUTES[t] || 0 })),
    ...dueSoonTimes.map(t => ({ timeKey: t, type: 'EVENT_DUE_SOON', prefix: 'duesoon', minutes: REMINDER_MINUTES[t] || 0 })),
  ];
  // 지연 알림은 시작 시간에 체크 (minutes = 0)
  if (overdueEnabled) {
    allTimes.push({ timeKey: 'overdue', type: 'EVENT_OVERDUE', prefix: 'overdue', minutes: 0 });
  }
  if (allTimes.length === 0) return;

  const now = new Date();
  const futureLimit = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    // 활성 반복 일정 시리즈 조회
    const seriesResult = await query(`
      SELECT es.*, u.id as user_id
      FROM event_series es
      JOIN users u ON es.creator_id = u.id
      WHERE es.status != 'DONE'
      AND (es.recurrence_end_date IS NULL OR es.recurrence_end_date >= $1)
    `, [now.toISOString().split('T')[0]]);

    let scheduledCount = 0;

    for (const series of seriesResult.rows) {
      // 오늘과 내일(+모레) 체크
      for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        const checkDateStr = checkDate.toISOString().split('T')[0];

        // 첫 발생일 이전은 스킵
        if (series.first_occurrence_date && checkDateStr < series.first_occurrence_date) continue;

        // 예외 날짜 확인
        const exceptionResult = await query(
          'SELECT id FROM event_exceptions WHERE series_id = $1 AND exception_date = $2',
          [series.id, checkDateStr]
        );
        if (exceptionResult.rows.length > 0) continue;

        // 완료된 예외 이벤트 확인
        const completedResult = await query(`
          SELECT id FROM events
          WHERE series_id = $1 AND is_exception = true
          AND DATE(start_at) = $2 AND status = 'DONE'
        `, [series.id, checkDateStr]);
        if (completedResult.rows.length > 0) continue;

        // 시작 시간 계산 (KST 기준으로 저장된 시간을 실제 UTC로 변환)
        const [startHour, startMin] = series.start_time.split(':');
        const eventStartKST = new Date(checkDate);
        eventStartKST.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
        // KST 시간을 실제 UTC로 변환 (9시간 빼기)
        const eventStart = new Date(eventStartKST.getTime() - KST_OFFSET_MS);

        // 이미 지난 이벤트는 스킵
        if (eventStart <= now) continue;
        if (eventStart > futureLimit) continue;

        // 각 알림 시간에 대해 스케줄링 (reminder + due_soon + overdue)
        for (const { timeKey, type, prefix, minutes } of allTimes) {
          // overdue는 minutes=0, 나머지는 REMINDER_MINUTES에서 조회
          const actualMinutes = minutes !== undefined ? minutes : (REMINDER_MINUTES[timeKey] || 0);
          // reminder/duesoon은 알림시간 분값이 필수, overdue는 0분(시작시간)
          if (type !== 'EVENT_OVERDUE' && actualMinutes === 0) continue;

          const alertAt = new Date(eventStart.getTime() - actualMinutes * 60 * 1000);
          if (alertAt <= now) continue;

          const jobKey = `${prefix}-series-${series.id}-${checkDateStr}-${timeKey}`;

          try {
            await boss.send('event-reminder', {
              eventId: null,
              seriesId: series.id,
              occurrenceDate: checkDateStr,
              creatorId: series.creator_id,
              reminderMinutes: actualMinutes,
              timeKey,
              notificationType: type,
            }, {
              startAfter: alertAt,
              singletonKey: jobKey,
              retryLimit: 2,
              expireInMinutes: 60,
            });

            scheduledCount++;
          } catch (error) {
            // singletonKey 충돌은 무시 (이미 스케줄됨)
            if (!error.message?.includes('singleton')) {
              console.error(`[ReminderQueue] Series schedule error:`, error.message);
            }
          }
        }
      }
    }

    console.log(`[ReminderQueue] Series scheduler: ${scheduledCount} reminders scheduled`);
    return { scheduledCount };
  } catch (error) {
    console.error('[ReminderQueue] scheduleSeriesReminders error:', error);
    throw error;
  }
}

/**
 * 기존 단일 이벤트 중 아직 리마인더가 없는 것들 스케줄링
 * (서버 시작 시 1회 실행)
 */
async function scheduleExistingEvents() {
  if (!boss) return;

  const reminderTimes = await getReminderTimes();
  const dueSoonTimes = await getDueSoonTimes();
  const overdueEnabled = await isOverdueEnabled();
  const allMinutes = [
    ...reminderTimes.map(t => REMINDER_MINUTES[t] || 0),
    ...dueSoonTimes.map(t => REMINDER_MINUTES[t] || 0),
  ];

  const now = new Date();
  const maxMinutes = allMinutes.length > 0 ? Math.max(...allMinutes) : 0;
  const futureLimit = new Date(now.getTime() + (maxMinutes + 60) * 60 * 1000);

  // DB에 저장된 시간은 KST가 UTC로 잘못 해석된 상태이므로,
  // 쿼리 시 현재 시간에 KST 오프셋을 더해서 비교해야 함
  const nowForQuery = new Date(now.getTime() + KST_OFFSET_MS);
  const futureLimitForQuery = new Date(futureLimit.getTime() + KST_OFFSET_MS);

  try {
    // 1) 미래 일정에 대한 리마인더/마감임박 스케줄링
    if (allMinutes.length > 0) {
      const result = await query(`
        SELECT id, start_at, end_at, creator_id FROM events
        WHERE status != 'DONE'
        AND start_at > $1
        AND start_at <= $2
        AND series_id IS NULL
      `, [nowForQuery.toISOString(), futureLimitForQuery.toISOString()]);

      for (const event of result.rows) {
        await scheduleEventReminder(event.id, event.start_at, event.end_at, event.creator_id);
      }

      console.log(`[ReminderQueue] Bootstrapped ${result.rows.length} future events`);
    }

    // 2) 이미 시작 시간이 지났지만 PENDING인 일정에 대해 overdue 체크 스케줄링
    if (overdueEnabled) {
      const overdueResult = await query(`
        SELECT id, start_at, end_at, creator_id FROM events
        WHERE status = 'PENDING'
        AND start_at <= $1
        AND series_id IS NULL
      `, [nowForQuery.toISOString()]);

      for (const event of overdueResult.rows) {
        await scheduleEventReminder(event.id, event.start_at, event.end_at, event.creator_id);
      }

      console.log(`[ReminderQueue] Bootstrapped ${overdueResult.rows.length} overdue events`);
    }
  } catch (error) {
    console.error('[ReminderQueue] scheduleExistingEvents error:', error);
  }
}

/**
 * 모든 대기 리마인더를 취소하고 재스케줄링
 * (관리자가 알림 시간 설정 변경 시 호출)
 */
async function rescheduleAllReminders() {
  if (!boss) return;

  try {
    // 모든 대기 중인 event-reminder 작업 삭제
    await query(`
      DELETE FROM pgboss.job
      WHERE name = 'event-reminder'
      AND state = 'created'
    `);

    console.log('[ReminderQueue] Cleared all pending reminders');

    // 기존 단일 이벤트 재스케줄링
    await scheduleExistingEvents();

    // 반복 일정 재스케줄링
    await scheduleSeriesReminders();

    console.log('[ReminderQueue] Rescheduled all reminders');
  } catch (error) {
    console.error('[ReminderQueue] rescheduleAllReminders error:', error);
    throw error;
  }
}

/**
 * 이벤트 리마인더 워커 (pg-boss가 정확한 시간에 호출)
 */
async function processEventReminder(job) {
  const { eventId, seriesId, occurrenceDate, creatorId, reminderMinutes, timeKey, notificationType } = job.data;
  const notiType = notificationType || 'EVENT_REMINDER';

  try {
    let eventTitle = null;
    let eventStartAt = null;
    let targetUserId = creatorId;
    let departmentId = null;
    let officeId = null;
    let divisionId = null;
    let sharedOfficeIds = [];

    if (eventId) {
      // 단일 이벤트
      const result = await query(
        'SELECT id, title, start_at, status, creator_id, department_id, office_id, division_id FROM events WHERE id = $1',
        [eventId]
      );

      if (result.rows.length === 0) return; // 삭제된 이벤트
      const event = result.rows[0];
      if (event.status === 'DONE') return; // 이미 완료

      eventTitle = event.title;
      eventStartAt = event.start_at;
      targetUserId = event.creator_id;
      departmentId = event.department_id;
      officeId = event.office_id;
      divisionId = event.division_id;

      // 공유 처/실 조회
      const sharedResult = await query(
        'SELECT office_id FROM event_shared_offices WHERE event_id = $1',
        [eventId]
      );
      sharedOfficeIds = sharedResult.rows.map(r => r.office_id);
    } else if (seriesId) {
      // 반복 일정
      const result = await query(
        'SELECT id, title, status, start_time, creator_id, department_id, office_id, division_id FROM event_series WHERE id = $1',
        [seriesId]
      );

      if (result.rows.length === 0) return;
      const series = result.rows[0];
      if (series.status === 'DONE') return;

      // 해당 날짜가 예외인지 확인
      const exceptionResult = await query(
        'SELECT id FROM event_exceptions WHERE series_id = $1 AND exception_date = $2',
        [seriesId, occurrenceDate]
      );
      if (exceptionResult.rows.length > 0) return;

      eventTitle = series.title;
      targetUserId = series.creator_id;
      departmentId = series.department_id;
      officeId = series.office_id;
      divisionId = series.division_id;

      // 공유 처/실 조회
      const sharedResult = await query(
        'SELECT office_id FROM event_shared_offices WHERE series_id = $1',
        [seriesId]
      );
      sharedOfficeIds = sharedResult.rows.map(r => r.office_id);
    }

    if (!eventTitle) return;

    // 중복 알림 확인
    const duplicateCheck = await query(`
      SELECT id FROM notifications
      WHERE user_id = $1
      AND type = $6
      AND created_at > NOW() - INTERVAL '4 hours'
      AND (
        ($2::integer IS NOT NULL AND related_event_id = $2)
        OR ($3::integer IS NOT NULL AND metadata->>'seriesId' = $3::text AND metadata->>'occurrenceDate' = $4)
      )
      AND metadata->>'timeKey' = $5
    `, [targetUserId, eventId, seriesId, occurrenceDate, timeKey, notiType]);

    if (duplicateCheck.rows.length > 0) return;

    // 시간 메시지 생성
    let timeMessage;
    if (reminderMinutes >= 60) {
      timeMessage = `${Math.round(reminderMinutes / 60)}시간 후`;
    } else if (reminderMinutes > 0) {
      timeMessage = `${reminderMinutes}분 후`;
    } else {
      timeMessage = '지금';
    }

    // 알림 생성 (타입에 따라 제목/메시지 분기)
    const metadata = { timeKey };
    if (seriesId) {
      metadata.seriesId = seriesId;
      metadata.occurrenceDate = occurrenceDate;
      metadata.compositeId = `series-${seriesId}-${new Date(occurrenceDate).getTime()}`;
    }

    // 작성자용 메시지
    let title, message;
    if (notiType === 'EVENT_OVERDUE') {
      title = '일정 지연';
      message = `"${eventTitle}" 일정의 종료시간이 지났으나 완료처리 되지 않았습니다.`;
    } else if (notiType === 'EVENT_DUE_SOON') {
      title = '마감임박';
      message = `"${eventTitle}" 일정이 ${timeMessage}에 종료됩니다.`;
    } else {
      title = '일정 알림';
      message = `"${eventTitle}" 일정이 ${timeMessage}에 시작됩니다.`;
    }

    // 1. 작성자에게 알림 (일반 메시지)
    await notifyByScope(notiType, title, message, {
      actorId: null,
      creatorId: targetUserId,
      departmentId,
      officeId,
      divisionId,
      sharedOfficeIds: [], // 작성자만
      relatedEventId: eventId,
      metadata,
    });

    // 2. 공유받은 사용자에게 알림 ([공유] 태그 추가)
    if (sharedOfficeIds.length > 0) {
      let sharedTitle, sharedMessage;
      if (notiType === 'EVENT_OVERDUE') {
        sharedTitle = '[공유] 일정 지연';
        sharedMessage = `[공유] "${eventTitle}" 일정의 종료시간이 지났으나 완료처리 되지 않았습니다.`;
      } else if (notiType === 'EVENT_DUE_SOON') {
        sharedTitle = '[공유] 마감임박';
        sharedMessage = `[공유] "${eventTitle}" 일정이 ${timeMessage}에 종료됩니다.`;
      } else {
        sharedTitle = '[공유] 일정 알림';
        sharedMessage = `[공유] "${eventTitle}" 일정이 ${timeMessage}에 시작됩니다.`;
      }

      await notifyByScope(notiType, sharedTitle, sharedMessage, {
        actorId: targetUserId, // 작성자 제외 (중복 방지)
        creatorId: null, // creator scope 사용 안 함
        departmentId: null,
        officeId: null,
        divisionId: null,
        sharedOfficeIds,
        relatedEventId: eventId,
        metadata: { ...metadata, isShared: true },
      });
    }

    // 알림 발송 시 SSE broadcast로 클라이언트 즉시 갱신
    broadcast('event_changed', {
      action: notiType === 'EVENT_REMINDER' ? 'reminder_sent' : 'status_changed',
      eventId: eventId || null,
      seriesId: seriesId || null,
      occurrenceDate: occurrenceDate || null,
      statusType: notiType,
    });

    console.log(`[ReminderQueue] Notification sent: "${eventTitle}" (${timeKey})`);
  } catch (error) {
    console.error('[ReminderQueue] processEventReminder error:', error);
    throw error; // pg-boss가 재시도하도록
  }
}

module.exports = {
  setBoss,
  scheduleEventReminder,
  cancelEventReminders,
  cancelSeriesReminders,
  scheduleSeriesReminders,
  scheduleExistingEvents,
  rescheduleAllReminders,
  processEventReminder,
};
