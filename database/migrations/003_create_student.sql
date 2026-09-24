CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL,

    current_score NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (current_score >= 0 AND current_score <= 100),

    version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, email)
);