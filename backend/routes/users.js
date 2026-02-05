const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

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

    // 검색 조건
    if (search) {
      paramCount++;
      whereConditions.push(`(u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);
      params.push(`%${search}%`);
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

    // 직급에 따른 권한 설정
    let role = 'USER';
    let scope = null;

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
        scope = $7
      WHERE id = $8
      RETURNING id, email, name, position, role, scope
    `, [name, position, departmentId || null, officeId || null, divisionId || null, role, scope, id]);

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
