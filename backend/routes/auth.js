const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { generateToken, authenticate } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// ========== 회원가입 ==========
router.post('/register',
  [
    body('email').isEmail().withMessage('유효한 이메일을 입력하세요'),
    body('password').isLength({ min: 4 }).withMessage('비밀번호는 최소 4자 이상이어야 합니다'),
    body('name').notEmpty().withMessage('이름을 입력하세요'),
    body('position').notEmpty().withMessage('직급을 선택하세요'),
    body('division').notEmpty().withMessage('본부를 선택하세요'),
    body('office').notEmpty().withMessage('처를 선택하세요'),
    body('department').notEmpty().withMessage('부서를 선택하세요')
  ],
  async (req, res, next) => {
    try {
      // Validation 체크
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '입력값이 올바르지 않습니다.',
            details: errors.array()
          }
        });
      }

      const { email, password, name, position, division, office, department } = req.body;

      // 이메일 중복 체크
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: '이미 사용 중인 이메일입니다.'
          }
        });
      }

      // 1. division_id 찾기
      const divisionResult = await query(
        'SELECT id FROM divisions WHERE name = $1',
        [division]
      );

      if (divisionResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DIVISION',
            message: '유효하지 않은 본부입니다.'
          }
        });
      }

      const division_id = divisionResult.rows[0].id;

      // 2. office_id 찾기 (division_id로 필터링)
      const officeResult = await query(
        'SELECT id FROM offices WHERE name = $1 AND division_id = $2',
        [office, division_id]
      );

      if (officeResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OFFICE',
            message: '유효하지 않은 처입니다.'
          }
        });
      }

      const office_id = officeResult.rows[0].id;

      // 3. department_id 찾기 (office_id로 필터링)
      const departmentResult = await query(
        'SELECT id FROM departments WHERE name = $1 AND office_id = $2',
        [department, office_id]
      );

      if (departmentResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEPARTMENT',
            message: '유효하지 않은 부서입니다.'
          }
        });
      }

      const department_id = departmentResult.rows[0].id;

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(password, 10);

      // 사용자 생성
      const result = await query(
        `INSERT INTO users (email, password_hash, name, position, division_id, office_id, department_id, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'USER', NOW(), NOW())
         RETURNING id, email, name, position, role`,
        [email, hashedPassword, name, position, division_id, office_id, department_id]
      );

      const user = result.rows[0];

      // JWT 토큰 생성
      const token = generateToken(user.id);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          position: user.position,
          division: division,
          office: office,
          department: department,
          role: user.role
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// ========== 로그인 ==========
router.post('/login',
  [
    body('email').isEmail().withMessage('유효한 이메일을 입력하세요'),
    body('password').notEmpty().withMessage('비밀번호를 입력하세요')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '입력값이 올바르지 않습니다.',
            details: errors.array()
          }
        });
      }

      const { email, password } = req.body;

      // 사용자 조회 (JOIN으로 이름까지 가져오기)
      const result = await query(
        `SELECT
          u.id, u.email, u.password_hash, u.name, u.position, u.role,
          d.name as division,
          o.name as office,
          dept.name as department
         FROM users u
         LEFT JOIN divisions d ON u.division_id = d.id
         LEFT JOIN offices o ON u.office_id = o.id
         LEFT JOIN departments dept ON u.department_id = dept.id
         WHERE u.email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '이메일 또는 비밀번호가 올바르지 않습니다.'
          }
        });
      }

      const user = result.rows[0];

      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '이메일 또는 비밀번호가 올바르지 않습니다.'
          }
        });
      }

      // JWT 토큰 생성
      const token = generateToken(user.id);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          position: user.position,
          division: user.division,
          office: user.office,
          department: user.department,
          role: user.role
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// ========== 로그아웃 ==========
router.post('/logout', authenticate, async (req, res) => {
  // JWT는 stateless이므로 클라이언트에서 토큰 삭제
  res.json({
    success: true,
    message: '로그아웃되었습니다.'
  });
});

// ========== 현재 사용자 정보 ==========
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT 
        u.id, u.email, u.name, u.position, u.role,
        d.name as division,
        o.name as office,
        dept.name as department
       FROM users u
       LEFT JOIN divisions d ON u.division_id = d.id
       LEFT JOIN offices o ON u.office_id = o.id
       LEFT JOIN departments dept ON u.department_id = dept.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404, 'USER_NOT_FOUND');
    }

    const user = result.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        position: user.position,
        division: user.division,
        office: user.office,
        department: user.department,
        role: user.role
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
