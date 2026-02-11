// backend/src/controllers/eventController.js
// 기존 DB 구조에 맞춘 반복 일정 컨트롤러

const path = require('path');
const fs = require('fs');
const { query, transaction } = require('../../config/database');
const { generateOccurrencesFromSeries } = require('../utils/recurringEvents');
const { notifyByScope } = require('./notificationController');
const {
  scheduleEventReminder,
  cancelEventReminders,
  cancelSeriesReminders,
} = require('../utils/reminderQueueService');
const { broadcast } = require('../utils/sseManager');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * PG의 TIMESTAMP WITH TIME ZONE → 타임존 없는 나이브 문자열 변환
 * Docker(UTC) 환경에서 PG가 나이브 문자열을 UTC로 저장하므로,
 * 읽을 때 getUTC*로 원래 입력값을 복원하여 프론트엔드에 전달
 */
function toNaiveDateTimeString(date) {
  if (!date) return null;
  if (typeof date === 'string') return date;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const sec = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:${sec}`;
}

/**
 * DB에서 RETURNING *로 받은 raw event row의 타임스탬프 필드를 나이브 문자열로 변환
 */
function formatEventRow(row) {
  if (!row) return row;
  return {
    ...row,
    start_at: toNaiveDateTimeString(row.start_at),
    end_at: toNaiveDateTimeString(row.end_at),
    completed_at: toNaiveDateTimeString(row.completed_at),
    created_at: toNaiveDateTimeString(row.created_at),
    updated_at: toNaiveDateTimeString(row.updated_at)
  };
}

/**
 * 직급별 조회 스코프 필터 생성
 * ADMIN: 전체 조회 / 본부장: 본부 내 / 처장·실장: 처 내 / 사원~부장: 부서 내
 */
function buildScopeFilter(user, startParamIdx = 1, eventAlias = 'e', userAlias = 'u') {
  if (user.role === 'ADMIN') {
    return { clause: '1=1', params: [], nextParamIdx: startParamIdx };
  }
  if (user.position === '본부장' && user.divisionId) {
    return { clause: `${userAlias}.division_id = $${startParamIdx}`, params: [user.divisionId], nextParamIdx: startParamIdx + 1 };
  }
  if (['처장', '실장'].includes(user.position) && user.officeId) {
    return { clause: `${userAlias}.office_id = $${startParamIdx}`, params: [user.officeId], nextParamIdx: startParamIdx + 1 };
  }
  // 사원~부장: 같은 부서 일정 조회
  if (user.departmentId) {
    return { clause: `${userAlias}.department_id = $${startParamIdx}`, params: [user.departmentId], nextParamIdx: startParamIdx + 1 };
  }
  return { clause: `${eventAlias}.creator_id = $${startParamIdx}`, params: [user.id], nextParamIdx: startParamIdx + 1 };
}

/**
 * 일정 수정/삭제 권한 체크
 */
function canEditEvent(user, event) {
  if (event.creator_id === user.id) return true;
  if (user.role === 'ADMIN') return true;
  return false;
}

/**
 * 공유 대상 체크 SQL 서브쿼리 생성
 * 사용자가 해당 일정의 공유 대상인지 확인
 * - office_id 일치 AND
 * - (department_id IS NULL OR department_id = 사용자부서) AND
 * - (positions IS NULL OR positions 배열에 사용자직급 포함)
 */
function buildShareClause(user, eventIdColumn, paramIdxStart) {
  // ADMIN은 전체 조회이므로 공유 체크 불필요
  if (user.role === 'ADMIN' || !user.officeId) {
    return { clause: '', params: [], nextParamIdx: paramIdxStart };
  }

  // NULL 파라미터 타입 명시를 위해 CAST 사용
  const clause = ` OR EXISTS (
    SELECT 1 FROM event_shared_offices eso
    WHERE eso.${eventIdColumn}
    AND eso.office_id = $${paramIdxStart}
    AND (eso.department_id IS NULL OR eso.department_id = $${paramIdxStart + 1}::INTEGER)
    AND (eso.positions IS NULL OR eso.positions @> jsonb_build_array($${paramIdxStart + 2}::TEXT))
  )`;

  return {
    clause,
    params: [user.officeId, user.departmentId, user.position],
    nextParamIdx: paramIdxStart + 3
  };
}

/**
 * 일정 목록 조회 (반복 일정 자동 확장)
 */
exports.getEvents = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;
    const userOfficeId = req.user.officeId;

    // 직급별 조회 스코프 필터
    const scope = buildScopeFilter(req.user, 1, 'e', 'u');

    // 공유 대상 조건 (부서/직급 필터 포함)
    const evtShare = buildShareClause(req.user, 'event_id = e.id', scope.nextParamIdx);
    const evtDateIdx = evtShare.nextParamIdx;

    // 1. 일반 일정 조회 (series_id가 null인 것)
    const regularEventsQuery = `
      SELECT e.*,
             u.name as creator_name,
             d.name as department_name,
             o.name as office_name,
             dv.name as division_name
      FROM events e
      JOIN users u ON e.creator_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN offices o ON e.office_id = o.id
      LEFT JOIN divisions dv ON e.division_id = dv.id
      WHERE (${scope.clause}${evtShare.clause})
      AND e.series_id IS NULL
      AND e.start_at BETWEEN $${evtDateIdx} AND $${evtDateIdx + 1}
      ORDER BY e.start_at
    `;
    const regularResult = await query(regularEventsQuery, [...scope.params, ...evtShare.params, startDate, endDate]);
    const regularEvents = regularResult.rows;

    // 2. 예외 일정 조회 (is_exception = true)
    const exceptionEventsQuery = `
      SELECT e.*,
             u.name as creator_name,
             d.name as department_name,
             o.name as office_name,
             dv.name as division_name
      FROM events e
      JOIN users u ON e.creator_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN offices o ON e.office_id = o.id
      LEFT JOIN divisions dv ON e.division_id = dv.id
      WHERE (${scope.clause}${evtShare.clause})
      AND e.is_exception = true
      AND e.start_at BETWEEN $${evtDateIdx} AND $${evtDateIdx + 1}
      ORDER BY e.start_at
    `;
    const exceptionResult = await query(exceptionEventsQuery, [...scope.params, ...evtShare.params, startDate, endDate]);
    const exceptionEvents = exceptionResult.rows;

    // 3. 반복 일정 시리즈 조회
    const seriesScope = buildScopeFilter(req.user, 1, 'es', 'u');
    const seriesShare = buildShareClause(req.user, 'series_id = es.id', seriesScope.nextParamIdx);
    const seriesDateIdx = seriesShare.nextParamIdx;

    const seriesQuery = `
      SELECT es.*, u.name as creator_name FROM event_series es
      JOIN users u ON es.creator_id = u.id
      WHERE (${seriesScope.clause}${seriesShare.clause})
      AND (
        es.recurrence_end_date IS NULL
        OR es.recurrence_end_date >= $${seriesDateIdx}
      )
      AND es.first_occurrence_date <= $${seriesDateIdx + 1}
    `;
    const seriesResult = await query(seriesQuery, [...seriesScope.params, ...seriesShare.params, startDate, endDate]);
    const seriesList = seriesResult.rows;

    // 4. 예외 날짜 조회
    const seriesIds = seriesList.map(s => s.id);
    let exceptions = [];
    if (seriesIds.length > 0) {
      const exceptionsQuery = `
        SELECT series_id, exception_date
        FROM event_exceptions
        WHERE series_id = ANY($1)
      `;
      const exceptionsResult = await query(exceptionsQuery, [seriesIds]);
      exceptions = exceptionsResult.rows;
    }

    // 5. 반복 일정 확장
    const recurringEvents = [];
    for (const series of seriesList) {
      const seriesExceptions = exceptions.filter(exc => exc.series_id === series.id);
      const occurrences = generateOccurrencesFromSeries(
        series,
        new Date(startDate),
        new Date(endDate),
        seriesExceptions
      );
      recurringEvents.push(...occurrences);
    }

    // 6. 모든 일정 합치기
    const allEvents = [...regularEvents, ...exceptionEvents, ...recurringEvents];

    // 7. 날짜순 정렬
    allEvents.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

    // 8. 공유 처 정보 일괄 조회
    const eventIds = allEvents.filter(e => !e.is_generated && e.id).map(e => e.id);
    const allSeriesIds = [...new Set(allEvents.filter(e => e.series_id).map(e => e.series_id))];
    let sharedMap = {};
    if (eventIds.length > 0 || allSeriesIds.length > 0) {
      const sharedQuery = `
        SELECT eso.event_id, eso.series_id, eso.office_id, o.name as office_name,
               eso.department_id, d.name as department_name, eso.positions
        FROM event_shared_offices eso
        JOIN offices o ON eso.office_id = o.id
        LEFT JOIN departments d ON eso.department_id = d.id
        WHERE eso.event_id = ANY($1) OR eso.series_id = ANY($2)
      `;
      const sharedResult = await query(sharedQuery, [eventIds, allSeriesIds]);
      for (const row of sharedResult.rows) {
        const key = row.event_id ? `event_${row.event_id}` : `series_${row.series_id}`;
        if (!sharedMap[key]) sharedMap[key] = [];
        sharedMap[key].push({
          id: row.office_id,
          name: row.office_name,
          departmentId: row.department_id,
          departmentName: row.department_name,
          positions: row.positions
        });
      }
    }

    // 8-1. 댓글 수 일괄 조회
    let commentCountMap = {};
    if (eventIds.length > 0 || allSeriesIds.length > 0) {
      const commentCountQuery = `
        SELECT event_id, series_id, COUNT(*) as comment_count
        FROM comments
        WHERE event_id = ANY($1) OR series_id = ANY($2)
        GROUP BY event_id, series_id
      `;
      const commentCountResult = await query(commentCountQuery, [eventIds, allSeriesIds]);
      for (const row of commentCountResult.rows) {
        const key = row.event_id ? `event_${row.event_id}` : `series_${row.series_id}`;
        commentCountMap[key] = parseInt(row.comment_count);
      }
    }

    // 8-2. 첨부파일 수 일괄 조회 (시리즈는 occurrence_date별로 카운트)
    let attachmentCountMap = {};
    if (eventIds.length > 0 || allSeriesIds.length > 0) {
      const attachCountQuery = `
        SELECT event_id, series_id, occurrence_date, COUNT(*) as attachment_count
        FROM event_attachments
        WHERE event_id = ANY($1) OR series_id = ANY($2)
        GROUP BY event_id, series_id, occurrence_date
      `;
      const attachResult = await query(attachCountQuery, [eventIds, allSeriesIds]);
      for (const row of attachResult.rows) {
        if (row.event_id) {
          attachmentCountMap[`event_${row.event_id}`] = parseInt(row.attachment_count);
        } else if (row.occurrence_date) {
          // 특정 occurrence에만 해당하는 첨부
          const dateStr = new Date(row.occurrence_date).toISOString().split('T')[0];
          attachmentCountMap[`series_${row.series_id}_${dateStr}`] = (attachmentCountMap[`series_${row.series_id}_${dateStr}`] || 0) + parseInt(row.attachment_count);
        } else {
          // 전체 시리즈에 해당하는 첨부 (occurrence_date IS NULL)
          attachmentCountMap[`series_${row.series_id}_all`] = parseInt(row.attachment_count);
        }
      }
    }

    // 8-3. 마감임박 기준 조회
    const THRESHOLD_MINUTES = { '30min': 30, '1hour': 60, '3hour': 180 };
    let dueSoonMaxMinutes = 0;
    try {
      const dsResult = await query("SELECT value FROM system_settings WHERE key = 'due_soon_threshold'");
      const dsValue = dsResult.rows[0]?.value;
      const dsArray = Array.isArray(dsValue) ? dsValue : [];
      dueSoonMaxMinutes = Math.max(0, ...dsArray.map(t => THRESHOLD_MINUTES[t] || 0));
    } catch (_) { /* ignore */ }
    const now = new Date();

    // 9. 필드명 camelCase로 변환 (프론트엔드 호환)
    const formattedEvents = allEvents.map(event => {
      const sharedOffices = sharedMap[`event_${event.id}`]
        || sharedMap[`series_${event.series_id}`]
        || [];
      const commentCount = commentCountMap[`event_${event.id}`]
        || commentCountMap[`series_${event.series_id}`]
        || 0;
      // 첨부파일 수: 단일 이벤트 자체 + 시리즈 전체(NULL) + 시리즈 해당날짜
      let attachmentCount = attachmentCountMap[`event_${event.id}`] || 0;
      if (event.series_id && event.occurrence_date) {
        const occDate = typeof event.occurrence_date === 'string'
          ? event.occurrence_date.split('T')[0]
          : new Date(event.occurrence_date).toISOString().split('T')[0];
        attachmentCount += (attachmentCountMap[`series_${event.series_id}_all`] || 0)
          + (attachmentCountMap[`series_${event.series_id}_${occDate}`] || 0);
      }
      // 마감임박 판정: PENDING + 종료시간이 현재~threshold 이내
      // DB에 저장된 시간은 KST가 UTC로 잘못 해석된 상태이므로, 실제 UTC로 변환
      const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const storedEndTime = new Date(event.end_at);
      const eventEnd = new Date(storedEndTime.getTime() - KST_OFFSET_MS);
      const isDueSoon = event.status !== 'DONE'
        && dueSoonMaxMinutes > 0
        && eventEnd > now
        && (eventEnd.getTime() - now.getTime()) <= dueSoonMaxMinutes * 60 * 1000;

      // 지연 판정: PENDING + 종료시간이 이미 지남
      const isOverdue = event.status !== 'DONE' && eventEnd < now;

      return {
        id: event.id,
        title: event.title,
        content: event.content,
        startAt: toNaiveDateTimeString(event.start_at),
        endAt: toNaiveDateTimeString(event.end_at),
        status: isOverdue ? 'OVERDUE' : event.status,
        completedAt: toNaiveDateTimeString(event.completed_at),
        alert: event.alert,
        priority: event.priority,
        seriesId: event.series_id,
        occurrenceDate: event.occurrence_date,
        isException: event.is_exception,
        originalSeriesId: event.original_series_id,
        isGenerated: event.is_generated,
        isRecurring: event.is_recurring || !!event.series_id,
        isDueSoon,
        isOverdue,
        creator: {
          id: event.creator_id,
          name: event.creator_name
        },
        isOwner: event.creator_id === userId,
        canEdit: event.creator_id === userId || req.user.role === 'ADMIN',
        department: event.department_name,
        office: event.office_name,
        division: event.division_name,
        sharedOffices,
        commentCount,
        attachmentCount,
        createdAt: toNaiveDateTimeString(event.created_at),
        updatedAt: toNaiveDateTimeString(event.updated_at)
      };
    });

    res.json({
      success: true,
      data: { events: formattedEvents }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, message: 'Failed to get events' });
  }
};

/**
 * 일정 생성 (일반 또는 반복) - camelCase와 snake_case 둘 다 지원
 */
exports.createEvent = async (req, res) => {
  try {
    const {
      title, content,
      start_at, end_at, startAt, endAt,  // 둘 다 받기
      status, alert,
      is_recurring, isRecurring,  // 둘 다 받기
      recurrence_type, recurrenceType,  // 둘 다 받기
      recurrence_interval, recurrenceInterval,  // 둘 다 받기
      recurrence_end_date, recurrenceEndDate,  // 둘 다 받기
      sharedOfficeIds,  // 레거시: 공유 처 ID 배열
      sharedTargets     // 신규: [{ officeId, departmentId?, positions? }]
    } = req.body;

    // camelCase 우선, snake_case 대체
    const actualStartAt = startAt || start_at;
    const actualEndAt = endAt || end_at;
    const actualIsRecurring = isRecurring || is_recurring;
    const actualRecurrenceType = recurrenceType || recurrence_type;
    const actualRecurrenceInterval = recurrenceInterval || recurrence_interval;
    const actualRecurrenceEndDate = recurrenceEndDate || recurrence_end_date;

    // 공유 대상 정규화 (레거시 형식 지원)
    // sharedTargets: [{ officeId, departmentId?, positions? }]
    const actualSharedTargets = sharedTargets ||
      (sharedOfficeIds ? sharedOfficeIds.map(id => ({ officeId: id, departmentId: null, positions: null })) : []);

    // 시간 유효성 검증
    if (actualStartAt && actualEndAt && new Date(actualEndAt) <= new Date(actualStartAt)) {
      return res.status(400).json({ success: false, message: '종료 시간은 시작 시간보다 이후여야 합니다.' });
    }

    const userId = req.user.id;

    // 사용자 부서 정보 조회
    const userQuery = 'SELECT department_id, office_id, division_id FROM users WHERE id = $1';
    const userResult = await query(userQuery, [userId]);
    const user = userResult.rows[0];

    if (actualIsRecurring) {
      // 반복 일정 생성
      const result = await transaction(async (client) => {
        const startDate = new Date(actualStartAt);
        const endDate = new Date(actualEndAt);

        const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}:00`;
        const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}:00`;
        const firstOccurrenceDate = startDate.toISOString().split('T')[0];

        // 시작일과 종료일의 날짜 차이 계산 (다일 일정 지원)
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const durationDays = Math.round((endDateOnly - startDateOnly) / (24 * 60 * 60 * 1000));

        const seriesQuery = `
          INSERT INTO event_series (
            title, content, recurrence_type, recurrence_interval, recurrence_end_date,
            start_time, end_time, first_occurrence_date, alert, duration_days,
            creator_id, department_id, office_id, division_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `;

        const seriesValues = [
          title, content, actualRecurrenceType, actualRecurrenceInterval, actualRecurrenceEndDate,
          startTime, endTime, firstOccurrenceDate, alert || 'none', durationDays,
          userId, user.department_id, user.office_id, user.division_id
        ];

        const seriesResult = await client.query(seriesQuery, seriesValues);
        const newSeries = seriesResult.rows[0];

        // 공유 대상 저장 (부서/직급 포함)
        if (actualSharedTargets && actualSharedTargets.length > 0) {
          for (const target of actualSharedTargets) {
            await client.query(
              `INSERT INTO event_shared_offices (series_id, office_id, department_id, positions)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING`,
              [newSeries.id, target.officeId, target.departmentId || null, target.positions ? JSON.stringify(target.positions) : null]
            );
          }
        }

        return seriesResult;
      });

      // 공유 일정 알림 발송
      if (actualSharedTargets && actualSharedTargets.length > 0) {
        try {
          // 알림에 전달할 공유 대상 정보 구성
          const sharedOfficeIds = [...new Set(actualSharedTargets.map(t => t.officeId))];
          await notifyByScope('EVENT_SHARED', '공유 일정', `"${title}" 일정이 공유되었습니다.`, {
            actorId: userId,
            creatorId: userId,
            sharedOfficeIds,
            sharedTargets: actualSharedTargets,
            relatedEventId: null,
            metadata: { seriesId: result.rows[0].id }
          });
        } catch (nErr) {
          console.error('[Notification] Failed to send shared event notification:', nErr.message);
        }
      }

      broadcast('event_changed', { action: 'created' });
      res.status(201).json({
        success: true,
        data: { series: result.rows[0] }
      });
    } else {
      // 일반 일정 생성 (트랜잭션으로 공유 처 함께 저장)
      const result = await transaction(async (client) => {
        const eventQuery = `
          INSERT INTO events (
            title, content, start_at, end_at, status, alert,
            creator_id, department_id, office_id, division_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;

        const eventValues = [
          title, content, actualStartAt, actualEndAt, status || 'PENDING', alert || 'none',
          userId, user.department_id, user.office_id, user.division_id
        ];

        const eventResult = await client.query(eventQuery, eventValues);
        const newEvent = eventResult.rows[0];

        // 공유 대상 저장 (부서/직급 포함)
        if (actualSharedTargets && actualSharedTargets.length > 0) {
          for (const target of actualSharedTargets) {
            await client.query(
              `INSERT INTO event_shared_offices (event_id, office_id, department_id, positions)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING`,
              [newEvent.id, target.officeId, target.departmentId || null, target.positions ? JSON.stringify(target.positions) : null]
            );
          }
        }

        return eventResult;
      });

      const newEvent = result.rows[0];

      // 큐에 리마인더 스케줄링
      try {
        await scheduleEventReminder(newEvent.id, newEvent.start_at, newEvent.end_at, userId);
      } catch (qErr) {
        console.error('[Queue] Failed to schedule reminder:', qErr.message);
      }

      // 공유 일정 알림 발송
      if (actualSharedTargets && actualSharedTargets.length > 0) {
        try {
          const sharedOfficeIds = [...new Set(actualSharedTargets.map(t => t.officeId))];
          await notifyByScope('EVENT_SHARED', '공유 일정', `"${title}" 일정이 공유되었습니다.`, {
            actorId: userId,
            creatorId: userId,
            sharedOfficeIds,
            sharedTargets: actualSharedTargets,
            relatedEventId: newEvent.id,
          });
        } catch (nErr) {
          console.error('[Notification] Failed to send shared event notification:', nErr.message);
        }
      }

      broadcast('event_changed', { action: 'created' });
      res.status(201).json({
        success: true,
        data: { event: formatEventRow(newEvent) }
      });
    }
  } catch (error) {
    console.error('Create event error:', error);
    if (error.constraint === 'check_time_range') {
      return res.status(400).json({ success: false, message: '종료 시간은 시작 시간보다 이후여야 합니다.' });
    }
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
};

