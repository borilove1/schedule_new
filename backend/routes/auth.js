const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { generateToken, authenticate } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../src/controllers/notificationController');

const router = express.Router();

// ========== 회원가입 ==========
router.post('/register',
  [
    body('email').isEmail().withMessage('유효한 이메일을 입력하세요'),
    body('password')
      .isLength({ min: 8 }).withMessage('비밀번호는 최소 8자 이상이어야 합니다')
      .matches(/(?=.*[a-zA-Z])(?=.*\d)/).withMessage('비밀번호는 영문과 숫자를 모두 포함해야 합니다'),
    body('name').notEmpty().withMessage('이름을 입력하세요'),
    body('position').notEmpty().withMessage('직급을 선택하세요'),
    body('division').notEmpty().withMessage('본부를 선택하세요'),
    body('office').notEmpty().withMessage('처를 선택하세요'),
    body('department').optional({ values: 'falsy' })
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

      // 3. department_id 찾기 (office_id로 필터링, 부서가 없는 처/지사는 null)
      let department_id = null;
      if (department) {
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

        department_id = departmentResult.rows[0].id;
      }

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(password, 10);

      // 사용자 생성 (is_active = false: 관리자 승인 필요)
      const result = await query(
        `INSERT INTO users (email, password_hash, name, position, division_id, office_id, department_id, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'USER', false, NOW(), NOW())
         RETURNING id, email, name, position, role`,
        [email, hashedPassword, name, position, division_id, office_id, department_id]
      );

      const user = result.rows[0];

      // 관리자에게 승인 요청 알림 발송
      try {
        const adminUsers = await query(
          "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = true"
        );
        for (const admin of adminUsers.rows) {
          await createNotification(
            admin.id,
            'USER_REGISTERED',
            '새 사용자 가입 승인 요청',
            `${name} (${email})님이 회원가입했습니다. 승인이 필요합니다.`,
            null,
            { userId: user.id, userName: name, userEmail: email }
          );
        }
      } catch (notifErr) {
        console.error('Failed to notify admins:', notifErr);
      }

      res.status(201).json({
        success: true,
        requiresApproval: true,
        message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인이 가능합니다.'
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
          u.division_id, u.office_id, u.department_id,
          u.is_active, u.approved_at,
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

      // 계정 활성화 상태 확인
      if (!user.is_active) {
        if (!user.approved_at) {
          // 관리자 승인 대기 중
          return res.status(403).json({
            success: false,
            error: {
              code: 'AUTH_006',
              message: '관리자 승인 후 로그인이 가능합니다.'
            }
          });
        } else {
          // 관리자가 비활성화한 계정
          return res.status(403).json({
            success: false,
            error: {
              code: 'AUTH_007',
              message: '계정이 비활성화되었습니다. 관리자에게 문의하세요.'
            }
          });
        }
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
          divisionId: user.division_id,
          officeId: user.office_id,
          departmentId: user.department_id,
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
        u.division_id, u.office_id, u.department_id,
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
        divisionId: user.division_id,
        officeId: user.office_id,
        departmentId: user.department_id,
        role: user.role
      }
    });

  } catch (error) {
    next(error);
  }
});

// ========== 비밀번호 변경 ==========
router.put('/change-password', authenticate,
  [
    body('currentPassword').notEmpty().withMessage('현재 비밀번호를 입력하세요'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('새 비밀번호는 최소 8자 이상이어야 합니다.')
      .matches(/(?=.*[a-zA-Z])(?=.*\d)/).withMessage('새 비밀번호는 영문과 숫자를 모두 포함해야 합니다.')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: errors.array()[0].msg
          }
        });
      }

      const { currentPassword, newPassword } = req.body;

      // 현재 비밀번호 확인
      const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: '현재 비밀번호가 올바르지 않습니다.'
          }
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, req.user.id]);

      res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
    } catch (error) {
      next(error);
    }
  }
);

// ========== 내 정보 수정 ==========
router.put('/me', authenticate,
  [
    body('name').notEmpty().withMessage('이름을 입력하세요'),
    body('position').notEmpty().withMessage('직급을 선택하세요'),
    body('division').notEmpty().withMessage('본부를 선택하세요'),
    body('office').notEmpty().withMessage('처를 선택하세요')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: errors.array()[0].msg
          }
        });
      }

      const { name, position, division, office, department } = req.body;

      // 조직 ID 조회
      const divisionResult = await query('SELECT id FROM divisions WHERE name = $1', [division]);
      if (divisionResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_DIVISION', message: '유효하지 않은 본부입니다.' }
        });
      }
      const division_id = divisionResult.rows[0].id;

      const officeResult = await query('SELECT id FROM offices WHERE name = $1 AND division_id = $2', [office, division_id]);
      if (officeResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_OFFICE', message: '유효하지 않은 처입니다.' }
        });
      }
      const office_id = officeResult.rows[0].id;

      let department_id = null;
      if (department) {
        const deptResult = await query('SELECT id FROM departments WHERE name = $1 AND office_id = $2', [department, office_id]);
        if (deptResult.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_DEPARTMENT', message: '유효하지 않은 부서입니다.' }
          });
        }
        department_id = deptResult.rows[0].id;
      }

      await query(
        `UPDATE users SET name = $1, position = $2, division_id = $3, office_id = $4, department_id = $5, updated_at = NOW()
         WHERE id = $6`,
        [name, position, division_id, office_id, department_id, req.user.id]
      );

      // 업데이트된 정보 반환
      const result = await query(
        `SELECT u.id, u.email, u.name, u.position, u.role,
          u.division_id, u.office_id, u.department_id,
          d.name as division, o.name as office, dept.name as department
         FROM users u
         LEFT JOIN divisions d ON u.division_id = d.id
         LEFT JOIN offices o ON u.office_id = o.id
         LEFT JOIN departments dept ON u.department_id = dept.id
         WHERE u.id = $1`,
        [req.user.id]
      );

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
          divisionId: user.division_id,
          officeId: user.office_id,
          departmentId: user.department_id,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
