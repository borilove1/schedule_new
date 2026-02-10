const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ========== 조직 구조 전체 조회 ==========
router.get('/structure', async (req, res, next) => {
  try {
    // 1. 모든 본부 조회 (sort_order 순)
    const divisionsResult = await query('SELECT id, name, sort_order FROM divisions ORDER BY sort_order, id');
    const divisions = divisionsResult.rows;

    // 2. 모든 처 조회 (sort_order 순)
    const officesResult = await query('SELECT id, name, division_id, sort_order FROM offices ORDER BY sort_order, id');
    const offices = officesResult.rows;

    // 3. 모든 부서 조회 (sort_order 순)
    const departmentsResult = await query('SELECT id, name, office_id, sort_order FROM departments ORDER BY sort_order, id');
    const departments = departmentsResult.rows;

    // 4. 구조화된 데이터 생성 (ID 포함)
    const structure = {
      divisions: divisions.map(d => ({ id: d.id, name: d.name })),
      offices: {},
      departments: {}
    };

    // 본부별 처 매핑
    divisions.forEach(division => {
      const divisionOffices = offices
        .filter(o => o.division_id === division.id)
        .map(o => ({ id: o.id, name: o.name }));
      structure.offices[division.name] = divisionOffices;
    });

    // 처별 부서 매핑 (동명의 처가 여러 본부에 있을 수 있으므로 기존 배열에 병합)
    offices.forEach(office => {
      const officeDepartments = departments
        .filter(d => d.office_id === office.id)
        .map(d => ({ id: d.id, name: d.name }));
      if (structure.departments[office.name]) {
        structure.departments[office.name] = structure.departments[office.name].concat(officeDepartments);
      } else {
        structure.departments[office.name] = officeDepartments;
      }
    });

    res.json({
      success: true,
      organization: structure
    });

  } catch (error) {
    next(error);
  }
});

// ========== 본부 목록 ==========
router.get('/divisions', async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, sort_order FROM divisions ORDER BY sort_order, id');
    
    res.json({
      success: true,
      divisions: result.rows
    });

  } catch (error) {
    next(error);
  }
});

// ========== 처 목록 (본부 필터링) ==========
router.get('/offices', async (req, res, next) => {
  try {
    const { divisionId } = req.query;

    let sqlQuery = 'SELECT id, name, division_id, sort_order FROM offices';
    let params = [];

    if (divisionId) {
      sqlQuery += ' WHERE division_id = $1';
      params.push(divisionId);
    }

    sqlQuery += ' ORDER BY sort_order, id';

    const result = await query(sqlQuery, params);
    
    res.json({
      success: true,
      offices: result.rows
    });

  } catch (error) {
    next(error);
  }
});

// ========== 부서 목록 (처 필터링) ==========
router.get('/departments', async (req, res, next) => {
  try {
    const { officeId } = req.query;

    let sqlQuery = 'SELECT id, name, office_id, sort_order FROM departments';
    let params = [];

    if (officeId) {
      sqlQuery += ' WHERE office_id = $1';
      params.push(officeId);
    }

    sqlQuery += ' ORDER BY sort_order, id';

    const result = await query(sqlQuery, params);
    
    res.json({
      success: true,
      departments: result.rows
    });

  } catch (error) {
    next(error);
  }
});

// ========== 본부 생성 (Admin) ==========
router.post('/divisions', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '본부 이름을 입력하세요.'
        }
      });
    }

    const result = await query(
      'INSERT INTO divisions (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING *',
      [name]
    );

    res.status(201).json({
      success: true,
      division: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_NAME',
          message: '이미 존재하는 본부 이름입니다.'
        }
      });
    }
    next(error);
  }
});

// ========== 처 생성 (Admin) ==========
router.post('/offices', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { name, divisionId } = req.body;

    if (!name || !divisionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '처 이름과 본부를 선택하세요.'
        }
      });
    }

    const result = await query(
      'INSERT INTO offices (name, division_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
      [name, divisionId]
    );

    res.status(201).json({
      success: true,
      office: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_NAME',
          message: '이미 존재하는 처 이름입니다.'
        }
      });
    }
    next(error);
  }
});

// ========== 부서 생성 (Admin) ==========
router.post('/departments', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { name, officeId } = req.body;

    if (!name || !officeId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '부서 이름과 처를 선택하세요.'
        }
      });
    }

    const result = await query(
      'INSERT INTO departments (name, office_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
      [name, officeId]
    );

    res.status(201).json({
      success: true,
      department: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_NAME',
          message: '이미 존재하는 부서 이름입니다.'
        }
      });
    }
    next(error);
  }
});

// ========== 본부 수정 (Admin) ==========
router.put('/divisions/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '본부 이름을 입력하세요.' }
      });
    }

    const result = await query(
      'UPDATE divisions SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '본부를 찾을 수 없습니다.' }
      });
    }

    res.json({ success: true, division: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_NAME', message: '이미 존재하는 본부 이름입니다.' }
      });
    }
    next(error);
  }
});

