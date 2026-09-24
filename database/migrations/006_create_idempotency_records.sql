CREATE TABLE idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    idempotency_key VARCHAR(255) NOT NULL,

    request_fingerprint CHAR(64) NOT NULL,

    status_code INTEGER NOT NULL,

    response_body JSONB NOT NULL,

    attempt_id UUID
        REFERENCES attempts(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    UNIQUE (tenant_id, idempotency_key)
);