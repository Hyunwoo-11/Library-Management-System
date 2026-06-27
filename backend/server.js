// server.js

// ===== 모듈 불러오기 =====
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// .env 먼저 로드
dotenv.config();

// 내부 모듈
const db = require('./config/db');              // mysql2 풀(POOL)이라고 가정
const { loadUserFromToken } = require('./middleware/auth');

// 라우터 생성 함수
const createAuthRoutes = require('./routes/auth');
const createBookRoutes = require('./routes/books');
const createLoanRoutes = require('./routes/loans');
const createUserRoutes = require('./routes/users');
const createChatbotRoutes = require('./routes/chatbot');

const app = express();
const port = process.env.PORT || 3000;

// ===== 기본 미들웨어 =====
app.use(express.urlencoded({ extended: true }));      // 폼 데이터 파싱 (form)
app.use(express.json());                              // 🔥 JSON 바디 파싱 (fetch, axios용)
app.use(cookieParser());                              // 쿠키 파싱
app.use(express.static(path.join(__dirname, '../frontend'))); // 정적 파일 제공
app.use(loadUserFromToken);                           // JWT에서 사용자 정보 로딩

// ===== 라우터 등록 =====
app.use('/', createAuthRoutes(db));
app.use('/', createBookRoutes(db));
app.use('/', createLoanRoutes(db));   // loan 라우터가 트랜잭션 사용
app.use('/', createUserRoutes(db));
app.use('/', createChatbotRoutes(db));

// ===== 서버 실행 =====
app.listen(port, () => {
  console.log(`${port}번 포트에서 서버 실행 중`);
});