// ========== 본부 삭제 (Admin) ==========
router.delete('/divisions/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 소속 사용자 확인
    const usersCheck = await query('SELECT COUNT(*) as count FROM users WHERE division_id = $1', [id]);
    if (parseInt(usersCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_USERS',
          message: `${usersCheck.rows[0].count}명의 사용자가 이 본부에 소속되어 있습니다. 먼저 사용자를 다른 본부로 이동하세요.`
        }
      });
    }

    const result = await query('DELETE FROM divisions WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '본부를 찾을 수 없습니다.' }
      });
    }

    res.json({ success: true, data: { message: '본부가 삭제되었습니다.' } });
  } catch (error) {
    next(error);
  }
});

// ========== 처 수정 (Admin) ==========
router.put('/offices/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, divisionId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '처 이름을 입력하세요.' }
      });
    }

    const updateFields = ['name = $1', 'updated_at = NOW()'];
    const params = [name];
    let paramCount = 1;

    if (divisionId) {
      paramCount++;
      updateFields.push(`division_id = $${paramCount}`);
      params.push(divisionId);
    }

    paramCount++;
    params.push(id);

    const result = await query(
      `UPDATE offices SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '처를 찾을 수 없습니다.' }
      });
    }

    res.json({ success: true, office: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_NAME', message: '이미 존재하는 처 이름입니다.' }
      });
    }
    next(error);
  }
});

// ========== 처 삭제 (Admin) ==========
router.delete('/offices/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const usersCheck = await query('SELECT COUNT(*) as count FROM users WHERE office_id = $1', [id]);
    if (parseInt(usersCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_USERS',
          message: `${usersCheck.rows[0].count}명의 사용자가 이 처에 소속되어 있습니다. 먼저 사용자를 다른 처로 이동하세요.`
        }
      });
    }

    const result = await query('DELETE FROM offices WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '처를 찾을 수 없습니다.' }
      });
    }

    res.json({ success: true, data: { message: '처가 삭제되었습니다.' } });
  } catch (error) {
    next(error);
  }
});

// ========== 부서 수정 (Admin) ==========
router.put('/departments/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, officeId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '부서 이름을 입력하세요.' }
      });
    }

    const updateFields = ['name = $1', 'updated_at = NOW()'];
    const params = [name];
    let paramCount = 1;

    if (officeId) {
      paramCount++;
      updateFields.push(`office_id = $${paramCount}`);
      params.push(officeId);
    }

    paramCount++;
    params.push(id);

    const result = await query(
      `UPDATE departments SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '부서를 찾을 수 없습니다.' }
      });
    }

    res.json({ success: true, department: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_NAME', message: '이미 존재하는 부서 이름입니다.' }
      });
    }
    next(error);
  }
});

// ========== 부서 삭제 (Admin) ==========
router.delete('/departments/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const usersCheck = await query('SELECT COUNT(*) as count FROM users WHERE department_id = $1', [id]);
    if (parseInt(usersCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_USERS',
          message: `${usersCheck.rows[0].count}명의 사용자가 이 부서에 소속되어 있습니다. 먼저 사용자를 다른 부서로 이동하세요.`
        }
      });
    }

    const result = await query('DELETE FROM departments WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '부서를 찾을 수 없습니다.' }
      });
    }

    res.json({ success: true, data: { message: '부서가 삭제되었습니다.' } });
  } catch (error) {
    next(error);
  }
});

// ========== 부서 순서 변경 (Admin) ==========
router.patch('/departments/reorder', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { orders } = req.body; // [{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }, ...]

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '순서 정보가 필요합니다.' }
      });
    }

    // 각 부서의 순서 업데이트
    for (const item of orders) {
      await query(
        'UPDATE departments SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [item.sortOrder, item.id]
      );
    }

    res.json({ success: true, message: '부서 순서가 변경되었습니다.' });
  } catch (error) {
    next(error);
  }
});

// ========== 처/실 순서 변경 (Admin) ==========
router.patch('/offices/reorder', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '순서 정보가 필요합니다.' }
      });
    }

    for (const item of orders) {
      await query(
        'UPDATE offices SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [item.sortOrder, item.id]
      );
    }

    res.json({ success: true, message: '처/실 순서가 변경되었습니다.' });
  } catch (error) {
    next(error);
  }
});

// ========== 본부 순서 변경 (Admin) ==========
router.patch('/divisions/reorder', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '순서 정보가 필요합니다.' }
      });
    }

    for (const item of orders) {
      await query(
        'UPDATE divisions SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [item.sortOrder, item.id]
      );
    }

    res.json({ success: true, message: '본부 순서가 변경되었습니다.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
