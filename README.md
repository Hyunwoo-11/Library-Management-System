# Library Management System

Node.js, Express, MySQL을 기반으로 만든 도서 관리 시스템입니다.
사용자는 회원가입 및 로그인을 통해 도서 목록을 확인하고, 도서를 대출하거나 반납할 수 있습니다.
관리자와 사서 권한을 구분하여 사용자 관리와 도서 관리를 수행할 수 있도록 구성했습니다.

## 주요 기능

* 회원가입 및 로그인
* JWT 기반 사용자 인증
* bcrypt를 활용한 비밀번호 암호화
* 관리자, 사서, 일반 사용자 권한 구분
* 도서 목록 조회
* 도서 검색
* 도서 대출 및 반납
* 사용자 관리
* MySQL 데이터베이스 연동
* 샘플 데이터 기반 테스트 가능

## 기술 스택

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Node.js
* Express.js
* JWT
* bcrypt
* cookie-parser
* dotenv

### Database

* MySQL
* MySQL Workbench

## 프로젝트 구조

```text
DBPROJECT/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── books.js
│   │   ├── chatbot.js
│   │   ├── loans.js
│   │   └── users.js
│   ├── seed/
│   │   └── seed.js
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
│
├── frontend/
│   ├── library/
│   ├── login/
│   └── register/
│
├── database/
│   └── bookDB.sql
│
├── docs/
│   └── 프로젝트 문서
│
├── .gitignore
└── README.md
```

## 데이터베이스 구조

본 프로젝트는 `bookdb` 데이터베이스를 사용합니다.

### 1. books 테이블

도서 정보를 저장하는 테이블입니다.

| 컬럼명        | 타입           | 설명            |
| ---------- | ------------ | ------------- |
| id         | INT          | 도서 고유 번호, 기본키 |
| book_no    | INT          | 도서 번호, 중복 불가  |
| title      | VARCHAR(255) | 도서 제목         |
| author     | VARCHAR(255) | 저자            |
| publisher  | VARCHAR(255) | 출판사           |
| pub_year   | INT          | 출판 연도         |
| book_count | INT          | 보유 권수         |
| genre      | VARCHAR(50)  | 도서 장르         |

### 2. member 테이블

회원 정보를 저장하는 테이블입니다.

| 컬럼명          | 타입           | 설명             |
| ------------ | ------------ | -------------- |
| mem_no       | INT          | 회원 고유 번호, 기본키  |
| user_id      | VARCHAR(50)  | 사용자 아이디, 중복 불가 |
| user_pw      | VARCHAR(100) | 암호화된 비밀번호      |
| user_name    | VARCHAR(50)  | 사용자 이름         |
| email        | VARCHAR(100) | 이메일            |
| reg_date     | DATETIME     | 가입일            |
| role         | VARCHAR(20)  | 사용자 권한         |
| is_logged_in | TINYINT(1)   | 로그인 상태         |

### 3. loan 테이블

도서 대출 및 반납 기록을 저장하는 테이블입니다.

| 컬럼명         | 타입          | 설명            |
| ----------- | ----------- | ------------- |
| loan_id     | INT         | 대출 고유 번호, 기본키 |
| user_id     | VARCHAR(50) | 대출한 사용자 아이디   |
| book_id     | INT         | 대출한 도서 ID     |
| loan_date   | DATETIME    | 대출일           |
| return_date | DATETIME    | 반납일           |

## 권한 구조

사용자는 `role` 값에 따라 권한이 구분됩니다.

| 권한        | 설명     |
| --------- | ------ |
| admin     | 관리자    |
| librarian | 사서     |
| user      | 일반 사용자 |

## 실행 방법

### 1. 저장소 클론

```bash
git clone https://github.com/Hyunwoo-11/Library-Management-System.git
```

```bash
cd Library-Management-System
```

### 2. 데이터베이스 생성

MySQL Workbench에서 아래 파일을 실행합니다.

```text
database/bookDB.sql
```

해당 SQL 파일에는 데이터베이스, 테이블, 샘플 데이터가 포함되어 있습니다.

### 3. 환경 변수 설정

`backend/.env.example` 파일을 참고하여 `backend/.env` 파일을 생성합니다.

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=bookdb
DB_PORT=3307

PORT=3000

JWT_SECRET=your_jwt_secret
```

### 4. 패키지 설치

```bash
cd backend
npm install
```

### 5. 서버 실행

```bash
node server.js
```

또는 nodemon을 사용하는 경우

```bash
npx nodemon server.js
```

### 6. 접속 주소

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:3000/login/login.html
```

## 테스트 계정

SQL 파일 또는 seed 파일을 통해 테스트 계정을 생성할 수 있습니다.

예시 계정은 다음과 같습니다.

| 아이디     | 권한  |
| ------- | --- |
| admin01 | 관리자 |
| lib01   | 사서  |
| lib02   | 사서  |

비밀번호는 프로젝트의 seed 파일 또는 별도 계정 정보 문서를 참고합니다.

## 환경 변수 주의사항

실제 `.env` 파일에는 DB 비밀번호와 JWT Secret이 포함되므로 GitHub에 업로드하지 않습니다.
대신 `.env.example` 파일만 업로드하여 필요한 환경 변수 형식을 안내합니다.

## GitHub 업로드 제외 파일

다음 파일 및 폴더는 GitHub에 업로드하지 않습니다.

```text
backend/node_modules/
backend/.env
```

## 프로젝트 실행 흐름

1. 사용자가 로그인 페이지에 접속합니다.
2. 로그인 성공 시 JWT 토큰이 쿠키에 저장됩니다.
3. 서버는 JWT를 확인하여 사용자 정보를 불러옵니다.
4. 사용자의 권한에 따라 접근 가능한 기능이 달라집니다.
5. 사용자는 도서 조회, 대출, 반납 기능을 사용할 수 있습니다.
6. 관리자 또는 사서는 사용자 및 도서 관리 기능을 사용할 수 있습니다.

## 프로젝트 목적

이 프로젝트는 Node.js와 MySQL을 활용하여 기본적인 웹 서비스 구조를 학습하고,
회원 인증, 권한 관리, 데이터베이스 연동, CRUD 기능을 직접 구현하는 것을 목표로 제작되었습니다.
