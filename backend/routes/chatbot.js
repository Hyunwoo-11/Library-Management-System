// routes/chatbot.js
// 규칙 기반 도서 추천 챗봇
//
// 특징:
// 1) "소설", "판타지" 같은 장르 이름이 들어가면
//    → 해당 장르에서 '대출 횟수(count)'가 많은 상위 5권 추천
// 2) "추천"만 물어보면
//    → 전체 장르에서 대출 많은 Top 5
// 3) "비슷한 책" 요청 시
//    → 사용자가 빌린 책의 장르를 기준으로 그 장르 인기 도서 추천
// 4) 그 외에는 사용법 안내 메시지
// 챗봇의 인기 도서 Top 5는
//books 테이블과 loan 테이블을 JOIN 해서
//장르별로 대출 횟수를 COUNT 한 뒤,
//많이 빌린 순서대로 ORDER BY 해서 LIMIT 5로 자르는 방식
//즉, 장르 키워드 + 대출 기록 집계로
//상위 5권만 추려주는 텍스트 규칙 기반 추천 기능”


const express = require('express');
const router = express.Router();

// 우리 시스템에서 사용하는 장르 목록 (books.js / DB와 맞춰서 사용)
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

  // 챗봇 엔드포인트
  router.post('/chatbot', async (req, res) => {
    const msgRaw = req.body.message || "";
    const msg = msgRaw.trim();       // 공백 제거
    const msgLower = msg.toLowerCase(); // 필요시 소문자용

    // ============================
    // 0) 아무 것도 안 쳤을 때 / 기본 안내
    // ============================
    if (!msg) {
      return res.json({
        reply:
          "안녕하세요, 도서 추천 챗봇입니다 😊\n" +
          "아래처럼 말해보세요.\n" +
          "• 판타지 추천해줘\n" +
          "• 요즘 인기 도서 뭐야?\n" +
          "• 내가 읽은 책이랑 비슷한 책 추천해줘"
      });
    }

    // ============================
    // 1) 장르 기반 추천 (해당 장르에서 대출 많은 순)
    //    예: '판타지 추천해줘', '소설 책 추천'
    // ============================
    // msg 안에 우리 장르 이름이 포함되어 있는지 체크
    for (let g of GENRES) {
      if (msg.includes(g)) {
        try {
          const [rows] = await db.promise().query(
            `
            SELECT 
              b.title, 
              b.author,
              COUNT(l.loan_id) AS loan_count
            FROM books b
            LEFT JOIN loan l ON b.id = l.book_id
            WHERE b.genre = ?
            GROUP BY b.id
            ORDER BY loan_count DESC, b.title ASC
            LIMIT 5
            `,
            [g]
          );

          if (rows.length === 0) {
            return res.json({ reply: `📕 '${g}' 장르 책이 아직 없습니다.` });
          }

          const list = rows
            .map(r => `- ${r.title}${r.author ? ' / ' + r.author : ''} (${r.loan_count}회 대출)`)
            .join('\n');

          return res.json({
            reply:
              `📚 '${g}' 장르 인기 도서 추천 (대출 많은 순)\n` +
              list
          });
        } catch (err) {
          console.error('장르 기반 추천 에러:', err);
          return res.json({ reply: '추천 도서를 가져오는 중 오류가 발생했습니다 🥲' });
        }
      }
    }

    // ============================
    // 2) "추천" 키워드 → 전체 인기 도서 Top 5
    //    예: '추천해줘', '요즘 인기 도서 뭐야?'
    // ============================
    if (msg.includes('추천')) {
      try {
        const [rows] = await db.promise().query(
          `
          SELECT 
            b.title, 
            b.author,
            COUNT(l.loan_id) AS loan_count
          FROM books b
          LEFT JOIN loan l ON b.id = l.book_id
          GROUP BY b.id
          ORDER BY loan_count DESC, b.title ASC
          LIMIT 5
          `
        );

        if (rows.length === 0) {
          return res.json({ reply: '아직 등록된 도서가 없어서 추천이 어려워요 😭' });
        }

        const list = rows
          .map(r => `- ${r.title}${r.author ? ' / ' + r.author : ''} (${r.loan_count}회 대출)`)
          .join('\n');

        return res.json({
          reply:
            "🔥 전체 인기 도서 Top 5 (대출 많은 순)\n" +
            list
        });
      } catch (err) {
        console.error('전체 인기 도서 추천 에러:', err);
        return res.json({ reply: '인기 도서를 가져오는 중 오류가 발생했습니다 🥲' });
      }
    }

    // ============================
    // 3) 내가 빌린 책과 비슷한 책 추천
    //    예: '비슷한 책 추천해줘', '같은 장르 추천해줘'
    // ============================
    if (msg.includes('비슷') || msg.includes('같은')) {
      if (!req.user) {
        return res.json({ reply: "로그인하면 '내 취향 기반' 맞춤 책 추천이 가능합니다 😊" });
      }

      const userId = req.user.id;

      try {
        // 내가 빌린 책 중 가장 최근 장르 1개 가져오기
        const [genreRows] = await db.promise().query(
          `
          SELECT b.genre
          FROM books b
          JOIN loan l ON b.id = l.book_id
          WHERE l.user_id = ?
          AND b.genre IS NOT NULL
          ORDER BY l.loan_date DESC
          LIMIT 1
          `,
          [userId]
        );

        if (genreRows.length === 0) {
          return res.json({ reply: "먼저 책을 1권 이상 대출해야 비슷한 책을 추천해드릴 수 있어요!" });
        }

        const genre = genreRows[0].genre;

        // 그 장르에서 인기 많은 순 추천
        const [rows] = await db.promise().query(
          `
          SELECT 
            b.title, 
            b.author,
            COUNT(l.loan_id) AS loan_count
          FROM books b
          LEFT JOIN loan l ON b.id = l.book_id
          WHERE b.genre = ?
          GROUP BY b.id
          ORDER BY loan_count DESC, b.title ASC
          LIMIT 5
          `,
          [genre]
        );

        if (rows.length === 0) {
          return res.json({ reply: `'${genre}' 장르에서 추천할 책을 찾지 못했어요 🥲` });
        }

        const list = rows
          .map(r => `- ${r.title}${r.author ? ' / ' + r.author : ''} (${r.loan_count}회 대출)`)
          .join('\n');

        return res.json({
          reply:
            `😊 최근에 읽은 책과 비슷한 '${genre}' 장르 인기 도서 추천\n` +
            list
        });
      } catch (err) {
        console.error('비슷한 책 추천 에러:', err);
        return res.json({ reply: '비슷한 책을 찾는 중 오류가 발생했습니다 🥲' });
      }
    }

    // ============================
    // 4) 아무 규칙에도 안 걸릴 때
    // ============================
    return res.json({
      reply:
        "제가 이해한 키워드가 없어요 🥲\n" +
        "예시로 이렇게 말해보세요:\n" +
        "• 판타지 추천해줘\n" +
        "• 요즘 인기 도서 뭐야?\n" +
        "• 내가 읽은 책과 비슷한 책 추천해줘"
    });
  });

  return router;
};