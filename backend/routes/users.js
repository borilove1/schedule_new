const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../src/controllers/notificationController');

const router = express.Router();

// 모든 라우트에 인증 필요
router.use(authenticate);

// ========== 사용자 목록 조회 ==========
router.get('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { 
      search, 
      role, 
      departmentId, 
      officeId, 
      divisionId,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    // 검색 조건 (ILIKE 와일드카드 이스케이핑)
    if (search) {
      paramCount++;
      const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
      whereConditions.push(`(u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);
      params.push(`%${escapedSearch}%`);
    }

    if (role) {
      paramCount++;
      whereConditions.push(`u.role = $${paramCount}`);
      params.push(role);
    }

    if (departmentId) {
      paramCount++;
      whereConditions.push(`u.department_id = $${paramCount}`);
      params.push(departmentId);
    }

    if (officeId) {
      paramCount++;
      whereConditions.push(`u.office_id = $${paramCount}`);
      params.push(officeId);
    }

    if (divisionId) {
      paramCount++;
      whereConditions.push(`u.division_id = $${paramCount}`);
      params.push(divisionId);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // 전체 개수 조회
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);

    // 사용자 목록 조회
    params.push(limit, offset);
    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.position,
        u.role,
        u.scope,
        d.name AS department,
        o.name AS office,
        div.name AS division,
        u.is_active,
        u.approved_at,
        u.last_login_at,
        u.created_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN offices o ON u.office_id = o.id
      LEFT JOIN divisions div ON u.division_id = div.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 승인 대기 사용자 수 ==========
router.get('/pending-count', authorize('ADMIN'), async (req, res, next) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM users WHERE is_active = false AND approved_at IS NULL'
    );
    res.json({
      success: true,
      data: { count: parseInt(result.rows[0].count) }
    });
  } catch (error) {
    next(error);
  }
});

// ========== 사용자 상세 조회 ==========
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // ADMIN이 아니면 본인만 조회 가능
    if (req.user.role !== 'ADMIN' && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_005',
          message: '권한이 없습니다.'
        }
      });
    }

    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.position,
        u.role,
        u.scope,
        d.name AS department,
        o.name AS office,
        div.name AS division,
        u.is_active,
        u.approved_at,
        u.last_login_at,
        u.created_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN offices o ON u.office_id = o.id
      LEFT JOIN divisions div ON u.division_id = div.id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_001',
          message: '사용자를 찾을 수 없습니다.'
        }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// ========== 사용자 활성화/비활성화 토글 ==========
router.patch('/:id/toggle-active', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 본인 비활성화 방지
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_004',
          message: '본인 계정은 비활성화할 수 없습니다.'
        }
      });
    }

    const result = await query(
      'UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_001', message: '사용자를 찾을 수 없습니다.' }
      });
    }

    // 활성화 시 approved_at이 없으면 자동 설정
    if (result.rows[0].is_active) {
      await query(
        'UPDATE users SET approved_at = COALESCE(approved_at, NOW()) WHERE id = $1',
        [id]
      );
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// ========== 사용자 승인 ==========
router.patch('/:id/approve', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE users SET is_active = true, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND is_active = false AND approved_at IS NULL
       RETURNING id, name, email, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_005', message: '승인 대상 사용자를 찾을 수 없습니다.' }
      });
    }

    // 승인된 사용자에게 알림 발송
    try {
      await createNotification(
        parseInt(id),
        'ACCOUNT_APPROVED',
        '계정 승인 완료',
        '관리자가 계정을 승인했습니다. 이제 로그인할 수 있습니다.',
        null,
        null
      );
    } catch (notifErr) {
      console.error('Failed to notify user:', notifErr);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ========== 사용자 수정 ==========
router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, position, departmentId, officeId, divisionId } = req.body;

    // 사용자 존재 확인
    const existingUser = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_001',
          message: '사용자를 찾을 수 없습니다.'
        }
      });
    }

    // 명시적 role/scope가 전달되면 해당 값 사용, 아니면 직급 기반 자동 파생
    let role = req.body.role;
    let scope = req.body.scope;

    if (!role) {
      role = 'USER';
      scope = null;

      if (position === '부장') {
        role = 'DEPT_LEAD';
        scope = 'DEPARTMENT';
      } else if (position === '실장' || position === '처장') {
        role = 'DEPT_LEAD';
        scope = 'OFFICE';
      } else if (position === '본부장') {
        role = 'DEPT_LEAD';
        scope = 'DIVISION';
      } else if (position === '관리자') {
        role = 'ADMIN';
        scope = null;
      }
    } else {
      // role이 명시적으로 전달된 경우 scope 검증
      if (role === 'USER') {
        scope = null;
      } else if (role === 'ADMIN') {
        scope = scope || null;
      } else if (role === 'DEPT_LEAD' && !scope) {
        scope = 'DEPARTMENT'; // 기본 scope
      }
    }

    // 사용자 정보 업데이트
    const result = await query(`
      UPDATE users
      SET
        name = $1,
        position = $2,
        department_id = $3,
        office_id = $4,
        division_id = $5,
        role = $6,
        scope = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING id, email, name, position, role, scope
    `, [name, position, departmentId || null, officeId || null, divisionId || null, role, scope || null, id]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// ========== 사용자 삭제 ==========
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 본인 삭제 방지
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_003',
          message: '본인 계정은 삭제할 수 없습니다.'
        }
      });
    }

    // 사용자 존재 확인
    const existingUser = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_001',
          message: '사용자를 찾을 수 없습니다.'
        }
      });
    }

    // 사용자 삭제 (CASCADE로 관련 데이터도 삭제됨)
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      success: true,
      data: {
        message: '사용자가 삭제되었습니다.'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
