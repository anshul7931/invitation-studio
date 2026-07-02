CREATE DATABASE IF NOT EXISTS invitation_factory
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE invitation_factory;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(40) NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  email_verified_at DATETIME NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

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
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS invitations (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  share_token CHAR(36) NOT NULL UNIQUE,
  public_token CHAR(36) NULL UNIQUE,
  public_expires_at DATETIME NULL,
  public_generated_at DATETIME NULL,
  public_fingerprint CHAR(64) NULL,
  status ENUM('DRAFT', 'PUBLISHED', 'EXPIRED', 'PAID') NOT NULL DEFAULT 'DRAFT',
  occasion ENUM('wedding', 'birthday', 'engagement', 'office') NOT NULL,
  title VARCHAR(255) NOT NULL,
  fields JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invitations_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_invitations_user_updated (user_id, updated_at)
);