/**
 * 일정 수정 (반복 일정 처리)
 */
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, content,
      start_at, end_at, startAt, endAt,
      status, edit_type, editType, occurrence_date, occurrenceDate,
      recurrence_type, recurrenceType: recurrenceTypeField,
      recurrence_interval, recurrenceInterval: recurrenceIntervalField,
      recurrence_end_date, recurrenceEndDate: recurrenceEndDateField,
      sharedOfficeIds,  // 레거시
      sharedTargets     // 신규: [{ officeId, departmentId?, positions? }]
    } = req.body;

    const actualStartAt = startAt || start_at;
    const actualEndAt = endAt || end_at;
    const actualEditType = editType || edit_type;
    const actualOccurrenceDate = occurrenceDate || occurrence_date;
    const actualRecurrenceType = recurrenceTypeField || recurrence_type;
    const actualRecurrenceInterval = recurrenceIntervalField || recurrence_interval;
    const actualRecurrenceEndDate = recurrenceEndDateField !== undefined ? recurrenceEndDateField : recurrence_end_date;

    // 공유 대상 정규화
    const actualSharedTargets = sharedTargets !== undefined ? sharedTargets :
      (sharedOfficeIds !== undefined ? sharedOfficeIds.map(id => ({ officeId: id, departmentId: null, positions: null })) : undefined);

    // 시간 유효성 검증
    if (actualStartAt && actualEndAt && new Date(actualEndAt) <= new Date(actualStartAt)) {
      return res.status(400).json({ success: false, message: '종료 시간은 시작 시간보다 이후여야 합니다.' });
    }

    const userId = req.user.id;

    // 반복 일정인 경우 (ID가 series-로 시작)
    if (id.startsWith('series-')) {
      const parts = id.split('-');
      const seriesId = parts[1];

      // editType이 없으면 기본값 'this' 사용
      const seriesEditType = actualEditType || 'this';

      // event_series 조회
      const seriesQuery = 'SELECT * FROM event_series WHERE id = $1';
      const seriesResult = await query(seriesQuery, [seriesId]);

      if (seriesResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event series not found' });
      }

      const series = seriesResult.rows[0];
      if (!canEditEvent(req.user, series)) {
        return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
      }

      if (seriesEditType === 'this') {
        // 이 날짜만 수정 - 시리즈에서 분리하여 독립 이벤트 생성
        const occurrenceTimestamp = parts[2];
        const occurrenceDate = new Date(parseInt(occurrenceTimestamp));
        const occurrenceDateStr = occurrenceDate.toISOString().split('T')[0];

        const result = await transaction(async (client) => {
          const insertQuery = `
            INSERT INTO events (
              title, content, start_at, end_at, status, alert,
              is_exception, original_series_id,
              creator_id, department_id, office_id, division_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, false, $7,
              $8, $9, $10, $11)
            RETURNING *
          `;

          const values = [
            title, content, actualStartAt, actualEndAt, status || 'PENDING', series.alert,
            seriesId, userId,
            series.department_id, series.office_id, series.division_id
          ];

          const insertResult = await client.query(insertQuery, values);
          const newEvent = insertResult.rows[0];

          // 시리즈 공유 대상 복사 (부서/직급 포함)
          const sharedRows = await client.query(
            'SELECT office_id, department_id, positions FROM event_shared_offices WHERE series_id = $1',
            [seriesId]
          );
          for (const row of sharedRows.rows) {
            await client.query(
              `INSERT INTO event_shared_offices (event_id, office_id, department_id, positions)
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
              [newEvent.id, row.office_id, row.department_id, row.positions ? JSON.stringify(row.positions) : null]
            );
          }

          // 원래 반복 일정에서 이 날짜 제외
          const exceptionQuery = `
            INSERT INTO event_exceptions (series_id, exception_date)
            VALUES ($1, $2)
            ON CONFLICT (series_id, exception_date) DO NOTHING
          `;
          await client.query(exceptionQuery, [seriesId, occurrenceDateStr]);

          return insertResult;
        });

        const updatedEvent = result.rows[0];

        // 큐에 리마인더 스케줄링 (새 예외 이벤트)
        try {
          await scheduleEventReminder(updatedEvent.id, updatedEvent.start_at, updatedEvent.end_at, userId);
        } catch (qErr) {
          console.error('[Queue] Failed to schedule reminder:', qErr.message);
        }

        // 알림 생성
        try {
          await notifyByScope('EVENT_UPDATED', '일정 수정', `"${updatedEvent.title}" 일정이 수정되었습니다.`, {
            actorId: userId,
            creatorId: series.creator_id,
            departmentId: series.department_id,
            officeId: series.office_id,
            divisionId: series.division_id,
            relatedEventId: updatedEvent.id,
          });
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }

        broadcast('event_changed', { action: 'updated' });
        return res.json({ success: true, data: { event: formatEventRow(updatedEvent) } });
      } else if (seriesEditType === 'all') {
        // 전체 반복 일정 수정 (동적 SET 절)
        const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
        const values = [];
        let paramIndex = 1;

        if (title !== undefined) {
          setClauses.push(`title = $${paramIndex++}`);
          values.push(title);
        }
        if (content !== undefined) {
          setClauses.push(`content = $${paramIndex++}`);
          values.push(content);
        }
        if (actualRecurrenceType) {
          setClauses.push(`recurrence_type = $${paramIndex++}`);
          values.push(actualRecurrenceType);
        }
        if (actualRecurrenceInterval) {
          setClauses.push(`recurrence_interval = $${paramIndex++}`);
          values.push(parseInt(actualRecurrenceInterval, 10));
        }
        if (actualRecurrenceEndDate !== undefined) {
          setClauses.push(`recurrence_end_date = $${paramIndex++}`);
          values.push(actualRecurrenceEndDate || null);
        }
        if (actualStartAt) {
          const startTime = new Date(actualStartAt);
          const startTimeStr = `${startTime.getHours().toString().padStart(2,'0')}:${startTime.getMinutes().toString().padStart(2,'0')}:00`;
          setClauses.push(`start_time = $${paramIndex++}`);
          values.push(startTimeStr);
        }
        if (actualEndAt) {
          const endTime = new Date(actualEndAt);
          const endTimeStr = `${endTime.getHours().toString().padStart(2,'0')}:${endTime.getMinutes().toString().padStart(2,'0')}:00`;
          setClauses.push(`end_time = $${paramIndex++}`);
          values.push(endTimeStr);
        }
        // duration_days 계산 (시작일과 종료일의 날짜 차이)
        if (actualStartAt && actualEndAt) {
          const s = new Date(actualStartAt);
          const e = new Date(actualEndAt);
          const sDate = new Date(s.getFullYear(), s.getMonth(), s.getDate());
          const eDate = new Date(e.getFullYear(), e.getMonth(), e.getDate());
          const durationDays = Math.round((eDate - sDate) / (24 * 60 * 60 * 1000));
          setClauses.push(`duration_days = $${paramIndex++}`);
          values.push(durationDays);
        }

        values.push(seriesId);

        const updateQuery = `
          UPDATE event_series
          SET ${setClauses.join(', ')}
          WHERE id = $${paramIndex++}
          RETURNING *
        `;

        // 기존 공유 대상 조회 (새로 추가된 대상에만 알림 발송을 위해)
        let previousSharedOfficeIds = [];
        if (actualSharedTargets !== undefined) {
          const prevSharedResult = await query('SELECT office_id FROM event_shared_offices WHERE series_id = $1', [seriesId]);
          previousSharedOfficeIds = prevSharedResult.rows.map(r => r.office_id);
        }

        // 공유 대상 업데이트 (트랜잭션)
        const result = await transaction(async (client) => {
          const updateResult = await client.query(updateQuery, values);

          if (actualSharedTargets !== undefined) {
            await client.query('DELETE FROM event_shared_offices WHERE series_id = $1', [seriesId]);
            for (const target of (actualSharedTargets || [])) {
              await client.query(
                `INSERT INTO event_shared_offices (series_id, office_id, department_id, positions)
                 VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [seriesId, target.officeId, target.departmentId || null, target.positions ? JSON.stringify(target.positions) : null]
              );
            }
          }

          return updateResult;
        });

        const updatedSeries = result.rows[0];

        // 새로 추가된 공유 대상에 알림 발송
        if (actualSharedTargets && actualSharedTargets.length > 0) {
          const currentOfficeIds = actualSharedTargets.map(t => t.officeId);
          const newSharedOfficeIds = currentOfficeIds.filter(id => !previousSharedOfficeIds.includes(id));
          if (newSharedOfficeIds.length > 0) {
            try {
              const newTargets = actualSharedTargets.filter(t => newSharedOfficeIds.includes(t.officeId));
              await notifyByScope('EVENT_SHARED', '공유 일정', `"${updatedSeries.title}" 일정이 공유되었습니다.`, {
                actorId: userId,
                creatorId: updatedSeries.creator_id,
                sharedOfficeIds: newSharedOfficeIds,
                sharedTargets: newTargets,
                metadata: { seriesId: parseInt(seriesId) }
              });
            } catch (nErr) {
              console.error('[Notification] Failed to send shared event notification:', nErr.message);
            }
          }
        }

        // 시리즈 리마인더 재스케줄링 (시간 변경 시 daily scheduler가 처리)
        try {
          await cancelSeriesReminders(seriesId);
        } catch (qErr) {
          console.error('[Queue] Failed to cancel series reminders:', qErr.message);
        }

        // 알림 생성
        try {
          await notifyByScope('EVENT_UPDATED', '반복 일정 수정', `"${updatedSeries.title}" 반복 일정이 수정되었습니다.`, {
            actorId: userId,
            creatorId: updatedSeries.creator_id,
            departmentId: updatedSeries.department_id,
            officeId: updatedSeries.office_id,
            divisionId: updatedSeries.division_id,
          });
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }

        broadcast('event_changed', { action: 'updated' });
        return res.json({ success: true, data: { series: updatedSeries } });
      }
    }

    // 일반 일정인 경우 - 원본 이벤트 조회
    const originalQuery = 'SELECT * FROM events WHERE id = $1';
    const originalResult = await query(originalQuery, [id]);

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const originalEvent = originalResult.rows[0];
    if (!canEditEvent(req.user, originalEvent)) {
      return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
    }

    // 반복 일정 수정
    if (originalEvent.series_id && actualEditType === 'this') {
      // 이 날짜만 수정 - 예외 이벤트 생성
      const result = await transaction(async (client) => {
        const insertQuery = `
          INSERT INTO events (
            title, content, start_at, end_at, status, alert,
            is_exception, original_series_id,
            creator_id, department_id, office_id, division_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11)
          RETURNING *
        `;
        
        const values = [
          title, content, actualStartAt, actualEndAt, status, originalEvent.alert,
          originalEvent.series_id, userId,
          originalEvent.department_id, originalEvent.office_id, originalEvent.division_id
        ];

        const insertResult = await client.query(insertQuery, values);

        // 원래 반복 일정에서 이 날짜 제외
        const exceptionQuery = `
          INSERT INTO event_exceptions (series_id, exception_date)
          VALUES ($1, $2)
          ON CONFLICT (series_id, exception_date) DO NOTHING
        `;
        await client.query(exceptionQuery, [originalEvent.series_id, actualOccurrenceDate]);

        return insertResult;
      });

      const updatedEvent = result.rows[0];

      // 알림 생성
      try {
        await notifyByScope('EVENT_UPDATED', '일정 수정', `"${updatedEvent.title}" 일정이 수정되었습니다.`, {
          actorId: userId,
          creatorId: originalEvent.creator_id,
          departmentId: originalEvent.department_id,
          officeId: originalEvent.office_id,
          divisionId: originalEvent.division_id,
          relatedEventId: updatedEvent.id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'updated' });
      return res.json({ success: true, data: { event: formatEventRow(updatedEvent) } });
    } else if (originalEvent.series_id && actualEditType === 'all') {
      // 전체 반복 일정 수정
      const updateQuery = `
        UPDATE event_series
        SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const result = await query(updateQuery, [title, content, originalEvent.series_id]);

      const updatedSeries = result.rows[0];

      // 알림 생성
      try {
        await notifyByScope('EVENT_UPDATED', '반복 일정 수정', `"${updatedSeries.title}" 반복 일정이 수정되었습니다.`, {
          actorId: userId,
          creatorId: updatedSeries.creator_id,
          departmentId: originalEvent.department_id,
          officeId: originalEvent.office_id,
          divisionId: originalEvent.division_id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'updated' });
      return res.json({ success: true, data: { series: updatedSeries } });
    } else if (req.body.isRecurring) {
      // 단일 일정 → 반복 일정 변환
      const startDate = actualStartAt ? actualStartAt.split('T')[0] : originalEvent.start_at.toISOString().split('T')[0];
      const startTime = actualStartAt ? actualStartAt.split('T')[1].substring(0, 5) : toNaiveDateTimeString(originalEvent.start_at).split('T')[1].substring(0, 5);
      const endTime = actualEndAt ? actualEndAt.split('T')[1].substring(0, 5) : toNaiveDateTimeString(originalEvent.end_at).split('T')[1].substring(0, 5);

      const result = await transaction(async (client) => {
        const seriesInsert = await client.query(`
          INSERT INTO event_series (
            title, content, recurrence_type, recurrence_interval, recurrence_end_date,
            start_time, end_time, first_occurrence_date, alert, status,
            creator_id, department_id, office_id, division_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, $11, $12, $13)
          RETURNING *
        `, [
          title || originalEvent.title,
          content !== undefined ? content : originalEvent.content,
          actualRecurrenceType || 'week',
          parseInt(actualRecurrenceInterval) || 1,
          actualRecurrenceEndDate || null,
          startTime, endTime, startDate,
          originalEvent.alert || 'none',
          userId,
          originalEvent.department_id, originalEvent.office_id, originalEvent.division_id
        ]);

        // 기존 단일 이벤트 삭제
        await client.query('DELETE FROM event_shared_offices WHERE event_id = $1', [id]);
        await client.query('DELETE FROM events WHERE id = $1', [id]);

        // 공유 대상 이전
        if (actualSharedTargets && actualSharedTargets.length > 0) {
          for (const target of actualSharedTargets) {
            await client.query(
              `INSERT INTO event_shared_offices (series_id, office_id, department_id, positions)
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
              [seriesInsert.rows[0].id, target.officeId, target.departmentId || null, target.positions ? JSON.stringify(target.positions) : null]
            );
          }
        }

        return seriesInsert;
      });

      const newSeries = result.rows[0];

      try {
        await notifyByScope('EVENT_UPDATED', '반복 일정 변환', `"${newSeries.title}" 일정이 반복 일정으로 변환되었습니다.`, {
          actorId: userId,
          creatorId: newSeries.creator_id,
          departmentId: originalEvent.department_id,
          officeId: originalEvent.office_id,
          divisionId: originalEvent.division_id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'updated' });
      return res.json({ success: true, data: { series: newSeries } });
    } else {
      // 일반 일정 수정 (공유 대상 업데이트 포함)

      // 기존 공유 대상 조회 (새로 추가된 대상에만 알림 발송을 위해)
      let previousSharedOfficeIds = [];
      if (actualSharedTargets !== undefined) {
        const prevSharedResult = await query('SELECT office_id FROM event_shared_offices WHERE event_id = $1', [id]);
        previousSharedOfficeIds = prevSharedResult.rows.map(r => r.office_id);
      }

      const result = await transaction(async (client) => {
        const updateQuery = `
          UPDATE events
          SET title = $1, content = $2, start_at = $3, end_at = $4, status = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING *
        `;
        const updateResult = await client.query(updateQuery, [title, content, actualStartAt, actualEndAt, status || originalEvent.status, id]);

        if (actualSharedTargets !== undefined) {
          await client.query('DELETE FROM event_shared_offices WHERE event_id = $1', [id]);
          for (const target of (actualSharedTargets || [])) {
            await client.query(
              `INSERT INTO event_shared_offices (event_id, office_id, department_id, positions)
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
              [id, target.officeId, target.departmentId || null, target.positions ? JSON.stringify(target.positions) : null]
            );
          }
        }

        return updateResult;
      });

      const updatedEvent = result.rows[0];

      // 새로 추가된 공유 대상에 알림 발송
      if (actualSharedTargets && actualSharedTargets.length > 0) {
        const currentOfficeIds = actualSharedTargets.map(t => t.officeId);
        const newSharedOfficeIds = currentOfficeIds.filter(oid => !previousSharedOfficeIds.includes(oid));
        if (newSharedOfficeIds.length > 0) {
          try {
            const newTargets = actualSharedTargets.filter(t => newSharedOfficeIds.includes(t.officeId));
            await notifyByScope('EVENT_SHARED', '공유 일정', `"${updatedEvent.title}" 일정이 공유되었습니다.`, {
              actorId: userId,
              creatorId: updatedEvent.creator_id,
              sharedOfficeIds: newSharedOfficeIds,
              sharedTargets: newTargets,
              relatedEventId: updatedEvent.id,
            });
          } catch (nErr) {
            console.error('[Notification] Failed to send shared event notification:', nErr.message);
          }
        }
      }

      // 큐 리마인더 재스케줄링
      try {
        await cancelEventReminders(id);
        await scheduleEventReminder(id, updatedEvent.start_at, updatedEvent.end_at, userId);
      } catch (qErr) {
        console.error('[Queue] Failed to reschedule reminder:', qErr.message);
      }

      // 알림 생성
      try {
        await notifyByScope('EVENT_UPDATED', '일정 수정', `"${updatedEvent.title}" 일정이 수정되었습니다.`, {
          actorId: userId,
          creatorId: updatedEvent.creator_id,
          departmentId: updatedEvent.department_id,
          officeId: updatedEvent.office_id,
          divisionId: updatedEvent.division_id,
          relatedEventId: updatedEvent.id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'updated' });
      return res.json({ success: true, data: { event: formatEventRow(updatedEvent) } });
    }
  } catch (error) {
    console.error('Update event error:', error);
    if (error.constraint === 'check_time_range') {
      return res.status(400).json({ success: false, message: '종료 시간은 시작 시간보다 이후여야 합니다.' });
    }
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

/**
 * 일정 삭제 (반복 일정 처리)
 */
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { delete_type, deleteType, occurrence_date, occurrenceDate } = req.body;

    const actualDeleteType = deleteType || delete_type || 'single';
    const actualOccurrenceDate = occurrenceDate || occurrence_date;

    const userId = req.user.id;

    // 반복 일정인 경우 (ID가 series-로 시작)
    if (id.startsWith('series-')) {
      const parts = id.split('-');
      const seriesId = parts[1];
      const occurrenceTimestamp = parts[2];

      // event_series 조회
      const seriesQuery = 'SELECT * FROM event_series WHERE id = $1';
      const seriesResult = await query(seriesQuery, [seriesId]);

      if (seriesResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event series not found' });
      }

      const series = seriesResult.rows[0];
      if (!canEditEvent(req.user, series)) {
        return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
      }

      const occurrenceDate = new Date(parseInt(occurrenceTimestamp));
      const occurrenceDateStr = occurrenceDate.toISOString().split('T')[0];

      if (actualDeleteType === 'single') {
        // 이 날짜만 삭제 - 예외 추가
        const exceptionQuery = `
          INSERT INTO event_exceptions (series_id, exception_date)
          VALUES ($1, $2)
          ON CONFLICT (series_id, exception_date) DO NOTHING
        `;
        await query(exceptionQuery, [seriesId, occurrenceDateStr]);

        // 알림 생성
        try {
          await notifyByScope('EVENT_DELETED', '일정 삭제', `"${series.title}" 일정 (${occurrenceDateStr})이 삭제되었습니다.`, {
            actorId: userId,
            creatorId: series.creator_id,
            departmentId: series.department_id,
            officeId: series.office_id,
            divisionId: series.division_id,
          });
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }

        broadcast('event_changed', { action: 'deleted' });
        return res.json({ success: true, message: 'Event occurrence deleted' });
      } else if (actualDeleteType === 'series') {
        // 시리즈 리마인더 취소
        try {
          await cancelSeriesReminders(seriesId);
        } catch (qErr) {
          console.error('[Queue] Failed to cancel series reminders:', qErr.message);
        }

        // 전체 반복 일정 삭제 (CASCADE로 event_shared_offices 자동 삭제)
        await transaction(async (client) => {
          await client.query('DELETE FROM event_series WHERE id = $1', [seriesId]);
        });

        // 알림 생성
        try {
          await notifyByScope('EVENT_DELETED', '반복 일정 삭제', `"${series.title}" 반복 일정이 모두 삭제되었습니다.`, {
            actorId: userId,
            creatorId: series.creator_id,
            departmentId: series.department_id,
            officeId: series.office_id,
            divisionId: series.division_id,
          });
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }

        broadcast('event_changed', { action: 'deleted' });
        return res.json({ success: true, message: 'All recurring events deleted' });
      }
    }

    // 일반 일정인 경우
    const originalQuery = 'SELECT * FROM events WHERE id = $1';
    const originalResult = await query(originalQuery, [id]);

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const originalEvent = originalResult.rows[0];
    if (!canEditEvent(req.user, originalEvent)) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }

    // 반복 일정의 예외 이벤트 삭제
    if (originalEvent.series_id && actualDeleteType === 'single') {
      // 이 날짜만 삭제 - 예외 추가
      const exceptionQuery = `
        INSERT INTO event_exceptions (series_id, exception_date)
        VALUES ($1, $2)
        ON CONFLICT (series_id, exception_date) DO NOTHING
      `;
      await query(exceptionQuery, [originalEvent.series_id, actualOccurrenceDate]);

      // 알림 생성
      try {
        await notifyByScope('EVENT_DELETED', '일정 삭제', `"${originalEvent.title}" 일정이 삭제되었습니다.`, {
          actorId: userId,
          creatorId: originalEvent.creator_id,
          departmentId: originalEvent.department_id,
          officeId: originalEvent.office_id,
          divisionId: originalEvent.division_id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'deleted' });
      return res.json({ success: true, message: 'Event occurrence deleted' });
    } else if (originalEvent.series_id && actualDeleteType === 'series') {
      // 시리즈 리마인더 취소
      try {
        await cancelSeriesReminders(originalEvent.series_id);
      } catch (qErr) {
        console.error('[Queue] Failed to cancel series reminders:', qErr.message);
      }

      // 전체 반복 일정 삭제
      await transaction(async (client) => {
        await client.query('DELETE FROM event_series WHERE id = $1', [originalEvent.series_id]);
      });

      // 알림 생성
      try {
        await notifyByScope('EVENT_DELETED', '반복 일정 삭제', `"${originalEvent.title}" 반복 일정이 모두 삭제되었습니다.`, {
          actorId: userId,
          creatorId: originalEvent.creator_id,
          departmentId: originalEvent.department_id,
          officeId: originalEvent.office_id,
          divisionId: originalEvent.division_id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'deleted' });
      return res.json({ success: true, message: 'All recurring events deleted' });
    } else {
      // 일반 일정 삭제
      const eventTitle = originalEvent.title;

      // 이벤트 리마인더 취소
      try {
        await cancelEventReminders(id);
      } catch (qErr) {
        console.error('[Queue] Failed to cancel event reminders:', qErr.message);
      }

      await query('DELETE FROM events WHERE id = $1', [id]);

      // 알림 생성
      try {
        await notifyByScope('EVENT_DELETED', '일정 삭제', `"${eventTitle}" 일정이 삭제되었습니다.`, {
          actorId: userId,
          creatorId: originalEvent.creator_id,
          departmentId: originalEvent.department_id,
          officeId: originalEvent.office_id,
          divisionId: originalEvent.division_id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'deleted' });
      return res.json({ success: true, message: 'Event deleted' });
    }
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
};

/**
 * 일정 상세 조회
 */
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 반복 일정인 경우 (ID가 series-로 시작)
    if (id.startsWith('series-')) {
      const parts = id.split('-');
      const seriesId = parts[1];
      const occurrenceTimestamp = parts[2];
      
      // event_series 조회 (직급별 스코프 + 공유 대상 적용)
      const detailScope = buildScopeFilter(req.user, 2, 'es', 'u');
      const detailShare = buildShareClause(req.user, 'series_id = es.id', detailScope.nextParamIdx);
      const seriesQuery = `
        SELECT es.*,
               u.name as creator_name,
               d.name as department_name,
               o.name as office_name,
               dv.name as division_name
        FROM event_series es
        JOIN users u ON es.creator_id = u.id
        LEFT JOIN departments d ON es.department_id = d.id
        LEFT JOIN offices o ON es.office_id = o.id
        LEFT JOIN divisions dv ON es.division_id = dv.id
        WHERE es.id = $1 AND (${detailScope.clause}${detailShare.clause})
      `;

      const result = await query(seriesQuery, [seriesId, ...detailScope.params, ...detailShare.params]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event series not found' });
      }

      const series = result.rows[0];
      
      // occurrence 날짜 계산
      const occurrenceDate = new Date(parseInt(occurrenceTimestamp));
      const occurrenceDateStr = occurrenceDate.toISOString().split('T')[0];
      
      // 이 날짜에 완료된 예외 이벤트가 있는지 확인
      const exceptionEventQuery = `
        SELECT * FROM events
        WHERE series_id = $1
        AND is_exception = true
        AND DATE(start_at) = $2
      `;
      const exceptionResult = await query(exceptionEventQuery, [seriesId, occurrenceDateStr]);
      
      // 시리즈 자체의 상태를 기본값으로 사용
      let status = series.status || 'PENDING';
      let completedAt = series.completed_at || null;

      // 개별 예외 이벤트가 있으면 그 상태를 우선 적용
      if (exceptionResult.rows.length > 0) {
        const exceptionEvent = exceptionResult.rows[0];
        status = exceptionEvent.status;
        completedAt = exceptionEvent.completed_at;
      }
      
      // start_time과 end_time을 사용하여 timestamp 생성 (타임존 변환 없이 직접 조합)
      const startTimeStr = series.start_time.substring(0, 5); // 'HH:MM'
      const endTimeStr = series.end_time.substring(0, 5);

      // 공유 대상 정보 조회 (부서/직급 포함)
      const seriesSharedResult = await query(
        `SELECT eso.office_id, o.name as office_name, eso.department_id, d.name as department_name, eso.positions
         FROM event_shared_offices eso
         JOIN offices o ON eso.office_id = o.id
         LEFT JOIN departments d ON eso.department_id = d.id
         WHERE eso.series_id = $1`,
        [series.id]
      );
      const seriesSharedOffices = seriesSharedResult.rows.map(r => ({
        id: r.office_id,
        name: r.office_name,
        departmentId: r.department_id,
        departmentName: r.department_name,
        positions: r.positions
      }));

      // isOverdue 계산: 종료시간이 지났고 PENDING 상태인 경우
      // 문자열로 만든 시간은 KST 의도이지만 서버(UTC)에서는 UTC로 해석됨 → 9시간 보정
      const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const endAtStr = `${occurrenceDateStr}T${endTimeStr}:00`;
      const seriesEndTimeParsed = new Date(endAtStr);
      const seriesEndTime = new Date(seriesEndTimeParsed.getTime() - KST_OFFSET_MS);
      const isOverdue = status !== 'DONE' && seriesEndTime < new Date();

      // 첨부파일 조회 (전체 시리즈 NULL + 해당 날짜)
      const seriesAttachResult = await query(
        'SELECT id, original_name, file_size, mime_type, created_at FROM event_attachments WHERE series_id = $1 AND (occurrence_date IS NULL OR occurrence_date = $2) ORDER BY created_at',
        [series.id, occurrenceDateStr]
      );
      const seriesAttachments = seriesAttachResult.rows.map(a => ({
        id: a.id,
        originalName: a.original_name,
        fileSize: a.file_size,
        mimeType: a.mime_type,
        createdAt: a.created_at,
      }));

      // 필드명 camelCase로 변환
      const formattedEvent = {
        id: id,
        title: series.title,
        content: series.content,
        startAt: `${occurrenceDateStr}T${startTimeStr}:00`,
        endAt: endAtStr,
        status: isOverdue ? 'OVERDUE' : status,
        completedAt: completedAt,
        alert: series.alert,
        seriesId: series.id,
        occurrenceDate: occurrenceDateStr,
        isRecurring: true,
        isGenerated: true,
        recurrenceType: series.recurrence_type,
        recurrenceInterval: series.recurrence_interval,
        recurrenceEndDate: series.recurrence_end_date,
        firstOccurrenceDate: series.first_occurrence_date,
        creator: {
          id: series.creator_id,
          name: series.creator_name
        },
        isOwner: series.creator_id === req.user.id,
        canEdit: canEditEvent(req.user, series),
        department: series.department_name,
        office: series.office_name,
        division: series.division_name,
        sharedOffices: seriesSharedOffices,
        attachments: seriesAttachments,
        createdAt: series.created_at,
        updatedAt: series.updated_at
      };

      return res.json({
        success: true,
        data: { event: formattedEvent }
      });
    }

    // 일반 일정인 경우 (직급별 스코프 + 공유 처 적용)
    const eventScope = buildScopeFilter(req.user, 2, 'e', 'u');
    const eventShare = buildShareClause(req.user, 'event_id = e.id', eventScope.nextParamIdx);
    const eventQuery = `
      SELECT e.*,
             u.name as creator_name,
             d.name as department_name,
             o.name as office_name,
             dv.name as division_name
      FROM events e
      JOIN users u ON e.creator_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN offices o ON e.office_id = o.id
      LEFT JOIN divisions dv ON e.division_id = dv.id
      WHERE e.id = $1 AND (${eventScope.clause}${eventShare.clause})
    `;

    const result = await query(eventQuery, [id, ...eventScope.params, ...eventShare.params]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = result.rows[0];

    // 공유 대상 정보 조회 (부서/직급 포함)
    const eventSharedResult = await query(
      `SELECT eso.office_id, o.name as office_name, eso.department_id, d.name as department_name, eso.positions
       FROM event_shared_offices eso
       JOIN offices o ON eso.office_id = o.id
       LEFT JOIN departments d ON eso.department_id = d.id
       WHERE eso.event_id = $1 OR (eso.series_id = $2 AND $2 IS NOT NULL)`,
      [event.id, event.series_id]
    );
    const eventSharedOffices = eventSharedResult.rows.map(r => ({
      id: r.office_id,
      name: r.office_name,
      departmentId: r.department_id,
      departmentName: r.department_name,
      positions: r.positions
    }));

    // isOverdue 계산: 종료시간이 지났고 PENDING 상태인 경우
    // DB에 저장된 시간은 KST가 UTC로 잘못 해석된 상태이므로, 실제 UTC로 변환
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const eventEndTimeParsed = new Date(event.end_at);
    const eventEndTime = new Date(eventEndTimeParsed.getTime() - KST_OFFSET_MS);
    const isEventOverdue = event.status !== 'DONE' && eventEndTime < new Date();

    // 첨부파일 조회 (해당 이벤트의 첨부만)
    const eventAttachResult = await query(
      'SELECT id, original_name, file_size, mime_type, created_at FROM event_attachments WHERE event_id = $1 ORDER BY created_at',
      [event.id]
    );
    const eventAttachments = eventAttachResult.rows.map(a => ({
      id: a.id,
      originalName: a.original_name,
      fileSize: a.file_size,
      mimeType: a.mime_type,
      createdAt: a.created_at,
    }));

    // 필드명 camelCase로 변환
    const formattedEvent = {
      id: event.id,
      title: event.title,
      content: event.content,
      startAt: toNaiveDateTimeString(event.start_at),
      endAt: toNaiveDateTimeString(event.end_at),
      status: isEventOverdue ? 'OVERDUE' : event.status,
      completedAt: toNaiveDateTimeString(event.completed_at),
      alert: event.alert,
      priority: event.priority,
      seriesId: event.series_id,
      occurrenceDate: event.occurrence_date,
      isException: event.is_exception,
      originalSeriesId: event.original_series_id,
      creator: {
        id: event.creator_id,
        name: event.creator_name
      },
      isOwner: event.creator_id === req.user.id,
      canEdit: canEditEvent(req.user, event),
      department: event.department_name,
      office: event.office_name,
      division: event.division_name,
      sharedOffices: eventSharedOffices,
      attachments: eventAttachments,
      createdAt: toNaiveDateTimeString(event.created_at),
      updatedAt: toNaiveDateTimeString(event.updated_at)
    };

    res.json({
      success: true,
      data: { event: formattedEvent }
    });
  } catch (error) {
    console.error('Get event by id error:', error);
    res.status(500).json({ success: false, message: 'Failed to get event' });
  }
};

/**
 * 일정 완료 처리
 */
exports.completeEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { completeType } = req.body || {};
    const userId = req.user.id;

    // 반복 일정인 경우 (ID가 series-로 시작)
    if (id.startsWith('series-')) {
      const parts = id.split('-');
      const seriesId = parts[1];
      const occurrenceTimestamp = parts[2];

      // event_series 조회
      const seriesQuery = 'SELECT * FROM event_series WHERE id = $1';
      const seriesResult = await query(seriesQuery, [seriesId]);

      if (seriesResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event series not found' });
      }

      const series = seriesResult.rows[0];
      if (!canEditEvent(req.user, series)) {
        return res.status(403).json({ success: false, message: '권한이 없습니다.' });
      }
      const occurrenceDate = new Date(parseInt(occurrenceTimestamp));
      const occurrenceDateStr = occurrenceDate.toISOString().split('T')[0];

      // 전체 완료: 시리즈 상태를 DONE으로 변경 + 기존 예외 이벤트도 DONE으로
      if (completeType === 'all') {
        // 시리즈 리마인더 취소
        try {
          await cancelSeriesReminders(seriesId);
        } catch (qErr) {
          console.error('[Queue] Failed to cancel series reminders:', qErr.message);
        }

        await transaction(async (client) => {
          await client.query(
            `UPDATE event_series SET status = 'DONE', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [seriesId]
          );
          await client.query(
            `UPDATE events SET status = 'DONE', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE series_id = $1 AND status != 'DONE'`,
            [seriesId]
          );
        });

        // 알림 생성
        try {
          await notifyByScope('EVENT_COMPLETED', '반복 일정 전체 완료', `"${series.title}" 반복 일정을 전체 완료했습니다.`, {
            actorId: userId,
            creatorId: series.creator_id,
            departmentId: series.department_id,
            officeId: series.office_id,
            divisionId: series.division_id,
          });
        } catch (notifError) {
          console.error('Failed to create notification:', notifError);
        }

        broadcast('event_changed', { action: 'completed' });
        return res.json({
          success: true,
          message: 'All recurring events completed',
        });
      }

      // start_time과 end_time을 사용하여 timestamp 생성 (타임존 변환 없이 직접 조합)
      const startTimeStr = series.start_time.substring(0, 5);
      const endTimeStr = series.end_time.substring(0, 5);
      const startAtStr = `${occurrenceDateStr}T${startTimeStr}:00`;
      const endAtStr = `${occurrenceDateStr}T${endTimeStr}:00`;

      // 예외 이벤트 생성 (완료 상태)
      const result = await transaction(async (client) => {
        const insertQuery = `
          INSERT INTO events (
            title, content, start_at, end_at, status, completed_at, alert,
            is_exception, series_id, occurrence_date,
            creator_id, department_id, office_id, division_id
          )
          VALUES ($1, $2, $3, $4, 'DONE', CURRENT_TIMESTAMP, $5, true, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const values = [
          series.title, series.content,
          startAtStr, endAtStr,
          series.alert, seriesId, occurrenceDateStr, userId,
          series.department_id, series.office_id, series.division_id
        ];

        const insertResult = await client.query(insertQuery, values);
        const newEvent = insertResult.rows[0];

        // 시리즈 공유 처 복사 (department_id, positions 포함)
        const sharedRows = await client.query('SELECT office_id, department_id, positions FROM event_shared_offices WHERE series_id = $1', [seriesId]);
        for (const row of sharedRows.rows) {
          await client.query(
            'INSERT INTO event_shared_offices (event_id, office_id, department_id, positions) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [newEvent.id, row.office_id, row.department_id, row.positions ? JSON.stringify(row.positions) : null]
          );
        }

        // event_exceptions에 추가 (이 날짜는 원래 반복 일정에서 제외)
        const exceptionQuery = `
          INSERT INTO event_exceptions (series_id, exception_date)
          VALUES ($1, $2)
          ON CONFLICT (series_id, exception_date) DO NOTHING
        `;
        await client.query(exceptionQuery, [seriesId, occurrenceDateStr]);

        return insertResult;
      });

      // 알림 생성
      try {
        await notifyByScope('EVENT_COMPLETED', '일정 완료', `"${series.title}" 일정을 완료했습니다.`, {
          actorId: userId,
          creatorId: series.creator_id,
          departmentId: series.department_id,
          officeId: series.office_id,
          divisionId: series.division_id,
          metadata: { occurrenceDate: occurrenceDateStr },
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      broadcast('event_changed', { action: 'completed' });
      return res.json({
        success: true,
        message: 'Event completed',
        data: { event: formatEventRow(result.rows[0]) }
      });
    }

    // 일반 일정인 경우 - 권한 체크 후 완료
    const checkQuery = 'SELECT * FROM events WHERE id = $1';
    const checkResult = await query(checkQuery, [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (!canEditEvent(req.user, checkResult.rows[0])) {
      return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    }

    // 이벤트 리마인더 취소
    try {
      await cancelEventReminders(id);
    } catch (qErr) {
      console.error('[Queue] Failed to cancel event reminders:', qErr.message);
    }

    const completeQuery = `
      UPDATE events
      SET status = 'DONE', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(completeQuery, [id]);
    const completedEvent = result.rows[0];

    // 알림 생성
    try {
      await notifyByScope('EVENT_COMPLETED', '일정 완료', `"${completedEvent.title}" 일정을 완료했습니다.`, {
        actorId: userId,
        creatorId: completedEvent.creator_id,
        departmentId: completedEvent.department_id,
        officeId: completedEvent.office_id,
        divisionId: completedEvent.division_id,
        relatedEventId: completedEvent.id,
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    broadcast('event_changed', { action: 'completed' });
    res.json({
      success: true,
      message: 'Event completed',
      data: { event: formatEventRow(completedEvent) }
    });
  } catch (error) {
    console.error('Complete event error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete event' });
  }
};

/**
 * 일정 완료 취소
 */
exports.uncompleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 반복 일정인 경우 (ID가 series-로 시작)
    if (id.startsWith('series-')) {
      const parts = id.split('-');
      const seriesId = parts[1];
      const occurrenceTimestamp = parts[2];
      const occurrenceDate = new Date(parseInt(occurrenceTimestamp));
      const occurrenceDateStr = occurrenceDate.toISOString().split('T')[0];

      // 시리즈 조회하여 전체 완료 상태인지 확인
      const seriesCheck = await query('SELECT * FROM event_series WHERE id = $1', [seriesId]);

      if (seriesCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event series not found' });
      }
      if (!canEditEvent(req.user, seriesCheck.rows[0])) {
        return res.status(403).json({ success: false, message: '권한이 없습니다.' });
      }

      if (seriesCheck.rows[0].status === 'DONE') {
        // 전체 완료된 시리즈 → 전체를 PENDING으로 되돌림
        await transaction(async (client) => {
          await client.query(
            `UPDATE event_series SET status = 'PENDING', completed_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [seriesId]
          );
          await client.query(
            `UPDATE events SET status = 'PENDING', completed_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE series_id = $1 AND status = 'DONE'`,
            [seriesId]
          );
        });

        broadcast('event_changed', { action: 'uncompleted' });
        return res.json({
          success: true,
          message: 'All recurring events uncompleted'
        });
      }

      // 개별 완료된 예외 이벤트 삭제
      await transaction(async (client) => {
        await client.query(
          `DELETE FROM events
           WHERE series_id = $1 AND is_exception = true AND DATE(start_at) = $2`,
          [seriesId, occurrenceDateStr]
        );

        await client.query(
          `DELETE FROM event_exceptions WHERE series_id = $1 AND exception_date = $2`,
          [seriesId, occurrenceDateStr]
        );
      });

      broadcast('event_changed', { action: 'uncompleted' });
      return res.json({
        success: true,
        message: 'Event uncompleted'
      });
    }

    // 일반 일정인 경우 - 권한 체크
    const uncompleteCheck = await query('SELECT * FROM events WHERE id = $1', [id]);
    if (uncompleteCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (!canEditEvent(req.user, uncompleteCheck.rows[0])) {
      return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    }

    const result = await query(
      `UPDATE events SET status = 'PENDING', completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );

    const event = result.rows[0];

    // 완료 취소된 이벤트에 리마인더 재스케줄링
    try {
      await scheduleEventReminder(event.id, event.start_at, event.end_at, event.creator_id);
    } catch (qErr) {
      console.error('[Queue] Failed to reschedule reminder:', qErr.message);
    }

    broadcast('event_changed', { action: 'uncompleted' });
    res.json({
      success: true,
      message: 'Event uncompleted',
      data: { event: formatEventRow(event) }
    });
  } catch (error) {
    console.error('Uncomplete event error:', error);
    res.status(500).json({ success: false, message: 'Failed to uncomplete event' });
  }
};

/**
 * 일정 검색
 */
exports.searchEvents = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const userOfficeId = req.user.officeId;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '검색어는 2글자 이상 입력하세요.' }
      });
    }

    const escapedSearch = q.replace(/[%_\\]/g, '\\$&');
    const searchPattern = `%${escapedSearch}%`;

    // --- 일반 이벤트 검색 ---
    const evtScope = buildScopeFilter(req.user, 1, 'e', 'u');
    const evtShare = buildShareClause(req.user, 'event_id = e.id', evtScope.nextParamIdx);
    const evtSearchIdx = evtShare.nextParamIdx;

    const evtBaseWhere = `
      WHERE (${evtScope.clause}${evtShare.clause})
      AND e.series_id IS NULL
      AND (e.title ILIKE $${evtSearchIdx} OR e.content ILIKE $${evtSearchIdx})
    `;
    const evtBaseParams = [...evtScope.params, ...evtShare.params, searchPattern];

    const evtCountQuery = `SELECT COUNT(*) FROM events e JOIN users u ON e.creator_id = u.id ${evtBaseWhere}`;
    const evtDataQuery = `
      SELECT e.*,
             u.name as creator_name,
             d.name as department_name,
             o.name as office_name,
             dv.name as division_name
      FROM events e
      JOIN users u ON e.creator_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN offices o ON e.office_id = o.id
      LEFT JOIN divisions dv ON e.division_id = dv.id
      ${evtBaseWhere}
      ORDER BY e.created_at DESC
    `;

    // --- 시리즈 검색 ---
    const serScope = buildScopeFilter(req.user, 1, 'es', 'u');
    const serShare = buildShareClause(req.user, 'series_id = es.id', serScope.nextParamIdx);
    const serSearchIdx = serShare.nextParamIdx;

    const serBaseWhere = `
      WHERE (${serScope.clause}${serShare.clause})
      AND (es.title ILIKE $${serSearchIdx} OR es.content ILIKE $${serSearchIdx})
    `;
    const serBaseParams = [...serScope.params, ...serShare.params, searchPattern];

    const serCountQuery = `SELECT COUNT(*) FROM event_series es JOIN users u ON es.creator_id = u.id ${serBaseWhere}`;
    const serDataQuery = `
      SELECT es.*,
             u.name as creator_name
      FROM event_series es
      JOIN users u ON es.creator_id = u.id
      ${serBaseWhere}
      ORDER BY es.created_at DESC
    `;

    // 병렬 COUNT
    const [evtCountRes, serCountRes] = await Promise.all([
      query(evtCountQuery, evtBaseParams),
      query(serCountQuery, serBaseParams)
    ]);
    const evtTotal = parseInt(evtCountRes.rows[0].count);
    const serTotal = parseInt(serCountRes.rows[0].count);
    const total = evtTotal + serTotal;
    const totalPages = Math.ceil(total / limitNum);

    // 페이지네이션: 이벤트 우선, 이후 시리즈
    let results = [];
    if (offset < evtTotal) {
      const evtRemaining = limitNum;
      const evtOffset = offset;
      const evtLimitIdx = evtSearchIdx + 1;
      const evtOffsetIdx = evtSearchIdx + 2;
      const evtResult = await query(
        evtDataQuery + ` LIMIT $${evtLimitIdx} OFFSET $${evtOffsetIdx}`,
        [...evtBaseParams, evtRemaining, evtOffset]
      );
      results.push(...evtResult.rows.map(row => ({ ...row, _type: 'event' })));

      if (results.length < limitNum) {
        const serRemaining = limitNum - results.length;
        const serLimitIdx = serSearchIdx + 1;
        const serOffsetIdx = serSearchIdx + 2;
        const serResult = await query(
          serDataQuery + ` LIMIT $${serLimitIdx} OFFSET $${serOffsetIdx}`,
          [...serBaseParams, serRemaining, 0]
        );
        results.push(...serResult.rows.map(row => ({ ...row, _type: 'series' })));
      }
    } else {
      const serOffset = offset - evtTotal;
      const serLimitIdx = serSearchIdx + 1;
      const serOffsetIdx = serSearchIdx + 2;
      const serResult = await query(
        serDataQuery + ` LIMIT $${serLimitIdx} OFFSET $${serOffsetIdx}`,
        [...serBaseParams, limitNum, serOffset]
      );
      results.push(...serResult.rows.map(row => ({ ...row, _type: 'series' })));
    }

    // 포맷 변환
    // DB에 저장된 시간은 KST가 UTC로 잘못 해석된 상태이므로, 실제 UTC로 변환
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const now = new Date();
    const formattedEvents = results.map(row => {
      if (row._type === 'series') {
        const startTime = row.start_time || '09:00:00';
        const firstDate = row.first_occurrence_date
          ? new Date(row.first_occurrence_date).toISOString().split('T')[0]
          : new Date(row.created_at).toISOString().split('T')[0];
        const ts = new Date(`${firstDate}T${startTime}`).getTime();
        const endAtStr = row.end_time ? `${firstDate}T${row.end_time}` : null;
        const seriesStatus = row.status || 'PENDING';
        // 문자열로 만든 시간은 KST 의도이지만 서버(UTC)에서는 UTC로 해석됨 → 9시간 보정
        const seriesEndTime = endAtStr ? new Date(new Date(endAtStr).getTime() - KST_OFFSET_MS) : null;
        const isOverdue = seriesStatus !== 'DONE' && seriesEndTime && seriesEndTime < now;
        return {
          id: `series-${row.id}-${ts}`,
          title: row.title,
          content: row.content,
          startAt: `${firstDate}T${startTime}`,
          endAt: endAtStr,
          status: isOverdue ? 'OVERDUE' : seriesStatus,
          isRecurring: true,
          recurrenceType: row.recurrence_type,
          creator: { id: row.creator_id, name: row.creator_name },
          isOwner: row.creator_id === userId,
          canEdit: row.creator_id === userId || req.user.role === 'ADMIN',
          createdAt: toNaiveDateTimeString(row.created_at),
        };
      } else {
        // DB에서 가져온 TIMESTAMPTZ도 KST가 UTC로 잘못 해석된 상태 → 9시간 보정
        const eventEndTime = row.end_at ? new Date(new Date(row.end_at).getTime() - KST_OFFSET_MS) : null;
        const isEventOverdue = row.status !== 'DONE' && eventEndTime && eventEndTime < now;
        return {
          id: row.id,
          title: row.title,
          content: row.content,
          startAt: toNaiveDateTimeString(row.start_at),
          endAt: toNaiveDateTimeString(row.end_at),
          status: isEventOverdue ? 'OVERDUE' : row.status,
          isRecurring: false,
          creator: { id: row.creator_id, name: row.creator_name },
          isOwner: row.creator_id === userId,
          canEdit: row.creator_id === userId || req.user.role === 'ADMIN',
          department: row.department_name,
          office: row.office_name,
          division: row.division_name,
          createdAt: toNaiveDateTimeString(row.created_at),
        };
      }
    });

    res.json({
      success: true,
      data: {
        events: formattedEvents,
        pagination: { total, page: pageNum, limit: limitNum, totalPages }
      }
    });
  } catch (error) {
    console.error('Search events error:', error);
    res.status(500).json({ success: false, message: 'Failed to search events' });
  }
};

