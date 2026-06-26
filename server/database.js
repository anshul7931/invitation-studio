const mysql = require("mysql2/promise");

const databaseName = process.env.DB_NAME || "invitation_factory";
const connectionConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root"
};

let pool;

async function initializeDatabase() {
  const connection = await mysql.createConnection(connectionConfig);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();

  pool = mysql.createPool({
    ...connectionConfig,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_sessions_user (user_id),
      INDEX idx_sessions_expiry (expires_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invitations (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      share_token CHAR(36) NOT NULL UNIQUE,
      occasion ENUM('wedding', 'birthday', 'engagement', 'office') NOT NULL,
      title VARCHAR(255) NOT NULL,
      fields JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_invitations_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_invitations_user_updated (user_id, updated_at)
    )
  `);

  const [shareColumns] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'share_token'`,
    [databaseName]
  );
  if (!shareColumns.length) {
    await pool.query("ALTER TABLE invitations ADD COLUMN share_token CHAR(36) NULL UNIQUE AFTER user_id");
    await pool.query("UPDATE invitations SET share_token = UUID() WHERE share_token IS NULL");
    await pool.query("ALTER TABLE invitations MODIFY share_token CHAR(36) NOT NULL");
  }

  await pool.query("DELETE FROM sessions WHERE expires_at <= NOW()");
  return pool;
}

function database() {
  if (!pool) throw new Error("Database has not been initialized.");
  return pool;
}

module.exports = { initializeDatabase, database, databaseName };
