// routes/users.js
const express = require('express');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

module.exports = (db) => {
  // 회원 관리 화면
  router.get('/manage-users', requireRole('admin'), (req, res) => {
    const sql = `
      SELECT mem_no AS id, user_id, user_name, email, role, is_logged_in
      FROM member
      ORDER BY id ASC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        console.error('회원 목록 조회 에러:', err);
        return res.send('회원 목록 조회 중 오류가 발생했습니다.');
      }

      let html = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>회원 관리</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; }
            .container { max-width: 1000px; margin: 40px auto; background:#fff;
                        padding:24px 32px; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.08); }
            h1 { margin-bottom:16px; }
            table { width:100%; border-collapse: collapse; margin-top:16px; }
            th, td { border:1px solid #ddd; padding:8px; font-size: 14px; text-align:center; }
            th { background:#f0f0f0; }
            .top-menu { display:flex; justify-content:space-between; align-items:center; }
            .back-btn { padding:6px 10px; border-radius:4px; border:1px solid #aaa; background:#eee; cursor:pointer; }
            .btn { padding:4px 8px; border-radius:4px; border:1px solid #4e73df; background:#4e73df; color:#fff; cursor:pointer; font-size:12px; }
            .btn-danger { border-color:#e53935; background:#e53935; }
            select { padding:4px; font-size:12px; }
          </style>
        </head>
        <body>
        <div class="container">
          <div class="top-menu">
            <h1>회원 관리</h1>
            <button class="back-btn" onclick="location.href='/library/library.html'">⬅ 메인으로</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>아이디</th>
                <th>이름</th>
                <th>이메일</th>
                <th>역할(role)</th>
                <th>접속 상태</th>
                <th>역할 변경</th>
                <th>회원 삭제</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (results.length === 0) {
        html += `
          <tr>
            <td colspan="8" style="text-align:center;">등록된 회원이 없습니다.</td>
          </tr>
        `;
      } else {
        results.forEach((row) => {
          html += `
            <tr>
              <td>${row.id}</td>
              <td>${row.user_id}</td>
              <td>${row.user_name ?? ''}</td>
              <td>${row.email ?? ''}</td>
              <td>${row.role ?? 'user'}</td>
              <td>
                ${
                  row.is_logged_in
                    ? '<span style="color: green; font-weight: 600;">온라인</span>'
                    : '<span style="color: gray;">오프라인</span>'
                }
              </td>
              <td>
                <form method="post" action="/change-role" style="margin:0; display:inline-flex; gap:4px; align-items:center;">
                  <input type="hidden" name="user_id" value="${row.user_id}">
                  <select name="new_role">
                    <option value="user" ${row.role === 'user' ? 'selected' : ''}>user</option>
                    <option value="librarian" ${row.role === 'librarian' ? 'selected' : ''}>librarian</option>
                    <option value="admin" ${row.role === 'admin' ? 'selected' : ''}>admin</option>
                  </select>
                  <button type="submit" class="btn">변경</button>
                </form>
              </td>
              <td>
                <form method="post" action="/delete-user" style="margin:0; display:inline;"
                      onsubmit="return confirm('정말 이 회원을 삭제하시겠습니까?');">
                  <input type="hidden" name="user_id" value="${row.user_id}">
                  <button type="submit" class="btn btn-danger">삭제</button>
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

  // 회원 역할 변경
  router.post('/change-role', requireRole('admin'), (req, res) => {
    const { user_id, new_role } = req.body;

    const ALLOWED = ['user', 'librarian', 'admin'];
    if (!ALLOWED.includes(new_role)) {
      return res.send('잘못된 역할입니다.');
    }

    const sql = 'UPDATE member SET role = ? WHERE user_id = ?';

    db.query(sql, [new_role, user_id], (err) => {
      if (err) {
        console.error('회원 역할 변경 에러:', err);
        return res.send('회원 역할 변경 중 오류가 발생했습니다.');
      }
      console.log(`역할 변경: ${user_id} -> ${new_role}`);
      res.redirect('/manage-users');
    });
  });

  // 회원 삭제
  router.post('/delete-user', requireRole('admin'), (req, res) => {
    const { user_id } = req.body;

    if (req.user && req.user.id === user_id) {
      return res.send('본인 계정은 삭제할 수 없습니다.');
    }

    const sql = 'DELETE FROM member WHERE user_id = ?';

    db.query(sql, [user_id], (err) => {
      if (err) {
        console.error('회원 삭제 에러:', err);
        return res.send('회원 삭제 중 오류가 발생했습니다.');
      }
      console.log(`회원 삭제 완료: user_id=${user_id}`);
      res.redirect('/manage-users');
    });
  });

  return router;
};