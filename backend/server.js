require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const PgBoss = require('pg-boss');
const rateLimit = require('express-rate-limit');

// 라우터 임포트
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const eventRoutes = require('./routes/events');
const commentRoutes = require('./routes/comments');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const pushRoutes = require('./routes/push');
const { handleSSEConnection } = require('./src/utils/sseManager');

// 미들웨어 임포트
const errorHandler = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

// 서비스 임포트
const {
  setBoss,
  processEventReminder,
  scheduleSeriesReminders,
  scheduleExistingEvents,
} = require('./src/utils/reminderQueueService');
const { initPush } = require('./src/utils/pushService');

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
      workerSrc: ["'self'"],
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

// 압축 (SSE 스트리밍 응답은 제외)
app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept === 'text/event-stream') return false;
    return compression.filter(req, res);
  }
}));

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

const pushLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: '너무 많은 요청이 발생했습니다.' } }
});
app.use('/api/v1/push', pushLimiter);

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
app.use('/api/v1/push', pushRoutes);

// SSE 엔드포인트 (실시간 이벤트 스트림)
// EventSource는 커스텀 헤더 미지원 → 쿼리 파라미터 토큰을 Authorization 헤더로 변환
app.get('/api/v1/sse/events', (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticate, handleSSEConnection);

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

app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   업무일정 관리 시스템 API 서버          ║
╠═══════════════════════════════════════════╣
║   Environment: ${process.env.NODE_ENV?.padEnd(27) || 'development'.padEnd(27)}║
║   Port: ${PORT.toString().padEnd(34)}║
║   URL: http://localhost:${PORT.toString().padEnd(22)}║
╚═══════════════════════════════════════════╝
  `);

  // ========== pg-boss 큐 시스템 시작 ==========
  try {
    const boss = new PgBoss({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'schedule_management',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      schema: 'pgboss',
      monitorStateIntervalSeconds: 30,
    });

    boss.on('error', (error) => {
      console.error('[pg-boss] Error:', error.message);
    });

    await boss.start();
    setBoss(boss);

    // 이벤트 리마인더 워커 등록
    await boss.work('event-reminder', { teamConcurrency: 5 }, processEventReminder);

    // 반복 일정 스케줄러 (매일 자정 + 정오 실행)
    await boss.schedule('series-reminder-scheduler', '0 0,12 * * *');
    await boss.work('series-reminder-scheduler', async () => {
      console.log('[pg-boss] Running series reminder scheduler...');
      await scheduleSeriesReminders();
    });

    // 서버 시작 시 초기 스케줄링
    await scheduleExistingEvents();
    await scheduleSeriesReminders();

    // Web Push 초기화
    initPush();

    console.log('✅ pg-boss 큐 시스템 시작됨:');
    console.log('   - event-reminder 워커 등록 완료');
    console.log('   - 반복 일정 스케줄러: 0 0,12 * * * (자정/정오)');

    // Graceful shutdown 시 pg-boss 종료
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} 신호를 받았습니다. 서버를 종료합니다...`);
      await boss.stop({ graceful: true, timeout: 10000 });
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ pg-boss 시작 실패:', error.message);
    console.log('⚠️  알림 큐 없이 서버 실행됩니다.');
  }
});

module.exports = app;
