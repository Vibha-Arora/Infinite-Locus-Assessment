CREATE TABLE competencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    key VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    weight NUMERIC(5,4) NOT NULL
        CHECK (weight > 0 AND weight <= 1),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO competencies (key, name, weight)
VALUES
    ('frontend', 'Frontend', 0.30),
    ('backend', 'Backend', 0.30),
    ('databases', 'Databases', 0.25),
    ('problem_solving', 'Problem Solving', 0.15);