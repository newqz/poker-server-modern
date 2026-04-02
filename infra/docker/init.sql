-- ============================================
-- Poker Server Modern - Database Initialization
-- ============================================
-- This script runs on first PostgreSQL container startup
-- It sets up security constraints and initial configuration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types if not exist
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'VIP', 'MODERATOR', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'PLAYING', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'STARTING', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "GameRound" AS ENUM ('PREFLOP', 'FLOP', 'TURN', 'RIVER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PlayerPosition" AS ENUM ('DEALER', 'SMALL_BLIND', 'BIG_BLIND', 'UTG', 'UTG1', 'MP', 'MP1', 'CO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PlayerAction" AS ENUM ('FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL_IN', 'SMALL_BLIND', 'BIG_BLIND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'GAME_WIN', 'GAME_LOSS', 'BUY_IN', 'CASH_OUT', 'BONUS', 'PENALTY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SnapshotType" AS ENUM ('PERIODIC', 'PRE_SHUTDOWN', 'POST_ACTION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AuditAction" AS ENUM (
        'USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTER', 'USER_UPDATE', 'USER_DELETE',
        'ROOM_CREATE', 'ROOM_JOIN', 'ROOM_LEAVE', 'ROOM_START', 'ROOM_END',
        'GAME_ACTION', 'GAME_START', 'GAME_END', 'GAME_WIN', 'GAME_LOSS',
        'BALANCE_UPDATE', 'TRANSACTION_CREATE', 'WITHDRAW_REQUEST', 'WITHDRAW_APPROVE', 'WITHDRAW_REJECT',
        'ADMIN_ACTION', 'SETTINGS_CHANGE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add security constraints (these will be applied after Prisma migrations)
-- Note: Prisma manages the tables, but we add constraints here for extra safety

-- Function to prevent negative balance
CREATE OR REPLACE FUNCTION prevent_negative_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.balance < 0 THEN
        RAISE EXCEPTION 'Balance cannot be negative (user: %, attempted: %)', NEW.id, NEW.balance;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger will be applied to the users table after Prisma creates it
-- Run this after Prisma migrations:
-- DROP TRIGGER IF EXISTS users_balance_trigger ON users;
-- CREATE TRIGGER users_balance_trigger
--   BEFORE UPDATE ON users
--   FOR EACH ROW EXECUTE FUNCTION prevent_negative_balance();

-- Log successful initialization
DO $$ BEGIN
    RAISE NOTICE 'Poker Server database initialization completed successfully';
END $$;
