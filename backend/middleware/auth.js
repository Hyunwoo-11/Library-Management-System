// middleware/auth.js
const jwt = require('jsonwebtoken');

// JWT에서 사용자 정보 꺼내는 미들웨어
function loadUserFromToken(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, role }
  } catch (e) {
    console.error('JWT 검증 실패:', e.message);
    req.user = null;
  }
  next();
}

// 역할 체크 미들웨어
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/login/login.html');
    }

    const userRole = req.user.role;
    if (!roles.includes(userRole)) {
      return res.status(403).send('<h1>접근 권한이 없습니다.</h1>');
    }

    next();
  };
}

module.exports = { loadUserFromToken, requireRole };