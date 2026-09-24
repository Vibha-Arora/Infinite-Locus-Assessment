CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    competency_id UUID NOT NULL
        REFERENCES competencies(id),

    score NUMERIC(5,2) NOT NULL
        CHECK (score >= 0 AND score <= 100),

    evaluator_id UUID NOT NULL
        REFERENCES users(id),

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    is_void BOOLEAN NOT NULL DEFAULT FALSE,

    voided_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);