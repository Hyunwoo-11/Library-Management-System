CREATE DATABASE IF NOT EXISTS bookdb;
USE bookdb;

CREATE TABLE member (
    mem_no INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    user_pw VARCHAR(100) NOT NULL,
    user_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    reg_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_logged_in BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_no INT UNIQUE,
    title VARCHAR(255),
    author VARCHAR(255),
    publisher VARCHAR(255),
    pub_year INT,
    book_count INT,
    genre VARCHAR(50) NOT NULL DEFAULT '기타'
);

CREATE TABLE loan (
    loan_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    book_id INT NOT NULL,
    loan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME
);