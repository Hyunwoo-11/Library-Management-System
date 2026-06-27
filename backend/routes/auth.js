// 로그인 / 회원가입

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// 비밀번호 규칙: 8글자 이상 + 특수문자 1개 이상
function isValidPassword(pw) {
  if (!pw || pw.length < 8) return false;
  const special = /[!@#$%^&*(),.?":{}|<>]/;
  return special.test(pw);
}

module.exports = (db) => {
  // 회원가입
  router.post('/register', (req, res) => {
    const { user_id, user_pw, user_name, email } = req.body;

    if (!isValidPassword(user_pw)) {
      return res.redirect('/register/register.html?error=pw');
    }

    bcrypt.hash(user_pw, 10, (err, hash) => {
      if (err) {
        console.error('비밀번호 해시 에러:', err);
        return res.redirect('/register/register.html?error=server');
      }

      const sql = `
        INSERT INTO member (user_id, user_pw, user_name, email)
        VALUES (?, ?, ?, ?)
      `;

      db.query(sql, [user_id, hash, user_name, email], (err2) => {
        if (err2) {
          console.error('회원가입 에러:', err2);
          return res.redirect('/register/register.html?error=1');
        }

        console.log('회원가입 성공:', user_id);
        res.redirect('/login/login.html?register=success');
      });
    });
  });

  // 로그인 (JWT + 중복 로그인)
  router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM member WHERE user_id = ?';
    db.query(sql, [username], (err, results) => {
      if (err) {
        console.error('로그인 쿼리 에러:', err);
        return res.redirect('/login/login.html?error=server');
      }

      if (results.length === 0) {
        console.log('로그인 실패(존재X):', username);
        return res.redirect('/login/login.html?error=1');
      }

      const user = results[0];

      // is_logged_in 컬럼으로 중복 로그인 방지
      if (user.is_logged_in === 1) {
        console.log('중복 로그인 시도:', username);
        return res.redirect('/login/login.html?error=dup');
      }

      bcrypt.compare(password, user.user_pw, (err2, same) => {
        if (err2) {
          console.error('비밀번호 비교 에러:', err2);
          return res.redirect('/login/login.html?error=server');
        }

        if (!same) {
          console.log('로그인 실패(비번틀림):', username);
          return res.redirect('/login/login.html?error=1');
        }

        console.log('로그인 성공:', username, 'role:', user.role);

        const payload = {
          id: user.user_id,
          name: user.user_name,
          role: user.role || 'user',
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
          expiresIn: '2h',
        });

        res.cookie('token', token, {
          httpOnly: true,
          maxAge: 2 * 60 * 60 * 1000, // 2시간
        });

        const updateSql = 'UPDATE member SET is_logged_in = 1 WHERE user_id = ?';
        db.query(updateSql, [user.user_id], (err3) => {
          if (err3) {
            console.error('is_logged_in 업데이트 에러:', err3);
          }
          return res.redirect('/library/library.html');
        });
      });
    });
  });

  // JWT 정보 조회
  router.get('/session-info', (req, res) => {
    if (!req.user) {
      return res.json({ loggedIn: false });
    }

    return res.json({
      loggedIn: true,
      id: req.user.id,
      name: req.user.name,
      role: req.user.role,
    });
  });

  // 로그아웃
  router.get('/logout', (req, res) => {
    if (req.user) {
      const sql = 'UPDATE member SET is_logged_in = 0 WHERE user_id = ?';
      db.query(sql, [req.user.id], (err) => {
        if (err) {
          console.error('로그아웃 is_logged_in 업데이트 에러:', err);
        }
      });
    }

    res.clearCookie('token'); // JWT 제거
    res.redirect('/login/login.html');
  });

  return router;
};