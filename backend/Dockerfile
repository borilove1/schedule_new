# Node.js 18 LTS 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm install --omit=dev

# 앱 소스 복사
COPY . .

# 업로드 디렉토리 생성
RUN mkdir -p /app/uploads

# 포트 노출
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 앱 실행
CMD ["node", "server.js"]
