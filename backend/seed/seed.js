// seed.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'bookdb',
    port: process.env.DB_PORT || 3307,
  });

  console.log('DB 연결 완료. 시드 작업을 시작');

  // ----- 생성할 계정 목록 -----
  const seedUsers = [
    {
      user_id: 'admin01',
      user_name: '관리자',
      email: 'admin@example.com',
      role: 'admin',
      password: 'admin123!',
    },
    {
      user_id: 'lib01',
      user_name: '사서1',
      email: 'lib01@example.com',
      role: 'librarian',
      password: 'lib1234!',
    },
    {
      user_id: 'lib02',
      user_name: '사서2',
      email: 'lib02@example.com',
      role: 'librarian',
      password: 'lib5678!',
    },
  ];

  for (const user of seedUsers) {
    // 먼저 중복 확인
    const [exists] = await db.query(
      'SELECT * FROM member WHERE user_id = ?',
      [user.user_id]
    );

    if (exists.length > 0) {
      console.log(`⚠️ 이미 존재함 → ${user.user_id} (건너뜀)`);
      continue;
    }

    // 비밀번호 해시
    const hash = await bcrypt.hash(user.password, 10);

    // DB 삽입
    await db.query(
      `
      INSERT INTO member (user_id, user_pw, user_name, email, role, is_logged_in)
      VALUES (?, ?, ?, ?, ?, 0)
    `,
      [user.user_id, hash, user.user_name, user.email, user.role]
    );

    console.log(`생성 완료 → ${user.user_id} (${user.role})`);
  }

  console.log('\n 모든 시드 데이터 삽입 완료!');
  process.exit(0);
}

main().catch((err) => {
  console.error(' 시드 실행 중 오류:', err);
  process.exit(1);
});