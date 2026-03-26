-- 审计日志分区脚本
-- PostgreSQL 表分区示例：按月分区
-- 运行此脚本前需要备份现有数据

-- 1. 创建分区表父表
CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 2. 创建分区索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_partitioned_user_id ON audit_logs_partitioned (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_partitioned_action ON audit_logs_partitioned (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_partitioned_created_at ON audit_logs_partitioned (created_at);

-- 3. 创建月份分区函数
CREATE OR REPLACE FUNCTION create_audit_log_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'audit_logs_' || to_char(partition_date, 'YYYY_MM');
    start_date := date_trunc('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    
    -- 检查分区是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF audit_logs_partitioned
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建自动分区维护函数（建议通过 cron 调用）
CREATE OR REPLACE FUNCTION maintain_audit_log_partitions()
RETURNS VOID AS $$
DECLARE
    i INTEGER;
BEGIN
    -- 为未来3个月创建分区
    FOR i IN 0..2 LOOP
        PERFORM create_audit_log_partition(
            (CURRENT_DATE + (i || ' months')::INTERVAL)::DATE
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建旧数据迁移视图（可选）
-- 将原表数据迁移到分区表
CREATE OR REPLACE VIEW v_audit_logs_migration AS
SELECT 
    id,
    user_id,
    session_id,
    ip_address,
    user_agent,
    action,
    resource,
    resource_id,
    old_value,
    new_value,
    success,
    error_message,
    created_at,
    CASE 
        WHEN created_at >= '2026-01-01' AND created_at < '2026-02-01' THEN 'audit_logs_2026_01'
        WHEN created_at >= '2026-02-01' AND created_at < '2026-03-01' THEN 'audit_logs_2026_02'
        WHEN created_at >= '2026-03-01' AND created_at < '2026-04-01' THEN 'audit_logs_2026_03'
        ELSE 'audit_logs_future'
    END as partition_name
FROM audit_logs;

-- 6. 清理过期分区脚本（建议每月运行）
CREATE OR REPLACE FUNCTION cleanup_old_audit_partitions(retention_months INTEGER DEFAULT 12)
RETURNS VOID AS $$
DECLARE
    cutoff_date DATE;
    partition_name TEXT;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    -- 查找需要删除的旧分区
    FOR partition_name IN 
        SELECT c.relname
        FROM pg_class c
        JOIN pg_inherits i ON c.oid = i.inhrelid
        JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'audit_logs_partitioned'
        AND c.relname < 'audit_logs_' || to_char(cutoff_date, 'YYYY_MM')
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
        RAISE NOTICE 'Dropped partition: %', partition_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 注释说明
COMMENT ON TABLE audit_logs_partitioned IS '审计日志分区表 - 按月分区';
COMMENT ON FUNCTION create_audit_log_partition IS '为指定月份创建分区';
COMMENT ON FUNCTION maintain_audit_log_partitions IS '维护未来3个月的分区';
COMMENT ON FUNCTION cleanup_old_audit_partitions IS '删除超过指定月数的旧分区';
