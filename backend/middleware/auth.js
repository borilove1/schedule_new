const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// JWT 토큰 생성
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// JWT 토큰 검증
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// 인증 미들웨어
const authenticate = async (req, res, next) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: '토큰이 제공되지 않았습니다.'
        }
      });
    }

    const token = authHeader.substring(7); // 'Bearer ' 제거
    
    // 토큰 검증
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_004',
          message: '토큰이 유효하지 않거나 만료되었습니다.'
        }
      });
    }

    // 사용자 정보 조회
    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.position,
        u.role,
        u.scope,
        u.department_id,
        u.office_id,
        u.division_id,
        d.name AS department_name,
        o.name AS office_name,
        div.name AS division_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN offices o ON u.office_id = o.id
      LEFT JOIN divisions div ON u.division_id = div.id
      WHERE u.id = $1 AND u.is_active = true
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_001',
          message: '사용자를 찾을 수 없습니다.'
        }
      });
    }

    // req.user에 사용자 정보 저장
    req.user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      position: result.rows[0].position,
      role: result.rows[0].role,
      scope: result.rows[0].scope,
      departmentId: result.rows[0].department_id,
      officeId: result.rows[0].office_id,
      divisionId: result.rows[0].division_id,
      department: result.rows[0].department_name,
      office: result.rows[0].office_name,
      division: result.rows[0].division_name
    };

    next();
  } catch (error) {
    console.error('인증 미들웨어 오류:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SYS_001',
        message: '서버 오류가 발생했습니다.'
      }
    });
  }
};

// 권한 체크 미들웨어
const authorize = (...roles) => {
  const flatRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: '인증이 필요합니다.'
        }
      });
    }

    if (!flatRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_005',
          message: '권한이 없습니다.'
        }
      });
    }

    next();
  };
};

// 일정 조회 권한 체크
// event.sharedOfficeIds: 공유된 처/실 ID 배열 (optional)
const canViewEvent = (user, event) => {
  // ADMIN은 모든 일정 조회 가능
  if (user.role === 'ADMIN') return true;

  // DEPT_LEAD는 scope에 따라 조회
  if (user.role === 'DEPT_LEAD') {
    if (user.scope === 'DIVISION') {
      return event.divisionId === user.divisionId;
    }
    if (user.scope === 'OFFICE') {
      if (event.officeId === user.officeId && event.divisionId === user.divisionId) return true;
      // 공유된 처/실 확인
      if (event.sharedOfficeIds && event.sharedOfficeIds.includes(user.officeId)) return true;
      return false;
    }
    if (user.scope === 'DEPARTMENT') {
      if (event.departmentId === user.departmentId) return true;
      // 공유된 처/실 확인
      if (event.sharedOfficeIds && event.sharedOfficeIds.includes(user.officeId)) return true;
      return false;
    }
  }

  // USER는 같은 부서 또는 공유된 처/실 일정 조회
  if (event.departmentId === user.departmentId) return true;
  if (event.sharedOfficeIds && event.sharedOfficeIds.includes(user.officeId)) return true;
  return false;
};

// 일정 수정/삭제 권한 체크
const canEditEvent = (user, event) => {
  // 본인이 작성한 일정
  if (event.creatorId === user.id) return true;

  // ADMIN은 모든 일정 수정 가능
  if (user.role === 'ADMIN') return true;

  // DEPT_LEAD는 scope 내 일정 수정 가능
  if (user.role === 'DEPT_LEAD') {
    if (user.scope === 'DIVISION') {
      return event.divisionId === user.divisionId;
    }
    if (user.scope === 'OFFICE') {
      return event.officeId === user.officeId;
    }
    if (user.scope === 'DEPARTMENT') {
      return event.departmentId === user.departmentId;
    }
  }

  return false;
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  authorize,
  canViewEvent,
  canEditEvent
};
