-- Channel verification applications (badge)

CREATE TABLE IF NOT EXISTS verification_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(120) NOT NULL,
    role VARCHAR(40) NOT NULL CHECK (role IN ('developer', 'gamer', 'tutorial_maker')),
    product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('video', 'link')),
    product_video_url TEXT,
    product_link TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    review_token_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id
    ON verification_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
    ON verification_requests(status);

CREATE INDEX IF NOT EXISTS idx_verification_requests_review_token
    ON verification_requests(review_token_hash);

-- Badge on user (kept even if name/username change)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- If table already existed without token column:
ALTER TABLE verification_requests
    ADD COLUMN IF NOT EXISTS review_token_hash TEXT;