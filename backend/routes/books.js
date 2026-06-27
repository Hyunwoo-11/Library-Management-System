// routes/books.js
// 책 조회 / 등록 / 수정 / 삭제 관련 라우터

const express = require('express');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// 선택지로 보여줄 장르 목록
const GENRES = [
  '소설',
  '판타지',
  '추리/스릴러',
  'SF/과학',
  '역사',
  '자기계발',
  'IT/컴퓨터',
  '에세이',
  '기타'
];

module.exports = (db) => {
  // ===== 1) 도서 조회 (/books) - 장르 드롭다운 + 제목 검색 + "대출중" 표시 =====
  router.get('/books', (req, res) => {
    const keyword = req.query.q || '';     // 제목 검색어
    const genre = req.query.genre || '';   // 선택된 장르
    const currentUserId = req.user ? req.user.id : null; // 로그인 유저 ID

    // 장르 목록 (DB 기준)
    const genreSql = 'SELECT DISTINCT genre FROM books ORDER BY genre';

    db.query(genreSql, (err, genreRows) => {
      if (err) {
        console.error('장르 목록 조회 에러:', err);
        return res.send('장르 목록 조회 중 오류가 발생했습니다.');
      }

      // 도서 + 현재 유저가 대출중인지 플래그까지 같이 조회
      let sql = `
        SELECT 
          b.*,
          CASE WHEN l.loan_id IS NULL THEN 0 ELSE 1 END AS is_borrowed_by_me
        FROM books b
        LEFT JOIN loan l
          ON b.id = l.book_id
          AND l.user_id = ?
          AND l.return_date IS NULL
      `;
      const conditions = [];
      const params = [currentUserId];

      if (keyword) {
        conditions.push('b.title LIKE ?');
        params.push(`%${keyword}%`);
      }
      if (genre) {
        conditions.push('b.genre = ?');
        params.push(genre);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      // 도서번호 기준 오름차순 정렬 (없으면 id)
      sql += ' ORDER BY b.book_no ASC, b.id ASC';

      db.query(sql, params, (err2, results) => {
        if (err2) {
          console.error('도서 조회 에러:', err2);
          return res.send('도서 조회 중 오류가 발생했습니다.');
        }

        // 장르 select 옵션
        let genreOptions = `<option value="">전체 장르</option>`;
        genreRows.forEach((row) => {
          const g = row.genre || '';
          if (!g) return;
          const selected = (g === genre) ? 'selected' : '';
          genreOptions += `<option value="${g}" ${selected}>${g}</option>`;
        });

        let html = `
          <!DOCTYPE html>
          <html lang="ko">
          <head>
            <meta charset="UTF-8">
            <title>도서 조회</title>
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; }
              .container { max-width: 960px; margin: 40px auto; background:#fff; padding:24px 32px; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.08); }
              h1 { margin-bottom:16px; }
              table { width:100%; border-collapse: collapse; margin-top:16px; }
              th, td { border:1px solid #ddd; padding:8px; font-size: 14px; text-align:center; white-space: nowrap; }
              th { background:#f0f0f0; }
              .top-menu { display:flex; justify-content:space-between; align-items:center; }
              .search-box { margin-top: 8px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
              .search-box input[type="text"],
              .search-box select { padding:6px 8px; border-radius:4px; border:1px solid #ccc; }
              .search-box button { padding:6px 10px; border-radius:4px; border:1px solid #4e73df; background:#4e73df; color:#fff; cursor:pointer; }
              .back-btn { padding:6px 10px; border-radius:4px; border:1px solid #aaa; background:#eee; cursor:pointer; }

              .status-loaned { color:#2e7d32; font-weight:600; } /* 대출중 (초록) */
              .status-unavail { color:#999; }                   /* 대출불가 (회색) */
            </style>
          </head>
          <body>
          <div class="container">
            <div class="top-menu">
              <h1>도서 조회</h1>
              <button class="back-btn" onclick="location.href='/library/library.html'">⬅ 메인으로</button>
            </div>

            <form class="search-box" method="get" action="/books">
              <input type="text" name="q" placeholder="제목 검색" value="${keyword}">
              <select name="genre">
                ${genreOptions}
              </select>
              <button type="submit">검색</button>
            </form>

            <table>
              <thead>
                <tr>
                  <th>도서번호</th>
                  <th>제목</th>
                  <th>저자</th>
                  <th>출판사</th>
                  <th>출판년도</th>
                  <th>장르</th>
                  <th>보유권수</th>
                  <th>대출</th>
                </tr>
              </thead>
              <tbody>
        `;

        if (results.length === 0) {
          html += `
            <tr>
              <td colspan="8" style="text-align:center;">등록된 도서가 없습니다.</td>
            </tr>
          `;
        } else {
          results.forEach((row) => {
            let loanStatusHtml;

            if (row.book_count <= 0) {
              loanStatusHtml = '<span class="status-unavail">대출불가</span>';
            } else if (row.is_borrowed_by_me) {
              loanStatusHtml = '<span class="status-loaned">대출중</span>';
            } else {
              loanStatusHtml = `
                <form method="post" action="/loan" style="margin:0;">
                  <input type="hidden" name="book_id" value="${row.id}">
                  <button type="submit">대출</button>
                </form>
              `;
            }

            html += `
              <tr>
                <td>${row.book_no ?? ''}</td>
                <td>${row.title ?? ''}</td>
                <td>${row.author ?? ''}</td>
                <td>${row.publisher ?? ''}</td>
                <td>${row.pub_year ?? ''}</td>
                <td>${row.genre ?? ''}</td>
                <td>${row.book_count ?? ''}</td>
                <td>${loanStatusHtml}</td>
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
  });

  // ===== 2) 도서 등록 / 수정 화면 (/manage-books) =====
  router.get('/manage-books', requireRole('librarian', 'admin'), (req, res) => {
    const sql = 'SELECT * FROM books ORDER BY book_no ASC, id ASC';

    const error = req.query.error;
    let messageHtml = '';
    if (error === 'dup') {
      messageHtml = `<p style="color:red; font-weight:600; margin-top:8px;">이미 존재하는 도서번호입니다. 다른 번호를 사용해주세요.</p>`;
    } else if (error === 'server') {
      messageHtml = `<p style="color:red; font-weight:600; margin-top:8px;">도서 등록 중 오류가 발생했습니다.</p>`;
    }

    db.query(sql, (err, results) => {
      if (err) {
        console.error('도서 관리 조회 에러:', err);
        return res.send('도서 관리 조회 중 오류가 발생했습니다.');
      }

      // 장르 선택 옵션 (등록용)
      let genreOptions = `<option value="">장르 선택</option>`;
      GENRES.forEach((g) => {
        genreOptions += `<option value="${g}">${g}</option>`;
      });

      let html = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>도서 등록 / 수정</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; }
            .container { max-width: 1100px; margin: 40px auto; background:#fff;
                         padding:24px 32px; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.08); }
            h1 { margin-bottom:16px; }
            table { width:100%; border-collapse: collapse; margin-top:16px; }
            th, td { border:1px solid #ddd; padding:8px; font-size: 14px; white-space: nowrap; }
            th { background:#f0f0f0; }
            .top-menu { display:flex; justify-content:space-between; align-items:center; }
            .back-btn { padding:6px 10px; border-radius:4px; border:1px solid #aaa; background:#eee; cursor:pointer; }
            .form-row { margin-top: 16px; }
            .add-book-row {
              display:flex;
              gap:8px;
              flex-wrap:nowrap;
              align-items:center;
            }
            .add-book-row input,
            .add-book-row select {
              padding:4px 6px;
              border-radius:4px;
              border:1px solid #ccc;
              font-size:13px;
            }
            .add-book-row input[name="book_no"] { width:90px; }
            .add-book-row input[name="title"] { flex:1.5; min-width:160px; }
            .add-book-row input[name="author"] { flex:1; min-width:120px; }
            .add-book-row input[name="publisher"] { flex:1; min-width:120px; }
            .add-book-row input[name="pub_year"] { width:80px; }
            .add-book-row select[name="genre"] { width:120px; }
            .add-book-row input[name="book_count"] { width:80px; }
            .btn { padding:6px 10px; border-radius:4px; border:1px solid #4e73df; background:#4e73df; color:#fff; cursor:pointer; }
          </style>
        </head>
        <body>
        <div class="container">
          <div class="top-menu">
            <h1>도서 등록 / 수정</h1>
            <button class="back-btn" onclick="location.href='/library/library.html'">⬅ 메인으로</button>
          </div>

          ${messageHtml}

          <h2>새 도서 등록</h2>
          <form method="post" action="/add-book" class="form-row add-book-row">
            <input type="text" name="book_no" placeholder="번호">
            <input type="text" name="title" placeholder="제목" required>
            <input type="text" name="author" placeholder="저자">
            <input type="text" name="publisher" placeholder="출판사">
            <input type="number" name="pub_year" placeholder="년도">
            <select name="genre">
              ${genreOptions}
            </select>
            <input type="number" name="book_count" placeholder="권수" required min="0">
            <button type="submit" class="btn">등록</button>
          </form>

          <h2>기존 도서 목록</h2>
          <table>
            <thead>
              <tr>
                <th>도서번호</th>
                <th>제목</th>
                <th>저자</th>
                <th>출판사</th>
                <th>출판년도</th>
                <th>장르</th>
                <th>보유 권수</th>
                <th>수정</th>
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (results.length === 0) {
        html += `
          <tr>
            <td colspan="9" style="text-align:center;">등록된 도서가 없습니다.</td>
          </tr>
        `;
      } else {
        results.forEach((row) => {
          html += `
            <tr>
              <td>${row.book_no ?? ''}</td>
              <td>${row.title ?? ''}</td>
              <td>${row.author ?? ''}</td>
              <td>${row.publisher ?? ''}</td>
              <td>${row.pub_year ?? ''}</td>
              <td>${row.genre ?? ''}</td>
              <td>${row.book_count ?? 0}</td>
              <td>
                <form method="post" action="/update-book-count" style="margin:0; display:inline;">
                  <input type="hidden" name="book_id" value="${row.id}">
                  <input type="number" name="book_count" value="${row.book_count ?? 0}" min="0" style="width:60px;">
                  <button type="submit" class="btn">저장</button>
                </form>
              </td>
              <td>
                <form method="post" action="/delete-book" style="margin:0; display:inline;"
                      onsubmit="return confirm('정말 이 도서를 삭제하시겠습니까?');">
                  <input type="hidden" name="book_id" value="${row.id}">
                  <button type="submit" class="btn" style="background:#e53935; border-color:#e53935;">
                    삭제
                  </button>
                </form>
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

  // ===== 3) 도서 등록 처리 (/add-book) - 도서번호 중복 체크 =====
  router.post('/add-book', requireRole('librarian', 'admin'), (req, res) => {
    const { book_no, title, author, publisher, pub_year, book_count, genre } = req.body;

    // 1. 도서번호 중복 검사
    const checkSql = 'SELECT id FROM books WHERE book_no = ?';

    db.query(checkSql, [book_no], (err, rows) => {
      if (err) {
        console.error('도서번호 중복 검사 에러:', err);
        return res.redirect('/manage-books?error=server');
      }

      if (rows.length > 0) {
        // 도서번호 이미 존재 → 관리 화면으로 돌아가면서 에러 표시
        return res.redirect('/manage-books?error=dup');
      }

      // 2. 실제 INSERT
      const sql = `
        INSERT INTO books (book_no, title, author, publisher, pub_year, genre, book_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          book_no || null,
          title,
          author || null,
          publisher || null,
          pub_year || null,
          genre || null,
          book_count || 0,
        ],
        (err2) => {
          if (err2) {
            console.error('도서 등록 에러:', err2);
            return res.redirect('/manage-books?error=server');
          }
          res.redirect('/manage-books');
        }
      );
    });
  });

  // ===== 4) 도서 보유수 수정 =====
  router.post('/update-book-count', requireRole('librarian', 'admin'), (req, res) => {
    const { book_id, book_count } = req.body;

    const sql = 'UPDATE books SET book_count = ? WHERE id = ?';

    db.query(sql, [book_count, book_id], (err) => {
      if (err) {
        console.error('도서 권수 수정 에러:', err);
        return res.send('도서 권수 수정 중 오류가 발생했습니다.');
      }
      res.redirect('/manage-books');
    });
  });

  // ===== 5) 도서 삭제 =====
  router.post('/delete-book', requireRole('librarian', 'admin'), (req, res) => {
    const { book_id } = req.body;

    const sql = 'DELETE FROM books WHERE id = ?';

    db.query(sql, [book_id], (err) => {
      if (err) {
        console.error('도서 삭제 에러:', err);
        return res.send('도서 삭제 중 오류가 발생했습니다.');
      }
      console.log(`도서 삭제 완료: book_id=${book_id}`);
      res.redirect('/manage-books');
    });
  });

  return router;
};