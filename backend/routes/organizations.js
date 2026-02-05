const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ========== 조직 구조 전체 조회 ==========
router.get('/structure', async (req, res, next) => {
  try {
    // 1. 모든 본부 조회
    const divisionsResult = await query('SELECT id, name FROM divisions ORDER BY id');
    const divisions = divisionsResult.rows;

    // 2. 모든 처 조회
    const officesResult = await query('SELECT id, name, division_id FROM offices ORDER BY id');
    const offices = officesResult.rows;

    // 3. 모든 부서 조회
    const departmentsResult = await query('SELECT id, name, office_id FROM departments ORDER BY id');
    const departments = departmentsResult.rows;

    // 4. 구조화된 데이터 생성
    const structure = {
      divisions: divisions.map(d => d.name),
      offices: {},
      departments: {}
    };

    // 본부별 처 매핑
    divisions.forEach(division => {
      const divisionOffices = offices
        .filter(o => o.division_id === division.id)
        .map(o => o.name);
      structure.offices[division.name] = divisionOffices;
    });

    // 처별 부서 매핑
    offices.forEach(office => {
      const officeDepartments = departments
        .filter(d => d.office_id === office.id)
        .map(d => d.name);
      structure.departments[office.name] = officeDepartments;
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
    const result = await query('SELECT id, name FROM divisions ORDER BY id');
    
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
    
    let sqlQuery = 'SELECT id, name, division_id FROM offices';
    let params = [];

    if (divisionId) {
      sqlQuery += ' WHERE division_id = $1';
      params.push(divisionId);
    }

    sqlQuery += ' ORDER BY id';

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
    
    let sqlQuery = 'SELECT id, name, office_id FROM departments';
    let params = [];

    if (officeId) {
      sqlQuery += ' WHERE office_id = $1';
      params.push(officeId);
    }

    sqlQuery += ' ORDER BY id';

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

module.exports = router;
