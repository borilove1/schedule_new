// backend/src/utils/reminderQueueService.js
// pg-boss 기반 알림 큐 서비스

const { query } = require('../../config/database');
const { notifyByScope } = require('../controllers/notificationController');

// pg-boss 인스턴스 (server.js에서 주입)
let boss = null;

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
 * 단일 이벤트에 대한 리마인더 스케줄링
 */
async function scheduleEventReminder(eventId, startAt, creatorId) {
  if (!boss) return;

  const reminderTimes = await getReminderTimes();
  if (reminderTimes.length === 0) return;

  const now = new Date();
  const eventStart = new Date(startAt);

  for (const timeKey of reminderTimes) {
    const minutes = REMINDER_MINUTES[timeKey];
    if (!minutes) continue;

    const alertAt = new Date(eventStart.getTime() - minutes * 60 * 1000);

    // 이미 지난 알림은 스케줄링하지 않음
    if (alertAt <= now) continue;

    const jobKey = `reminder-event-${eventId}-${timeKey}`;

    try {
      await boss.send('event-reminder', {
        eventId,
        seriesId: null,
        occurrenceDate: null,
        creatorId,
        reminderMinutes: minutes,
        timeKey,
      }, {
        startAfter: alertAt,
        singletonKey: jobKey,
        retryLimit: 2,
        expireInMinutes: 60,
      });

      console.log(`[ReminderQueue] Scheduled: event ${eventId}, ${timeKey} before (at ${alertAt.toISOString()})`);
    } catch (error) {
      console.error(`[ReminderQueue] Failed to schedule event ${eventId}:`, error.message);
    }
  }
}

/**
 * 단일 이벤트의 대기 중인 리마인더 취소
 */
async function cancelEventReminders(eventId) {
  if (!boss) return;

  try {
    // pg-boss v9 cancel()은 jobId만 받으므로 직접 SQL로 삭제
    await query(`
      DELETE FROM pgboss.job
      WHERE name = 'event-reminder'
      AND state = 'created'
      AND singletonkey LIKE $1
    `, [`reminder-event-${eventId}-%`]);

    console.log(`[ReminderQueue] Cancelled reminders for event ${eventId}`);
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
  if (reminderTimes.length === 0) return;

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

        // 시작 시간 계산
        const [startHour, startMin] = series.start_time.split(':');
        const eventStart = new Date(checkDate);
        eventStart.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

        // 이미 지난 이벤트는 스킵
        if (eventStart <= now) continue;
        if (eventStart > futureLimit) continue;

        // 각 알림 시간에 대해 스케줄링
        for (const timeKey of reminderTimes) {
          const minutes = REMINDER_MINUTES[timeKey];
          if (!minutes) continue;

          const alertAt = new Date(eventStart.getTime() - minutes * 60 * 1000);
          if (alertAt <= now) continue;

          const jobKey = `reminder-series-${series.id}-${checkDateStr}-${timeKey}`;

          try {
            await boss.send('event-reminder', {
              eventId: null,
              seriesId: series.id,
              occurrenceDate: checkDateStr,
              creatorId: series.creator_id,
              reminderMinutes: minutes,
              timeKey,
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
  if (reminderTimes.length === 0) return;

  const now = new Date();
  const maxMinutes = Math.max(...reminderTimes.map(t => REMINDER_MINUTES[t] || 0));
  const futureLimit = new Date(now.getTime() + (maxMinutes + 60) * 60 * 1000);

  try {
    const result = await query(`
      SELECT id, start_at, creator_id FROM events
      WHERE status != 'DONE'
      AND start_at > $1
      AND start_at <= $2
      AND series_id IS NULL
    `, [now.toISOString(), futureLimit.toISOString()]);

    for (const event of result.rows) {
      await scheduleEventReminder(event.id, event.start_at, event.creator_id);
    }

    console.log(`[ReminderQueue] Bootstrapped ${result.rows.length} existing events`);
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
  const { eventId, seriesId, occurrenceDate, creatorId, reminderMinutes, timeKey } = job.data;

  try {
    let eventTitle = null;
    let eventStartAt = null;
    let targetUserId = creatorId;

    if (eventId) {
      // 단일 이벤트
      const result = await query(
        'SELECT id, title, start_at, status, creator_id FROM events WHERE id = $1',
        [eventId]
      );

      if (result.rows.length === 0) return; // 삭제된 이벤트
      const event = result.rows[0];
      if (event.status === 'DONE') return; // 이미 완료

      eventTitle = event.title;
      eventStartAt = event.start_at;
      targetUserId = event.creator_id;
    } else if (seriesId) {
      // 반복 일정
      const result = await query(
        'SELECT id, title, status, start_time, creator_id FROM event_series WHERE id = $1',
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
    }

    if (!eventTitle) return;

    // 중복 알림 확인
    const duplicateCheck = await query(`
      SELECT id FROM notifications
      WHERE user_id = $1
      AND type = 'EVENT_REMINDER'
      AND created_at > NOW() - INTERVAL '4 hours'
      AND (
        ($2::integer IS NOT NULL AND related_event_id = $2)
        OR ($3::integer IS NOT NULL AND metadata->>'seriesId' = $3::text AND metadata->>'occurrenceDate' = $4)
      )
      AND metadata->>'timeKey' = $5
    `, [targetUserId, eventId, seriesId, occurrenceDate, timeKey]);

    if (duplicateCheck.rows.length > 0) return;

    // 시간 메시지 생성
    let timeMessage;
    if (reminderMinutes >= 60) {
      timeMessage = `${Math.round(reminderMinutes / 60)}시간 후`;
    } else {
      timeMessage = `${reminderMinutes}분 후`;
    }

    // 알림 생성
    const metadata = { timeKey };
    if (seriesId) {
      metadata.seriesId = seriesId;
      metadata.occurrenceDate = occurrenceDate;
      metadata.compositeId = `series-${seriesId}-${new Date(occurrenceDate).getTime()}`;
    }

    await notifyByScope('EVENT_REMINDER', '일정 알림', `"${eventTitle}" 일정이 ${timeMessage}에 시작됩니다.`, {
      actorId: null,
      creatorId: targetUserId,
      relatedEventId: eventId,
      metadata,
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
