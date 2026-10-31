import { pool } from "../db.js";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
    sendVerificationEmail,
    sendPasswordResetEmail
} from "../email.js";

function generateVerificationCode() {
    return randomInt(100000, 1000000).toString();
}

function hashVerificationCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
}

function hashResetToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(
    name: string,
    username: string,
    email: string,
    password: string
) {
    const existingUser = await pool.query(
        `SELECT id, username, email
         FROM users
         WHERE username = $1 OR email = $2`,
        [username, email]
    );

    if (existingUser.rows.length > 0) {
        const user = existingUser.rows[0];

        if (user.email === email) {
            throw new Error("EMAIL_EXISTS");
        }

        if (user.username === username) {
            throw new Error("USERNAME_EXISTS");
        }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationCode = generateVerificationCode();
    const verificationCodeHash = hashVerificationCode(verificationCode);
    const verificationExpiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
    );

    const result = await pool.query(
        `INSERT INTO users (
            name,
            username,
            email,
            password_hash,
            email_verified,
            verification_code_hash,
            verification_expires_at
        )
        VALUES ($1, $2, $3, $4, FALSE, $5, $6)
        RETURNING id, name, username, email, avatar_url, created_at`,
        [
            name,
            username,
            email,
            passwordHash,
            verificationCodeHash,
            verificationExpiresAt
        ]
    );

    await sendVerificationEmail(email, verificationCode);

    return result.rows[0];
}

export async function verifyEmail(
    email: string,
    code: string
) {
    const result = await pool.query(
        `SELECT id, name, username, email, avatar_url, created_at,
                email_verified, verification_code_hash, verification_expires_at
         FROM users
         WHERE email = $1`,
        [email]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const user = result.rows[0];

    if (user.email_verified) {
        return user;
    }

    if (!user.verification_code_hash || !user.verification_expires_at) {
        return null;
    }

    if (new Date(user.verification_expires_at).getTime() < Date.now()) {
        return null;
    }

    const codeHash = hashVerificationCode(code);

    if (codeHash !== user.verification_code_hash) {
        return null;
    }

    const verifiedUser = await pool.query(
        `UPDATE users
         SET email_verified = TRUE,
             verification_code_hash = NULL,
             verification_expires_at = NULL
         WHERE id = $1
         RETURNING id, name, username, email, avatar_url, created_at`,
        [user.id]
    );

    return verifiedUser.rows[0];
}

export async function loginUser(
    email: string,
    password: string
) {
    const result = await pool.query(
        `SELECT id, name, username, email, password_hash,
                avatar_url, created_at, email_verified
         FROM users
         WHERE email = $1`,
        [email]
    );

    if (result.rows.length === 0) {
        return {
            status: "not_found"
        };
    }

    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordCorrect) {
        return {
            status: "invalid_password"
        };
    }

    if (!user.email_verified) {
        return {
            status: "unverified"
        };
    }

    return {
        status: "success",
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
            created_at: user.created_at
        }
    };
}

export async function requestPasswordReset(
    email: string,
    username: string
) {
    const result = await pool.query(
        `SELECT id, email, username
         FROM users
         WHERE email = $1 AND username = $2`,
        [email, username]
    );

    if (result.rows.length === 0) {
        return {
            status: "not_found"
        };
    }

    const user = result.rows[0];

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = hashResetToken(resetToken);

    const resetExpiresAt = new Date(
        Date.now() + 60 * 60 * 1000
    );

    await pool.query(
        `UPDATE users
         SET password_reset_token_hash = $1,
             password_reset_expires_at = $2
         WHERE id = $3`,
        [
            resetTokenHash,
            resetExpiresAt,
            user.id
        ]
    );

    const resetUrl =
        `http://localhost:3000/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(
        user.email,
        resetUrl
    );

    return {
        status: "success"
    };
}

export async function resetPassword(
    token: string,
    newPassword: string
) {
    const tokenHash = hashResetToken(token);

    const result = await pool.query(
        `SELECT id, password_reset_expires_at
         FROM users
         WHERE password_reset_token_hash = $1`,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        return {
            status: "invalid_token"
        };
    }

    const user = result.rows[0];

    if (
        !user.password_reset_expires_at ||
        new Date(user.password_reset_expires_at).getTime() < Date.now()
    ) {
        return {
            status: "expired"
        };
    }

    const passwordHash = await bcrypt.hash(
        newPassword,
        12
    );

    await pool.query(
        `UPDATE users
         SET password_hash = $1,
             password_reset_token_hash = NULL,
             password_reset_expires_at = NULL
         WHERE id = $2`,
        [
            passwordHash,
            user.id
        ]
    );

    return {
        status: "success"
    };
}