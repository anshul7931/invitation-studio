/**
 * MySQL connection/bootstrap module.
 * Creates the local schema/tables if needed and applies small compatibility
 * migrations for columns added after the initial project version.
 */
const mysql = require("mysql2/promise");
const { config } = require("./config");

const connectionConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password
};

let pool;

async function initializeDatabase() {
  const connection = await mysql.createConnection(connectionConfig);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.name}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();

  pool = mysql.createPool({
    ...connectionConfig,
    database: config.db.name,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    namedPlaceholders: true
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(40) NULL,
      role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
      email_verified_at DATETIME NULL,
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
      public_token CHAR(36) NULL UNIQUE,
      public_expires_at DATETIME NULL,
      public_generated_at DATETIME NULL,
      public_fingerprint CHAR(64) NULL,
      status ENUM('DRAFT', 'PUBLISHED', 'EXPIRED', 'PAID') NOT NULL DEFAULT 'DRAFT',
      occasion ENUM('wedding', 'birthday', 'engagement', 'office', 'custom') NOT NULL,
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
    [config.db.name]
  );
  if (!shareColumns.length) {
    await pool.query("ALTER TABLE invitations ADD COLUMN share_token CHAR(36) NULL UNIQUE AFTER user_id");
    await pool.query("UPDATE invitations SET share_token = UUID() WHERE share_token IS NULL");
    await pool.query("ALTER TABLE invitations MODIFY share_token CHAR(36) NOT NULL");
  }

  await ensureColumn("users", "phone", "ALTER TABLE users ADD COLUMN phone VARCHAR(40) NULL AFTER email");
  await ensureColumn("users", "role", "ALTER TABLE users ADD COLUMN role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER' AFTER phone");
  await ensureColumn("users", "email_verified_at", "ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER role");
  await ensureColumn("invitations", "public_token", "ALTER TABLE invitations ADD COLUMN public_token CHAR(36) NULL UNIQUE AFTER share_token");
  await ensureColumn("invitations", "public_expires_at", "ALTER TABLE invitations ADD COLUMN public_expires_at DATETIME NULL AFTER public_token");
  await ensureColumn("invitations", "public_generated_at", "ALTER TABLE invitations ADD COLUMN public_generated_at DATETIME NULL AFTER public_expires_at");
  await ensureColumn("invitations", "public_fingerprint", "ALTER TABLE invitations ADD COLUMN public_fingerprint CHAR(64) NULL AFTER public_generated_at");
  await ensureColumn("invitations", "status", "ALTER TABLE invitations ADD COLUMN status ENUM('DRAFT', 'PUBLISHED', 'EXPIRED', 'PAID') NOT NULL DEFAULT 'DRAFT' AFTER public_fingerprint");
  await pool.query("ALTER TABLE invitations MODIFY occasion ENUM('wedding', 'birthday', 'engagement', 'office', 'custom') NOT NULL");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_tokens (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      purpose ENUM('VERIFY_EMAIL', 'RESET_PASSWORD') NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      provider_message_id VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_email_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_email_tokens_user_purpose (user_id, purpose, created_at),
      INDEX idx_email_tokens_token (token_hash),
      INDEX idx_email_tokens_expiry (expires_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_send_logs (
      id CHAR(36) PRIMARY KEY,
      provider VARCHAR(60) NOT NULL,
      purpose ENUM('VERIFY_EMAIL', 'RESET_PASSWORD') NOT NULL,
      recipient VARCHAR(255) NOT NULL,
      status ENUM('SENT', 'FAILED', 'SKIPPED') NOT NULL,
      provider_message_id VARCHAR(255) NULL,
      error_message VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email_send_logs_created (created_at),
      INDEX idx_email_send_logs_recipient (recipient, created_at)
    )
  `);

  await pool.query("DELETE FROM sessions WHERE expires_at <= NOW()");
  await pool.query("DELETE FROM email_tokens WHERE expires_at <= NOW() OR used_at IS NOT NULL");
  return pool;
}

async function ensureColumn(table, column, alterSql) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.name, table, column]
  );
  if (!rows.length) await pool.query(alterSql);
}

function database() {
  if (!pool) throw new Error("Database has not been initialized.");
  return pool;
}

module.exports = { initializeDatabase, database, databaseName: config.db.name };
