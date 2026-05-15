const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST ,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT),
  options: process.env.PG_OPTIONS,
  // Windows 환경에서 PGCLIENTENCODING 미설정 시 cp949로 잡혀 한글이 깨지는 문제 방지
  client_encoding: 'UTF8'
});

// 새 연결마다 client_encoding을 UTF8로 명시적 SET (이중 안전장치)
pool.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch((err) => {
    console.error('Failed to set client_encoding:', err.message);
  });
});

module.exports = pool;
