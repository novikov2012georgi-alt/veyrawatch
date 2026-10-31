import "dotenv/config";

import { Pool } from "pg";

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});


export async function testDatabase() {
    const result = await pool.query(
        "SELECT NOW() AS now"
    );

    return result.rows[0];
}


export async function updateUserAvatar(
    userId: number,
    avatarUrl: string
) {
    const result = await pool.query(
        `UPDATE users
         SET avatar_url = $1
         WHERE id = $2
         RETURNING id, avatar_url`,
        [avatarUrl, userId]
    );

    return result.rows[0];
}


export async function updateUserProfile(
    userId: number,
    name: string,
    username: string,
    bio: string
) {
    const existing = await pool.query(
        `SELECT id
         FROM users
         WHERE username = $1
           AND id <> $2`,
        [username, userId]
    );

    if (existing.rows.length > 0) {
        throw new Error("USERNAME_EXISTS");
    }

    const result = await pool.query(
        `UPDATE users
         SET name = $1,
             username = $2,
             bio = $3
         WHERE id = $4
         RETURNING id, name, username, email, avatar_url, bio, created_at`,
        [name, username, bio, userId]
    );

    return result.rows[0];
}


export async function searchUsers(query: string, limit = 20) {
    const cleaned = query.replace(/^@+/, "").trim();
    const pattern = `%${cleaned}%`;

    const result = await pool.query(
        `SELECT id, name, username, avatar_url, bio, is_verified, created_at
         FROM users
         WHERE username ILIKE $1
            OR name ILIKE $1
         ORDER BY
           CASE
             WHEN LOWER(username) = LOWER($2) THEN 0
             WHEN username ILIKE $2 THEN 1
             WHEN name ILIKE $2 THEN 2
             ELSE 3
           END,
           username ASC
         LIMIT $3`,
        [pattern, cleaned, limit]
    );

    return result.rows;
}


