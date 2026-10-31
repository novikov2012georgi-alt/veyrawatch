import { pool } from "./db.js";
import { createHash, randomBytes } from "node:crypto";

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    await pool.query(
        `INSERT INTO sessions (
            user_id,
            token_hash,
            expires_at
        )
        VALUES ($1, $2, $3)`,
        [
            userId,
            tokenHash,
            expiresAt
        ]
    );

    return token;
}

export async function getSessionUser(token: string) {
    const tokenHash = hashToken(token);

    const result = await pool.query(
        `SELECT users.id,
                users.name,
                users.username,
                users.email,
                users.avatar_url,
                users.bio,
                users.is_verified,
                users.created_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = $1
           AND sessions.expires_at > NOW()`,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

export async function deleteSession(token: string) {
    const tokenHash = hashToken(token);

    await pool.query(
        `DELETE FROM sessions
         WHERE token_hash = $1`,
        [tokenHash]
    );
}