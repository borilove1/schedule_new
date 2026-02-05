require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
// const rateLimit = require('express-rate-limit'); // 임시 비활성화

// 라우터 임포트
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const eventRoutes = require('./routes/events');
const commentRoutes = require('./routes/comments');
const settingsRoutes = require('./routes/settings');

// 미들웨어 임포트
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== 미들웨어 설정 ==========

// 보안 헤더
app.use(helmet());

// CORS 설정
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 압축
app.use(compression());

// 로깅
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate Limiting - 임시 비활성화 (중복 클릭 문제 해결 후 재활성화 필요)
// TODO: 프론트엔드 중복 클릭 방지 확인 후 다시 활성화
/*
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
});
app.use('/api/v1/auth', limiter);

const eventsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/events', eventsLimiter);
*/

// ========== 라우트 설정 ==========

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API 라우트
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/settings', settingsRoutes);

// 404 처리
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '요청하신 리소스를 찾을 수 없습니다.'
    }
  });
});

// 에러 핸들러
app.use(errorHandler);

// ========== 서버 시작 ==========

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   업무일정 관리 시스템 API 서버          ║
╠═══════════════════════════════════════════╣
║   Environment: ${process.env.NODE_ENV?.padEnd(27) || 'development'.padEnd(27)}║
║   Port: ${PORT.toString().padEnd(34)}║
║   URL: http://localhost:${PORT.toString().padEnd(22)}║
╚═══════════════════════════════════════════╝
  `);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT 신호를 받았습니다. 서버를 종료합니다...');
  process.exit(0);
});

module.exports = app;