export async function getUserByUsername(username: string) {
    const cleaned = username.replace(/^@+/, "").trim();

    const result = await pool.query(
        `SELECT id, name, username, avatar_url, bio, is_verified, created_at
         FROM users
         WHERE LOWER(username) = LOWER($1)`,
        [cleaned]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


export async function createVideo(params: {
    userId: number;
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    durationSeconds: number;
}) {
    const result = await pool.query(
        `INSERT INTO videos (
            user_id,
            title,
            description,
            video_url,
            thumbnail_url,
            duration_seconds
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id, title, description, video_url, thumbnail_url,
                  duration_seconds, created_at`,
        [
            params.userId,
            params.title,
            params.description,
            params.videoUrl,
            params.thumbnailUrl,
            params.durationSeconds
        ]
    );

    return result.rows[0];
}


export async function getVideosByUserId(userId: number) {
    const result = await pool.query(
        `SELECT id, user_id, title, description, video_url, thumbnail_url,
                duration_seconds, views, created_at
         FROM videos
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );

    return result.rows;
}


export async function getVideoById(videoId: number) {
    const result = await pool.query(
        `SELECT videos.id,
                videos.user_id,
                videos.title,
                videos.description,
                videos.video_url,
                videos.thumbnail_url,
                videos.duration_seconds,
                videos.views,
                videos.created_at,
                users.username,
                users.name AS user_name,
                users.avatar_url AS user_avatar_url,
                users.is_verified AS user_is_verified
         FROM videos
         JOIN users ON users.id = videos.user_id
         WHERE videos.id = $1`,
        [videoId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


export async function countVideosByUserId(userId: number) {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM videos
         WHERE user_id = $1`,
        [userId]
    );

    return result.rows[0]?.count ?? 0;
}


export async function deleteVideoById(videoId: number, userId: number) {
    const result = await pool.query(
        `DELETE FROM videos
         WHERE id = $1
           AND user_id = $2
         RETURNING id, video_url, thumbnail_url`,
        [videoId, userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


export async function getVideoEngagement(videoId: number, viewerId: number | null) {
    const counts = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN reaction = 1 THEN 1 ELSE 0 END), 0)::int AS likes,
            COALESCE(SUM(CASE WHEN reaction = -1 THEN 1 ELSE 0 END), 0)::int AS dislikes
         FROM video_reactions
         WHERE video_id = $1`,
        [videoId]
    );

    const commentsCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM video_comments
         WHERE video_id = $1`,
        [videoId]
    );

    let myReaction: number | null = null;
    let subscribed = false;

    if (viewerId) {
        const reaction = await pool.query(
            `SELECT reaction
             FROM video_reactions
             WHERE video_id = $1 AND user_id = $2`,
            [videoId, viewerId]
        );

        if (reaction.rows.length > 0) {
            myReaction = reaction.rows[0].reaction;
        }

        const videoOwner = await pool.query(
            `SELECT user_id FROM videos WHERE id = $1`,
            [videoId]
        );

        if (videoOwner.rows.length > 0) {
            const channelId = videoOwner.rows[0].user_id;
            const sub = await pool.query(
                `SELECT 1
                 FROM subscriptions
                 WHERE subscriber_id = $1 AND channel_id = $2`,
                [viewerId, channelId]
            );
            subscribed = sub.rows.length > 0;
        }
    }

    return {
        likes: counts.rows[0]?.likes ?? 0,
        dislikes: counts.rows[0]?.dislikes ?? 0,
        comments: commentsCount.rows[0]?.count ?? 0,
        myReaction,
        subscribed
    };
}


export async function setVideoReaction(videoId: number, userId: number, reaction: 1 | -1) {
    const existing = await pool.query(
        `SELECT reaction
         FROM video_reactions
         WHERE video_id = $1 AND user_id = $2`,
        [videoId, userId]
    );

    if (existing.rows.length > 0 && existing.rows[0].reaction === reaction) {
        await pool.query(
            `DELETE FROM video_reactions
             WHERE video_id = $1 AND user_id = $2`,
            [videoId, userId]
        );
    } else if (existing.rows.length > 0) {
        await pool.query(
            `UPDATE video_reactions
             SET reaction = $3
             WHERE video_id = $1 AND user_id = $2`,
            [videoId, userId, reaction]
        );
    } else {
        await pool.query(
            `INSERT INTO video_reactions (video_id, user_id, reaction)
             VALUES ($1, $2, $3)`,
            [videoId, userId, reaction]
        );
    }

    return getVideoEngagement(videoId, userId);
}


export async function toggleSubscription(channelId: number, subscriberId: number) {
    if (channelId === subscriberId) {
        throw new Error("CANNOT_SUBSCRIBE_SELF");
    }

    const existing = await pool.query(
        `SELECT 1
         FROM subscriptions
         WHERE subscriber_id = $1 AND channel_id = $2`,
        [subscriberId, channelId]
    );

    if (existing.rows.length > 0) {
        await pool.query(
            `DELETE FROM subscriptions
             WHERE subscriber_id = $1 AND channel_id = $2`,
            [subscriberId, channelId]
        );
        return { subscribed: false };
    }

    await pool.query(
        `INSERT INTO subscriptions (subscriber_id, channel_id)
         VALUES ($1, $2)`,
        [subscriberId, channelId]
    );

    return { subscribed: true };
}


export async function getVideoComments(videoId: number) {
    const result = await pool.query(
        `SELECT video_comments.id,
                video_comments.body,
                video_comments.created_at,
                users.id AS user_id,
                users.name AS user_name,
                users.username,
                users.avatar_url,
                users.is_verified AS user_is_verified
         FROM video_comments
         JOIN users ON users.id = video_comments.user_id
         WHERE video_comments.video_id = $1
         ORDER BY video_comments.created_at DESC`,
        [videoId]
    );

    return result.rows;
}


export async function addVideoComment(videoId: number, userId: number, body: string) {
    const result = await pool.query(
        `INSERT INTO video_comments (video_id, user_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, body, created_at`,
        [videoId, userId, body]
    );

    const user = await pool.query(
        `SELECT id, name, username, avatar_url, is_verified
         FROM users
         WHERE id = $1`,
        [userId]
    );

    return {
        ...result.rows[0],
        user_id: user.rows[0].id,
        user_name: user.rows[0].name,
        username: user.rows[0].username,
        avatar_url: user.rows[0].avatar_url,
        user_is_verified: user.rows[0].is_verified
    };
}


export async function deleteVideoComment(commentId: number, userId: number) {
    const result = await pool.query(
        `DELETE FROM video_comments
         WHERE id = $1
           AND user_id = $2
         RETURNING id, video_id`,
        [commentId, userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


export async function getUserProfileStats(userId: number) {
    const videos = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM videos
         WHERE user_id = $1`,
        [userId]
    );

    const likes = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM video_reactions
         JOIN videos ON videos.id = video_reactions.video_id
         WHERE videos.user_id = $1
           AND video_reactions.reaction = 1`,
        [userId]
    );

    const subscribers = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM subscriptions
         WHERE channel_id = $1`,
        [userId]
    );

    return {
        videos: videos.rows[0]?.count ?? 0,
        likes: likes.rows[0]?.count ?? 0,
        subscribers: subscribers.rows[0]?.count ?? 0
    };
}


export async function incrementVideoViews(videoId: number) {
    const result = await pool.query(
        `UPDATE videos
         SET views = views + 1
         WHERE id = $1
         RETURNING id, views`,
        [videoId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


export async function getRecommendedVideos(limit = 24) {
    const result = await pool.query(
        `SELECT videos.id,
                videos.user_id,
                videos.title,
                videos.description,
                videos.video_url,
                videos.thumbnail_url,
                videos.duration_seconds,
                videos.views,
                videos.created_at,
                users.username,
                users.name AS user_name,
                users.avatar_url AS user_avatar_url,
                users.is_verified AS user_is_verified,
                COALESCE(like_counts.likes, 0)::int AS likes
         FROM videos
         JOIN users ON users.id = videos.user_id
         LEFT JOIN (
            SELECT video_id, COUNT(*)::int AS likes
            FROM video_reactions
            WHERE reaction = 1
            GROUP BY video_id
         ) like_counts ON like_counts.video_id = videos.id
         ORDER BY
           (COALESCE(videos.views, 0) * 3 + COALESCE(like_counts.likes, 0) * 5)
             / (EXTRACT(EPOCH FROM (NOW() - videos.created_at)) / 3600.0 + 6)
             DESC,
           videos.created_at DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}


export async function getFreshVideos(limit = 24) {
    const result = await pool.query(
        `SELECT videos.id,
                videos.user_id,
                videos.title,
                videos.description,
                videos.video_url,
                videos.thumbnail_url,
                videos.duration_seconds,
                videos.views,
                videos.created_at,
                users.username,
                users.name AS user_name,
                users.avatar_url AS user_avatar_url,
                users.is_verified AS user_is_verified
         FROM videos
         JOIN users ON users.id = videos.user_id
         ORDER BY videos.created_at DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}


export async function getPopularVideos(limit = 24) {
    const result = await pool.query(
        `SELECT videos.id,
                videos.user_id,
                videos.title,
                videos.description,
                videos.video_url,
                videos.thumbnail_url,
                videos.duration_seconds,
                videos.views,
                videos.created_at,
                users.username,
                users.name AS user_name,
                users.avatar_url AS user_avatar_url,
                users.is_verified AS user_is_verified
         FROM videos
         JOIN users ON users.id = videos.user_id
         ORDER BY videos.views DESC, videos.created_at DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}

export async function getPendingVerificationRequest(userId: number) {
    const result = await pool.query(
        `SELECT id, user_id, display_name, role, product_type,
                product_video_url, product_link, status, created_at
         FROM verification_requests
         WHERE user_id = $1
           AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


export async function createVerificationRequest(params: {
    userId: number;
    displayName: string;
    role: "developer" | "gamer" | "tutorial_maker";
    productType: "video" | "link";
    productVideoUrl: string | null;
    productLink: string | null;
    reviewTokenHash: string;
}) {
    const result = await pool.query(
        `INSERT INTO verification_requests (
            user_id,
            display_name,
            role,
            product_type,
            product_video_url,
            product_link,
            status,
            review_token_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING id, user_id, display_name, role, product_type,
                  product_video_url, product_link, status, created_at`,
        [
            params.userId,
            params.displayName,
            params.role,
            params.productType,
            params.productVideoUrl,
            params.productLink,
            params.reviewTokenHash
        ]
    );

    return result.rows[0];
}


export async function getVerificationRequestByReviewToken(tokenHash: string) {
    const result = await pool.query(
        `SELECT verification_requests.id,
                verification_requests.user_id,
                verification_requests.display_name,
                verification_requests.role,
                verification_requests.product_type,
                verification_requests.product_video_url,
                verification_requests.product_link,
                verification_requests.status,
                verification_requests.created_at,
                users.username,
                users.name AS user_name,
                users.email AS user_email
         FROM verification_requests
         JOIN users ON users.id = verification_requests.user_id
         WHERE verification_requests.review_token_hash = $1`,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}


export async function approveVerificationRequest(requestId: number, userId: number) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const updated = await client.query(
            `UPDATE verification_requests
             SET status = 'approved',
                 reviewed_at = NOW(),
                 review_token_hash = NULL
             WHERE id = $1
               AND status = 'pending'
             RETURNING id`,
            [requestId]
        );

        if (updated.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        await client.query(
            `UPDATE users
             SET is_verified = TRUE
             WHERE id = $1`,
            [userId]
        );

        await client.query("COMMIT");
        return updated.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


export async function rejectVerificationRequest(requestId: number) {
    const result = await pool.query(
        `UPDATE verification_requests
         SET status = 'rejected',
             reviewed_at = NOW(),
             review_token_hash = NULL
         WHERE id = $1
           AND status = 'pending'
         RETURNING id`,
        [requestId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}