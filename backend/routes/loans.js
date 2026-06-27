// routes/loans.js
// 대출 / 반납 관련 라우터
//
// 핵심
// - mysql2의 promise() + async/await + 트랜잭션 사용
// - 대출: 재고 감소 + 대출 기록 INSERT 를 한 번의 트랜잭션으로
// - 반납: 재고 증가 + loan.return_date 업데이트를 한 번의 트랜잭션으로
// - 같은 사람이 같은 책을 2권 이상 대출 못 하게 막기

const express = require('express');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

module.exports = (db) => {
  // ===== 1) 도서 대출 (트랜잭션 사용) =====
  router.post('/loan', async (req, res) => {
    const { book_id } = req.body;
    const user = req.user;

    if (!user) {
      return res.send('로그인이 필요합니다.');
    }

    const conn = db.promise(); // 단일 커넥션 기반 promise 래퍼

    try {
      await conn.beginTransaction();

      // 0. 이 유저가 이 책을 이미 대출 중인지 확인
      const [existLoans] = await conn.query(
        `
        SELECT loan_id
        FROM loan
        WHERE user_id = ?
          AND book_id = ?
          AND return_date IS NULL
        FOR UPDATE
        `,
        [user.id, book_id]
      );

      if (existLoans.length > 0) {
        // 이미 같은 책을 대출 중 → 재고를 건드리지 말고 롤백 후 목록으로
        await conn.rollback();
        return res.redirect('/books');
      }

      // 1. 해당 도서 재고를 행 잠금(FOR UPDATE)과 함께 조회
      const [rows] = await conn.query(
        'SELECT book_count, title FROM books WHERE id = ? FOR UPDATE',
        [book_id]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.send('존재하지 않는 도서입니다.');
      }

      const book = rows[0];

      if (book.book_count <= 0) {
        await conn.rollback();
        return res.send(`
          <h1>대출 불가</h1>
          <p>현재 대출 가능한 권수가 없습니다.</p>
          <a href="/books">돌아가기</a>
        `);
      }

      // 2. 재고 1 감소
      await conn.query(
        'UPDATE books SET book_count = book_count - 1 WHERE id = ?',
        [book_id]
      );

      // 3. loan 테이블에 대출 기록 INSERT
      await conn.query(
        'INSERT INTO loan (user_id, book_id) VALUES (?, ?)',
        [user.id, book_id]
      );

      // 4. 커밋
      await conn.commit();

      console.log(`도서 대출 완료(트랜잭션): ${book.title}, user=${user.id}`);
      return res.redirect('/books'); // 목록으로 돌아가서 "대출중" 표시
    } catch (err) {
      console.error('도서 대출 트랜잭션 에러:', err);
      try {
        await conn.rollback();
      } catch (e) {
        console.error('대출 롤백 중 에러:', e);
      }
      return res.send('도서 대출 처리 중 오류가 발생했습니다.');
    }
  });

  // ===== 2) 내 대출 현황 조회 (읽기만이라 트랜잭션 X) =====
  router.get('/myloans', (req, res) => {
    if (!req.user) {
      return res.redirect('/login/login.html');
    }

    const userId = req.user.id;

    const sql = `
      SELECT
        l.loan_id,
        DATE_FORMAT(l.loan_date, '%Y-%m-%d %H:%i:%s') AS loan_date,
        DATE_FORMAT(l.return_date, '%Y-%m-%d %H:%i:%s') AS return_date,
        DATE_FORMAT(DATE_ADD(l.loan_date, INTERVAL 7 DAY), '%Y-%m-%d') AS due_date,
        b.title,
        b.author,
        b.publisher
      FROM loan l
      JOIN books b ON l.book_id = b.id
      WHERE l.user_id = ?
      ORDER BY l.loan_date DESC
    `;

    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('내 대출 현황 조회 에러:', err);
        return res.send('내 대출 현황 조회 중 오류가 발생했습니다.');
      }

      let html = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>내 대출 현황</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; }
            .container { max-width: 960px; margin: 40px auto; background:#fff; padding:24px 32px;
                         border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.08); }
            h1 { margin-bottom:16px; }
            table { width:100%; border-collapse: collapse; margin-top:16px; table-layout: fixed; }
            th, td { border:1px solid #ddd; padding:8px; font-size: 14px; text-align:center; word-wrap: break-word; }
            th { background:#f0f0f0; }
            .top-menu { display:flex; justify-content:space-between; align-items:center; }
            .back-btn { padding:6px 10px; border-radius:4px; border:1px solid #aaa; background:#eee; cursor:pointer; }
          </style>
        </head>
        <body>
        <div class="container">
          <div class="top-menu">
            <h1>내 대출 현황</h1>
            <button class="back-btn" onclick="location.href='/library/library.html'">⬅ 메인으로</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>도서 제목</th>
                <th>저자</th>
                <th>출판사</th>
                <th>대출일</th>
                <th>반납 예정일</th>
                <th>반납일</th>
                <th>반납</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (results.length === 0) {
        html += `
          <tr>
            <td colspan="8" style="text-align:center;">현재 대출 중인 도서가 없습니다.</td>
          </tr>
        `;
      } else {
        results.forEach((row, idx) => {
          const loanDate = row.loan_date ?? '';
          const dueDate = row.due_date ?? '-';
          const returnDate = row.return_date ?? '-';

          html += `
            <tr>
              <td>${idx + 1}</td>
              <td>${row.title}</td>
              <td>${row.author ?? ''}</td>
              <td>${row.publisher ?? ''}</td>
              <td>${loanDate}</td>
              <td>${dueDate}</td>
              <td>${returnDate}</td>
              <td>
                ${
                  row.return_date
                    ? '반납완료'
                    : `<form method="post" action="/return-loan" style="margin:0;">
                        <input type="hidden" name="loan_id" value="${row.loan_id}">
                        <button type="submit">반납</button>
                       </form>`
                }
              </td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
        </body>
        </html>
      `;

      res.send(html);
    });
  });

  // ===== 3) 사용자 반납 (트랜잭션 사용) =====
  router.post('/return-loan', async (req, res) => {
    if (!req.user) {
      return res.redirect('/login/login.html');
    }

    const userId = req.user.id;
    const { loan_id } = req.body;

    const conn = db.promise();

    try {
      await conn.beginTransaction();

      // 1. 이 유저의 loan 내역을 행 잠금과 함께 조회
      const [rows] = await conn.query(
        `
        SELECT book_id, return_date
        FROM loan
        WHERE loan_id = ? AND user_id = ?
        FOR UPDATE
        `,
        [loan_id, userId]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.send('해당 대출 내역을 찾을 수 없습니다.');
      }

      const loan = rows[0];

      if (loan.return_date) {
        await conn.rollback();
        return res.send('이미 반납 처리된 도서입니다.');
      }

      const bookId = loan.book_id;

      // 2. 책 재고 +1
      await conn.query(
        'UPDATE books SET book_count = book_count + 1 WHERE id = ?',
        [bookId]
      );

      // 3. loan.return_date 업데이트
      await conn.query(
        'UPDATE loan SET return_date = NOW() WHERE loan_id = ?',
        [loan_id]
      );

      await conn.commit();

      console.log(`반납 완료(사용자): loan_id=${loan_id}, book_id=${bookId}, user=${userId}`);
      return res.redirect('/myloans');
    } catch (err) {
      console.error('사용자 반납 트랜잭션 에러:', err);
      try {
        await conn.rollback();
      } catch (e) {
        console.error('사용자 반납 롤백 에러:', e);
      }
      return res.send('반납 처리 중 오류가 발생했습니다.');
    }
  });

  // ===== 4) 대출 / 반납 관리 화면 (사서/관리자용, 조회만) =====
  router.get('/manage-loans', requireRole('librarian', 'admin'), (req, res) => {
    const sql = `
      SELECT
        l.loan_id,
        l.user_id,
        m.user_name,
        b.title,
        b.author,
        b.publisher,
        DATE_FORMAT(l.loan_date, '%Y-%m-%d %H:%i:%s') AS loan_date,
        DATE_FORMAT(l.return_date, '%Y-%m-%d %H:%i:%s') AS return_date
      FROM loan l
      JOIN books b ON l.book_id = b.id
      LEFT JOIN member m ON l.user_id = m.user_id
      ORDER BY l.loan_date DESC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        console.error('대출 관리 조회 에러:', err);
        return res.send('대출 관리 조회 중 오류가 발생했습니다.');
      }

      let html = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>대출 / 반납 관리</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; }
            .container {
              max-width: 1000px;
              margin: 40px auto;
              background:#fff;
              padding:24px 32px;
              border-radius:12px;
              box-shadow:0 4px 16px rgba(0,0,0,0.08);
            }
            h1 { margin-bottom:16px; }

            table {
              width:100%;
              border-collapse: collapse;
              margin-top:16px;
              table-layout: fixed;
            }
            th, td {
              border:1px solid #ddd;
              padding:8px;
              font-size: 14px;
              text-align:center;
              word-wrap: break-word;
            }

            th { background:#f0f0f0; }
            .top-menu { display:flex; justify-content:space-between; align-items:center; }
            .back-btn {
              padding:6px 10px;
              border-radius:4px;
              border:1px solid #aaa;
              background:#eee;
              cursor:pointer;
            }
            .btn {
              padding:4px 8px;
              border-radius:4px;
              border:1px solid #4e73df;
              background:#4e73df;
              color:#fff;
              cursor:pointer;
              font-size:12px;
            }
          </style>
        </head>
        <body>
        <div class="container">
          <div class="top-menu">
            <h1>대출 / 반납 관리</h1>
            <button class="back-btn" onclick="location.href='/library/library.html'">⬅ 메인으로</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>대출번호</th>
                <th>사용자 ID</th>
                <th>이름</th>
                <th>도서 제목</th>
                <th>저자</th>
                <th>출판사</th>
                <th>대출일</th>
                <th>반납일</th>
                <th>상태 / 처리</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (results.length === 0) {
        html += `
          <tr>
            <td colspan="9" style="text-align:center;">대출 내역이 없습니다.</td>
          </tr>
        `;
      } else {
        results.forEach((row) => {
          const loanDate = row.loan_date ? String(row.loan_date) : '';
          const returnDate = row.return_date ? String(row.return_date) : '-';

          html += `
            <tr>
              <td>${row.loan_id}</td>
              <td>${row.user_id}</td>
              <td>${row.user_name ?? ''}</td>
              <td>${row.title}</td>
              <td>${row.author ?? ''}</td>
              <td>${row.publisher ?? ''}</td>
              <td>${loanDate}</td>
              <td>${returnDate}</td>
              <td>
                ${
                  row.return_date
                    ? '반납완료'
                    : `<form method="post" action="/manage-return" style="margin:0;">
                        <input type="hidden" name="loan_id" value="${row.loan_id}">
                        <button type="submit" class="btn">반납 처리</button>
                       </form>`
                }
              </td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
        </body>
        </html>
      `;

      res.send(html);
    });
  });

  // ===== 5) 사서용 반납 처리 (트랜잭션 사용) =====
  router.post('/manage-return', requireRole('librarian', 'admin'), async (req, res) => {
    const { loan_id } = req.body;

    const conn = db.promise();

    try {
      await conn.beginTransaction();

      // 1. loan 행 잠금
      const [rows] = await conn.query(
        `
        SELECT book_id, return_date
        FROM loan
        WHERE loan_id = ?
        FOR UPDATE
        `,
        [loan_id]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.send('해당 대출 내역을 찾을 수 없습니다.');
      }

      const loan = rows[0];

      if (loan.return_date) {
        await conn.rollback();
        return res.send('이미 반납 처리된 도서입니다.');
      }

      const bookId = loan.book_id;

      // 2. 책 재고 +1
      await conn.query(
        'UPDATE books SET book_count = book_count + 1 WHERE id = ?',
        [bookId]
      );

      // 3. loan.return_date 업데이트
      await conn.query(
        'UPDATE loan SET return_date = NOW() WHERE loan_id = ?',
        [loan_id]
      );

      await conn.commit();

      console.log(`[관리자 반납] loan_id=${loan_id}, book_id=${bookId}`);
      return res.redirect('/manage-loans');
    } catch (err) {
      console.error('관리자 반납 트랜잭션 에러:', err);
      try {
        await conn.rollback();
      } catch (e) {
        console.error('관리자 반납 롤백 에러:', e);
      }
      return res.send('반납 처리 중 오류가 발생했습니다.');
    }
  });

  return router;
};