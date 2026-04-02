-- Migration: Add balance non-negative constraint
-- Date: 2026-04-02
-- Description: Ensures user balance cannot go negative at database level

-- Add CHECK constraint to ensure balance is non-negative
ALTER TABLE "users" ADD CONSTRAINT "users_balance_non_negative" CHECK (balance >= 0);

-- Create trigger function to prevent negative balance updates
CREATE OR REPLACE FUNCTION prevent_negative_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.balance < 0 THEN
        RAISE EXCEPTION 'Balance cannot be negative (user: %, attempted: %)', NEW.id, NEW.balance;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DROP TRIGGER IF EXISTS users_balance_trigger ON "users";
CREATE TRIGGER users_balance_trigger
    BEFORE UPDATE ON "users"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_negative_balance();

-- Also apply on INSERT to prevent initial negative balance
DROP TRIGGER IF EXISTS users_balance_insert_trigger ON "users";
CREATE TRIGGER users_balance_insert_trigger
    BEFORE INSERT ON "users"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_negative_balance();
