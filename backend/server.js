require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');

// 라우터 임포트
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const eventRoutes = require('./routes/events');
const commentRoutes = require('./routes/comments');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');

// 미들웨어 임포트
const errorHandler = require('./middleware/errorHandler');

// 서비스 임포트
const { checkAllUpcomingEvents } = require('./src/utils/reminderService');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret 강도 검증
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('change-this')) {
  console.warn('⚠️  경고: JWT_SECRET이 안전하지 않습니다. 64자 이상의 랜덤 문자열로 교체하세요.');
  console.warn('   생성: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ 프로덕션 환경에서는 안전한 JWT_SECRET이 필수입니다.');
    process.exit(1);
  }
}

// ========== 미들웨어 설정 ==========

// Nginx 리버스 프록시 뒤에서 실제 클라이언트 IP 사용 (Rate Limit 정확성)
app.set('trust proxy', 1);

// 보안 헤더 (helmet 상세 설정)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS 설정 (허용 메서드 및 헤더 명시)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Body Parser (1MB 제한 - 일정 관리 앱에 충분)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 압축
app.use(compression());

// 로깅
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' } }
});
app.use('/api/v1/auth/login', loginLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' } }
});
app.use('/api/v1/auth', authLimiter);

const eventsLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' } }
});
app.use('/api/v1/events', eventsLimiter);

const commentsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' } }
});
app.use('/api/v1/comments', commentsLimiter);

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
app.use('/api/v1/notifications', notificationRoutes);

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

  // ========== Cron Jobs 시작 ==========

  // 일정 리마인더 체크 - 매시간 정각에 실행
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Checking upcoming events for reminders...');
    try {
      const result = await checkAllUpcomingEvents(24); // 24시간 이내 일정 체크
      console.log(`[Cron] Reminder check completed: ${result.totalCount} notifications created`);
    } catch (error) {
      console.error('[Cron] Failed to check reminders:', error);
    }
  });

  // 추가: 매일 오전 9시에도 체크 (중요한 알림을 놓치지 않도록)
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Daily reminder check at 9 AM...');
    try {
      const result = await checkAllUpcomingEvents(24);
      console.log(`[Cron] Daily reminder check completed: ${result.totalCount} notifications created`);
    } catch (error) {
      console.error('[Cron] Failed to check daily reminders:', error);
    }
  });

  console.log('✅ Cron jobs started:');
  console.log('   - Hourly reminder check: 0 * * * * (every hour)');
  console.log('   - Daily reminder check: 0 9 * * * (9 AM daily)');
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
