// 에러 핸들러 미들웨어
const errorHandler = (err, req, res, next) => {
  // 프로덕션에서는 스택트레이스 제외, 개발에서만 전체 출력
  if (process.env.NODE_ENV === 'production') {
    console.error('에러 발생:', err.message);
  } else {
    console.error('에러 발생:', err);
  }

  // Validation 에러
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력값이 올바르지 않습니다.',
        details: err.errors
      }
    });
  }

  // JWT 에러
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_003',
        message: '토큰이 유효하지 않습니다.'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_004',
        message: '토큰이 만료되었습니다.'
      }
    });
  }

  // PostgreSQL 에러
  if (err.code) {
    // Unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: '이미 존재하는 데이터입니다.'
        }
      });
    }

    // Foreign key violation
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REFERENCE_ERROR',
          message: '참조 무결성 제약 조건 위반입니다.'
        }
      });
    }

    // Not null violation
    if (err.code === '23502') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NULL_ERROR',
          message: '필수 값이 누락되었습니다.'
        }
      });
    }
  }

  // 커스텀 에러
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'CUSTOM_ERROR',
        message: err.message
      }
    });
  }

  // 기본 500 에러
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? '서버 오류가 발생했습니다.' 
        : err.message
    }
  });
};

// 커스텀 에러 클래스
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = errorHandler;
module.exports.AppError = AppError;