/**
 * 첨부파일 업로드
 */
exports.uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILES', message: '파일을 선택해주세요.' } });
    }

    // series-* ID 파싱
    let eventId = null;
    let seriesId = null;
    let occurrenceDate = null;
    const editType = req.body?.editType; // 'this' 또는 'all'

    if (String(id).startsWith('series-')) {
      const parts = id.split('-');
      seriesId = parseInt(parts[1]);
      // "이번만" 수정일 때만 occurrence_date 설정 (전체 수정은 NULL → 모든 occurrence에 표시)
      if (editType !== 'all' && parts[2]) {
        const ts = parseInt(parts[2]);
        if (!isNaN(ts)) {
          const d = new Date(ts);
          occurrenceDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        }
      }
      const seriesResult = await query('SELECT * FROM event_series WHERE id = $1', [seriesId]);
      if (seriesResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event series not found' });
      }
      if (!canEditEvent(req.user, seriesResult.rows[0])) {
        return res.status(403).json({ success: false, message: '첨부파일을 추가할 권한이 없습니다.' });
      }
    } else {
      eventId = parseInt(id);
      const eventResult = await query('SELECT * FROM events WHERE id = $1', [eventId]);
      if (eventResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      if (!canEditEvent(req.user, eventResult.rows[0])) {
        return res.status(403).json({ success: false, message: '첨부파일을 추가할 권한이 없습니다.' });
      }
    }

    // 기존 첨부파일 수 확인 (전체 + 해당 occurrence 합산)
    let countQuery, countParams;
    if (seriesId && occurrenceDate) {
      // "이번만" → 전체(NULL) + 해당날짜 합산
      countQuery = 'SELECT COUNT(*) as cnt FROM event_attachments WHERE series_id = $1 AND (occurrence_date IS NULL OR occurrence_date = $2)';
      countParams = [seriesId, occurrenceDate];
    } else if (seriesId) {
      // "전체" → 전체(NULL)만 카운트
      countQuery = 'SELECT COUNT(*) as cnt FROM event_attachments WHERE series_id = $1 AND occurrence_date IS NULL';
      countParams = [seriesId];
    } else {
      countQuery = 'SELECT COUNT(*) as cnt FROM event_attachments WHERE event_id = $1';
      countParams = [eventId];
    }
    const countResult = await query(countQuery, countParams);
    const existingCount = parseInt(countResult.rows[0].cnt);
    if (existingCount + files.length > 5) {
      // 업로드된 파일 삭제
      for (const file of files) {
        fs.unlink(file.path, () => {});
      }
      return res.status(400).json({
        success: false,
        error: { code: 'TOO_MANY_FILES', message: `최대 5개까지 첨부할 수 있습니다. (현재 ${existingCount}개)` }
      });
    }

    // DB에 저장
    const attachments = [];
    for (const file of files) {
      const result = await query(
        `INSERT INTO event_attachments (event_id, series_id, file_name, original_name, file_size, mime_type, uploaded_by, occurrence_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, original_name, file_size, mime_type, created_at`,
        [eventId, seriesId, file.filename, file.originalname, file.size, file.mimetype, userId, occurrenceDate]
      );
      const row = result.rows[0];
      attachments.push({
        id: row.id,
        originalName: row.original_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        createdAt: row.created_at,
      });
    }

    broadcast('event_changed', { action: 'updated' });
    res.status(201).json({ success: true, data: { attachments } });
  } catch (error) {
    console.error('Upload attachment error:', error);
    // 에러 시 업로드된 파일 정리
    if (req.files) {
      for (const file of req.files) {
        fs.unlink(file.path, () => {});
      }
    }
    res.status(500).json({ success: false, message: 'Failed to upload attachment' });
  }
};

/**
 * 첨부파일 다운로드
 */
exports.downloadAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const result = await query(
      'SELECT * FROM event_attachments WHERE id = $1',
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const attachment = result.rows[0];
    const filePath = path.join(UPLOADS_DIR, attachment.file_name);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    const encodedName = encodeURIComponent(attachment.original_name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ success: false, message: 'Failed to download attachment' });
  }
};

/**
 * 첨부파일 삭제
 */
exports.deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM event_attachments WHERE id = $1',
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const attachment = result.rows[0];

    // 권한 체크: 업로더 본인 또는 ADMIN
    if (attachment.uploaded_by !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }

    // DB 삭제
    await query('DELETE FROM event_attachments WHERE id = $1', [attachmentId]);

    // 파일 삭제
    const filePath = path.join(UPLOADS_DIR, attachment.file_name);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file:', err.message);
    });

    broadcast('event_changed', { action: 'updated' });
    res.json({ success: true, data: { message: '첨부파일이 삭제되었습니다.' } });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete attachment' });
  }
};
