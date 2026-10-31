import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
    registerUser,
    loginUser,
    verifyEmail,
    requestPasswordReset,
    resetPassword
} from "./routes/auth.js";

import {
    createSession,
    getSessionUser,
    deleteSession
} from "./session.js";

import { sendVerificationRequestToAdmin } from "./email.js";

import { createHash, randomBytes } from "node:crypto";

import {
    updateUserAvatar,
    updateUserProfile,
    searchUsers,
    getUserByUsername,
    createVideo,
    getVideosByUserId,
    getVideoById,
    countVideosByUserId,
    deleteVideoById,
    getVideoEngagement,
    setVideoReaction,
    toggleSubscription,
    getVideoComments,
    addVideoComment,
    deleteVideoComment,
    getUserProfileStats,
    incrementVideoViews,
    getRecommendedVideos,
    getFreshVideos,
    getPopularVideos,
    getPendingVerificationRequest,
    createVerificationRequest,
    getVerificationRequestByReviewToken,
    approveVerificationRequest,
    rejectVerificationRequest
} from "./db.js";

const app = Fastify({
    logger: true
});

app.register(fastifyCookie);
app.register(fastifyMultipart, {
    limits: {
        fileSize: 500 * 1024 * 1024
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.join(__dirname, "../uploads");
const avatarsDir = path.join(uploadsRoot, "avatars");
const videosDir = path.join(uploadsRoot, "videos");
const thumbnailsDir = path.join(uploadsRoot, "thumbnails");

await fs.mkdir(avatarsDir, { recursive: true });
await fs.mkdir(videosDir, { recursive: true });
await fs.mkdir(thumbnailsDir, { recursive: true });

const verificationDir = path.join(uploadsRoot, "verification");
await fs.mkdir(verificationDir, { recursive: true });

app.register(fastifyStatic, {
    root: path.join(__dirname, "../frontend"),
    prefix: "/"
});

app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: "/uploads/",
    decorateReply: false
});

app.get("/reset-password", async (request, reply) => {
    return reply.sendFile("index.html");
});

app.get("/api/auth/me", async (request, reply) => {
    const sessionToken = request.cookies.veyrawatch_session;

    if (!sessionToken) {
        return reply.code(401).send({
            error: "Not authenticated"
        });
    }

    try {
        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({
                error: "Invalid or expired session"
            });
        }

        return reply.send({
            user
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not check session"
        });
    }
});

app.post("/api/auth/logout", async (request, reply) => {
    const sessionToken = request.cookies.veyrawatch_session;

    if (sessionToken) {
        try {
            await deleteSession(sessionToken);
        } catch (error) {
            console.error(error);

            return reply.code(500).send({
                error: "Could not logout"
            });
        }
    }

    return reply
        .clearCookie("veyrawatch_session", {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/"
        })
        .send({
            message: "Logout successful"
        });
});

app.post("/api/auth/register", async (request, reply) => {
    const body = request.body as {
        name?: string;
        username?: string;
        email?: string;
        password?: string;
    };

    if (!body.name || !body.username || !body.email || !body.password) {
        return reply.code(400).send({
            error: "Name, username, email and password are required"
        });
    }

    try {
        const user = await registerUser(
            body.name,
            body.username,
            body.email,
            body.password
        );

        return reply.code(201).send({
            message: "Verification required",
            user
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "EMAIL_EXISTS") {
                return reply.code(409).send({
                    error: "Email is already in use"
                });
            }

            if (error.message === "USERNAME_EXISTS") {
                return reply.code(409).send({
                    error: "Username is already in use"
                });
            }
        }

        console.error(error);

        return reply.code(500).send({
            error: "Could not register user"
        });
    }
});

app.post("/api/auth/verify-email", async (request, reply) => {
    const body = request.body as {
        email?: string;
        code?: string;
    };

    if (!body.email || !body.code) {
        return reply.code(400).send({
            error: "Email and verification code are required"
        });
    }

    try {
        const user = await verifyEmail(
            body.email,
            body.code
        );

        if (!user) {
            return reply.code(400).send({
                error: "Invalid or expired verification code"
            });
        }

        return reply.send({
            message: "Email verified successfully",
            user
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not verify email"
        });
    }
});

app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as {
        email?: string;
        password?: string;
    };

    if (!body.email || !body.password) {
        return reply.code(400).send({
            error: "Email and password are required"
        });
    }

    try {
        const result = await loginUser(
            body.email,
            body.password
        );

        if (result.status === "not_found") {
            return reply.code(404).send({
                error: "Account not found"
            });
        }

        if (result.status === "invalid_password") {
            return reply.code(401).send({
                error: "Invalid email or password"
            });
        }

        if (result.status === "unverified") {
            return reply.code(403).send({
                error: "Please verify your email first"
            });
        }

        if (!result.user) {
            return reply.code(500).send({
                error: "Could not create session"
            });
        }

        const sessionToken = await createSession(result.user.id);

        return reply
            .setCookie("veyrawatch_session", sessionToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: false,
                path: "/",
                maxAge: 30 * 24 * 60 * 60
            })
            .send({
                message: "Login successful",
                user: result.user
            });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not login"
        });
    }
});

app.post("/api/auth/forgot-password", async (request, reply) => {
    const body = request.body as {
        email?: string;
        username?: string;
    };

    if (!body.email || !body.username) {
        return reply.code(400).send({
            error: "Email and username are required"
        });
    }

    try {
        const result = await requestPasswordReset(
            body.email,
            body.username
        );

        if (result.status === "not_found") {
            return reply.code(404).send({
                error: "Account not found"
            });
        }

        return reply.send({
            message: "Password reset email sent"
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not request password reset"
        });
    }
});

app.post("/api/auth/reset-password", async (request, reply) => {
    const body = request.body as {
        token?: string;
        password?: string;
    };

    if (!body.token || !body.password) {
        return reply.code(400).send({
            error: "Token and password are required"
        });
    }

    try {
        const result = await resetPassword(
            body.token,
            body.password
        );

        if (result.status === "invalid_token") {
            return reply.code(400).send({
                error: "Invalid password reset token"
            });
        }

        if (result.status === "expired") {
            return reply.code(400).send({
                error: "Password reset token has expired"
            });
        }

        return reply.send({
            message: "Password reset successfully"
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not reset password"
        });
    }
});

app.post("/api/profile/avatar", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({
                error: "Not authenticated"
            });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({
                error: "Invalid or expired session"
            });
        }

        const file = await request.file();

        if (!file) {
            return reply.code(400).send({
                error: "Avatar file is required"
            });
        }

        const extension = path
            .extname(file.filename)
            .toLowerCase();

        const allowedExtensions = [
            ".png",
            ".jpg",
            ".jpeg",
            ".ico"
        ];

        if (!allowedExtensions.includes(extension)) {
            return reply.code(400).send({
                error: "Unsupported avatar format"
            });
        }

        const fileName = `${Date.now()}${extension}`;

        const filePath = path.join(
            __dirname,
            "../uploads/avatars",
            fileName
        );

        const buffer = await file.toBuffer();

        await fs.writeFile(
            filePath,
            buffer
        );

        const avatarUrl = `/uploads/avatars/${fileName}`;

        await updateUserAvatar(
            user.id,
            avatarUrl
        );

        console.log(
            `Avatar saved for user ${user.id}:`,
            fileName
        );

        return reply.send({
            message: "Avatar uploaded successfully",
            avatarUrl
        });

    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not upload avatar"
        });
    }
});

app.post("/api/profile", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({
                error: "Not authenticated"
            });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({
                error: "Invalid or expired session"
            });
        }

        const body = request.body as {
            name?: string;
            username?: string;
            bio?: string;
        };

        const name = (body.name || "").trim();
        const username = (body.username || "").trim();
        const bio = (body.bio || "").trim();

        if (!name || !username) {
            return reply.code(400).send({
                error: "Name and username are required"
            });
        }

        if (username.length < 3) {
            return reply.code(400).send({
                error: "Username must be at least 3 characters"
            });
        }

        if (bio.length > 300) {
            return reply.code(400).send({
                error: "Bio must be at most 300 characters"
            });
        }

        const updatedUser = await updateUserProfile(
            user.id,
            name,
            username,
            bio
        );

        return reply.send({
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (error) {
        if (error instanceof Error && error.message === "USERNAME_EXISTS") {
            return reply.code(409).send({
                error: "Username is already in use"
            });
        }

        console.error(error);

        return reply.code(500).send({
            error: "Could not update profile"
        });
    }
});

app.get("/api/users/search", async (request, reply) => {
    const query = request.query as { q?: string };

    const q = (query.q || "").replace(/^@+/, "").trim();

    if (!q) {
        return reply.code(400).send({
            error: "Search query is required"
        });
    }

    try {
        const users = await searchUsers(q);

        return reply.send({
            users
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not search users"
        });
    }
});

app.get("/api/users/:username", async (request, reply) => {
    const params = request.params as { username?: string };
    const username = (params.username || "").replace(/^@+/, "").trim();

    if (!username) {
        return reply.code(400).send({
            error: "Username is required"
        });
    }

    try {
        const user = await getUserByUsername(username);

        if (!user) {
            return reply.code(404).send({
                error: "User not found"
            });
        }

        const stats = await getUserProfileStats(Number(user.id));

        return reply.send({
            user,
            stats
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not load user"
        });
    }
});

app.post("/api/videos", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({
                error: "Not authenticated"
            });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({
                error: "Invalid or expired session"
            });
        }

        let title = "";
        let description = "";
        let durationSeconds = 0;
        let videoBuffer: Buffer | null = null;
        let videoExt = ".mp4";
        let thumbnailBuffer: Buffer | null = null;
        let thumbnailExt = ".png";

        const parts = request.parts();

        for await (const part of parts) {
            if (part.type === "file") {
                const buffer = await part.toBuffer();
                const field = part.fieldname;
                const ext = path.extname(part.filename || "").toLowerCase();

                if (field === "video") {
                    if (ext && ext !== ".mp4" && part.mimetype !== "video/mp4") {
                        return reply.code(400).send({
                            error: "Only .mp4 videos are supported"
                        });
                    }
                    videoBuffer = buffer;
                    videoExt = ".mp4";
                } else if (field === "thumbnail" || field === "icon") {
                    const allowed = [".png", ".jpg", ".jpeg", ".ico"];
                    if (ext && !allowed.includes(ext)) {
                        return reply.code(400).send({
                            error: "Unsupported thumbnail format"
                        });
                    }
                    thumbnailBuffer = buffer;
                    thumbnailExt = ext || ".png";
                }
            } else {
                const value = String(part.value || "");

                if (part.fieldname === "title") {
                    title = value.trim();
                } else if (part.fieldname === "description") {
                    description = value.trim();
                } else if (part.fieldname === "duration") {
                    const parsed = Number(value);
                    if (Number.isFinite(parsed) && parsed >= 0) {
                        durationSeconds = Math.round(parsed);
                    }
                }
            }
        }

        if (!videoBuffer) {
            return reply.code(400).send({
                error: "Video file is required"
            });
        }

        if (!title) {
            return reply.code(400).send({
                error: "Title is required"
            });
        }

        if (title.length > 120) {
            return reply.code(400).send({
                error: "Title must be at most 120 characters"
            });
        }

        if (description.length > 5000) {
            return reply.code(400).send({
                error: "Description must be at most 5000 characters"
            });
        }

        const stamp = Date.now();
        const videoFileName = `${stamp}${videoExt}`;
        const videoPath = path.join(videosDir, videoFileName);
        await fs.writeFile(videoPath, videoBuffer);
        const videoUrl = `/uploads/videos/${videoFileName}`;

        let thumbnailUrl: string | null = null;

        if (thumbnailBuffer) {
            const thumbFileName = `${stamp}${thumbnailExt}`;
            const thumbPath = path.join(thumbnailsDir, thumbFileName);
            await fs.writeFile(thumbPath, thumbnailBuffer);
            thumbnailUrl = `/uploads/thumbnails/${thumbFileName}`;
        }

        const video = await createVideo({
            userId: user.id,
            title,
            description,
            videoUrl,
            thumbnailUrl,
            durationSeconds
        });

        return reply.code(201).send({
            message: "Video published successfully",
            video
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not publish video"
        });
    }
});


app.get("/api/videos", async (request, reply) => {
    const query = request.query as { sort?: string; limit?: string };
    const sort = (query.sort || "recommended").toLowerCase();
    const limitRaw = Number(query.limit);
    const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(Math.round(limitRaw), 1), 50)
        : 24;

    try {
        let videos;

        if (sort === "fresh" || sort === "new") {
            videos = await getFreshVideos(limit);
        } else if (sort === "popular") {
            videos = await getPopularVideos(limit);
        } else {
            videos = await getRecommendedVideos(limit);
        }

        return reply.send({ videos, sort });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not load videos" });
    }
});

app.get("/api/videos/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const id = Number(params.id);

    if (!Number.isFinite(id) || id <= 0) {
        return reply.code(400).send({
            error: "Invalid video id"
        });
    }

    try {
        const video = await getVideoById(id);

        if (!video) {
            return reply.code(404).send({
                error: "Video not found"
            });
        }

        let viewerId: number | null = null;
        const sessionToken = request.cookies.veyrawatch_session;

        if (sessionToken) {
            try {
                const sessionUser = await getSessionUser(sessionToken);
                if (sessionUser) {
                    viewerId = Number(sessionUser.id);
                }
            } catch (_) {}
        }

        const engagement = await getVideoEngagement(id, viewerId);

        return reply.send({
            video: {
                ...video,
                ...engagement
            }
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not load video"
        });
    }
});


app.post("/api/videos/:id/view", async (request, reply) => {
    const id = Number((request.params as { id?: string }).id);

    if (!Number.isFinite(id) || id <= 0) {
        return reply.code(400).send({ error: "Invalid video id" });
    }

    try {
        const updated = await incrementVideoViews(id);

        if (!updated) {
            return reply.code(404).send({ error: "Video not found" });
        }

        return reply.send({
            views: updated.views
        });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not count view" });
    }
});

app.post("/api/videos/:id/like", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({ error: "Not authenticated" });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({ error: "Invalid or expired session" });
        }

        const id = Number((request.params as { id?: string }).id);

        if (!Number.isFinite(id) || id <= 0) {
            return reply.code(400).send({ error: "Invalid video id" });
        }

        const video = await getVideoById(id);

        if (!video) {
            return reply.code(404).send({ error: "Video not found" });
        }

        const engagement = await setVideoReaction(id, Number(user.id), 1);

        return reply.send({ engagement });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not like video" });
    }
});

app.post("/api/videos/:id/dislike", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({ error: "Not authenticated" });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({ error: "Invalid or expired session" });
        }

        const id = Number((request.params as { id?: string }).id);

        if (!Number.isFinite(id) || id <= 0) {
            return reply.code(400).send({ error: "Invalid video id" });
        }

        const video = await getVideoById(id);

        if (!video) {
            return reply.code(404).send({ error: "Video not found" });
        }

        const engagement = await setVideoReaction(id, Number(user.id), -1);

        return reply.send({ engagement });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not dislike video" });
    }
});

app.post("/api/videos/:id/subscribe", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({ error: "Not authenticated" });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({ error: "Invalid or expired session" });
        }

        const id = Number((request.params as { id?: string }).id);

        if (!Number.isFinite(id) || id <= 0) {
            return reply.code(400).send({ error: "Invalid video id" });
        }

        const video = await getVideoById(id);

        if (!video) {
            return reply.code(404).send({ error: "Video not found" });
        }

        if (Number(video.user_id) === Number(user.id)) {
            return reply.code(400).send({ error: "Cannot subscribe to yourself" });
        }

        const result = await toggleSubscription(
            Number(video.user_id),
            Number(user.id)
        );

        return reply.send(result);
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not update subscription" });
    }
});

app.get("/api/videos/:id/comments", async (request, reply) => {
    const id = Number((request.params as { id?: string }).id);

    if (!Number.isFinite(id) || id <= 0) {
        return reply.code(400).send({ error: "Invalid video id" });
    }

    try {
        const video = await getVideoById(id);

        if (!video) {
            return reply.code(404).send({ error: "Video not found" });
        }

        const comments = await getVideoComments(id);

        return reply.send({ comments });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not load comments" });
    }
});

app.post("/api/videos/:id/comments", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({ error: "Not authenticated" });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({ error: "Invalid or expired session" });
        }

        const id = Number((request.params as { id?: string }).id);

        if (!Number.isFinite(id) || id <= 0) {
            return reply.code(400).send({ error: "Invalid video id" });
        }

        const body = request.body as { text?: string };
        const text = (body.text || "").trim();

        if (!text) {
            return reply.code(400).send({ error: "Comment text is required" });
        }

        if (text.length > 2000) {
            return reply.code(400).send({ error: "Comment is too long" });
        }

        const video = await getVideoById(id);

        if (!video) {
            return reply.code(404).send({ error: "Video not found" });
        }

        const comment = await addVideoComment(id, Number(user.id), text);
        const engagement = await getVideoEngagement(id, Number(user.id));

        return reply.code(201).send({
            comment,
            engagement
        });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not add comment" });
    }
});


app.post("/api/videos/:id/comments/:commentId/delete", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({ error: "Not authenticated" });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({ error: "Invalid or expired session" });
        }

        const params = request.params as { id?: string; commentId?: string };
        const videoId = Number(params.id);
        const commentId = Number(params.commentId);

        if (!Number.isFinite(videoId) || videoId <= 0 || !Number.isFinite(commentId) || commentId <= 0) {
            return reply.code(400).send({ error: "Invalid id" });
        }

        const deleted = await deleteVideoComment(commentId, Number(user.id));

        if (!deleted) {
            return reply.code(404).send({ error: "Comment not found" });
        }

        if (Number(deleted.video_id) !== videoId) {
            return reply.code(404).send({ error: "Comment not found" });
        }

        const engagement = await getVideoEngagement(videoId, Number(user.id));

        return reply.send({
            message: "Comment deleted successfully",
            engagement
        });
    } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Could not delete comment" });
    }
});


app.delete("/api/videos/:id", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({
                error: "Not authenticated"
            });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({
                error: "Invalid or expired session"
            });
        }

        const params = request.params as { id?: string };
        const id = Number(params.id);

        if (!Number.isFinite(id) || id <= 0) {
            return reply.code(400).send({
                error: "Invalid video id"
            });
        }

        const deleted = await deleteVideoById(id, user.id);

        if (!deleted) {
            return reply.code(404).send({
                error: "Video not found"
            });
        }

        // best-effort remove files from disk
        try {
            if (deleted.video_url && deleted.video_url.startsWith("/uploads/")) {
                await fs.unlink(path.join(__dirname, "..", deleted.video_url));
            }
        } catch (_) {}

        try {
            if (deleted.thumbnail_url && deleted.thumbnail_url.startsWith("/uploads/")) {
                await fs.unlink(path.join(__dirname, "..", deleted.thumbnail_url));
            }
        } catch (_) {}

        return reply.send({
            message: "Video deleted successfully"
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not delete video"
        });
    }
});

app.get("/api/users/:username/videos", async (request, reply) => {
    const params = request.params as { username?: string };
    const username = (params.username || "").replace(/^@+/, "").trim();

    if (!username) {
        return reply.code(400).send({
            error: "Username is required"
        });
    }

    try {
        const user = await getUserByUsername(username);

        if (!user) {
            return reply.code(404).send({
                error: "User not found"
            });
        }

        const videos = await getVideosByUserId(user.id);
        const count = await countVideosByUserId(user.id);

        return reply.send({
            videos,
            count
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not load videos"
        });
    }
});


app.post("/api/verification/request", async (request, reply) => {
    try {
        const sessionToken = request.cookies.veyrawatch_session;

        if (!sessionToken) {
            return reply.code(401).send({
                error: "Not authenticated"
            });
        }

        const user = await getSessionUser(sessionToken);

        if (!user) {
            return reply.code(401).send({
                error: "Invalid or expired session"
            });
        }

        const pending = await getPendingVerificationRequest(user.id);

        if (pending) {
            return reply.code(409).send({
                error: "You already have a pending verification request"
            });
        }

        let displayName = "";
        let role = "";
        let productType = "";
        let productLink = "";
        let videoBuffer: Buffer | null = null;
        let videoExt = ".mp4";

        const parts = request.parts();

        for await (const part of parts) {
            if (part.type === "file") {
                if (part.fieldname === "productVideo") {
                    const buffer = await part.toBuffer();
                    const ext = path.extname(part.filename || "").toLowerCase();
                    videoBuffer = buffer;
                    videoExt = ext || ".mp4";
                }
            } else {
                const value = String(part.value || "").trim();

                if (part.fieldname === "name") {
                    displayName = value;
                } else if (part.fieldname === "role") {
                    role = value;
                } else if (part.fieldname === "product") {
                    productType = value;
                } else if (part.fieldname === "productLink") {
                    productLink = value;
                }
            }
        }

        if (!displayName) {
            return reply.code(400).send({
                error: "Name is required"
            });
        }

        if (displayName.length > 120) {
            return reply.code(400).send({
                error: "Name must be at most 120 characters"
            });
        }

        const allowedRoles = ["developer", "gamer", "tutorial_maker"];

        if (!allowedRoles.includes(role)) {
            return reply.code(400).send({
                error: "Invalid role"
            });
        }

        if (productType !== "video" && productType !== "link") {
            return reply.code(400).send({
                error: "Invalid product type"
            });
        }

        let productVideoUrl: string | null = null;
        let productLinkValue: string | null = null;

        if (productType === "video") {
            if (!videoBuffer) {
                return reply.code(400).send({
                    error: "Video file is required"
                });
            }

            const allowedVideoExt = [".mp4", ".webm", ".mov", ".mkv"];

            if (!allowedVideoExt.includes(videoExt)) {
                return reply.code(400).send({
                    error: "Unsupported video format"
                });
            }

            const fileName = `${user.id}-${Date.now()}${videoExt}`;
            const filePath = path.join(verificationDir, fileName);
            await fs.writeFile(filePath, videoBuffer);
            productVideoUrl = `/uploads/verification/${fileName}`;
        } else {
            if (!productLink) {
                return reply.code(400).send({
                    error: "Link is required"
                });
            }

            try {
                const parsed = new URL(productLink);
                if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                    return reply.code(400).send({
                        error: "Link must be http or https"
                    });
                }
            } catch {
                return reply.code(400).send({
                    error: "Invalid link"
                });
            }

            productLinkValue = productLink;
        }

        const reviewToken = randomBytes(32).toString("hex");
        const reviewTokenHash = createHash("sha256").update(reviewToken).digest("hex");

        const requestRow = await createVerificationRequest({
            userId: user.id,
            displayName,
            role: role as "developer" | "gamer" | "tutorial_maker",
            productType: productType as "video" | "link",
            productVideoUrl,
            productLink: productLinkValue,
            reviewTokenHash
        });

        const adminEmail = process.env.ADMIN_EMAIL;
        const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

        if (adminEmail) {
            const approveUrl = `${appUrl}/api/verification/review?token=${reviewToken}&action=approve`;
            const rejectUrl = `${appUrl}/api/verification/review?token=${reviewToken}&action=reject`;

            // Make product video URL absolute for the email
            let absoluteVideoUrl = productVideoUrl;
            if (absoluteVideoUrl && absoluteVideoUrl.startsWith("/")) {
                absoluteVideoUrl = `${appUrl}${absoluteVideoUrl}`;
            }

            try {
                await sendVerificationRequestToAdmin({
                    adminEmail,
                    username: user.username,
                    userEmail: user.email,
                    displayName,
                    role,
                    productType,
                    productVideoUrl: absoluteVideoUrl,
                    productLink: productLinkValue,
                    approveUrl,
                    rejectUrl
                });
            } catch (mailError) {
                console.error("Failed to send admin verification email:", mailError);
                // request is already saved — do not fail the user
            }
        } else {
            console.warn("ADMIN_EMAIL is not set — verification request email was not sent");
        }

        return reply.code(201).send({
            message: "Verification request submitted",
            request: requestRow
        });
    } catch (error) {
        console.error(error);

        return reply.code(500).send({
            error: "Could not submit verification request"
        });
    }
});


app.get("/api/verification/review", async (request, reply) => {
    const query = request.query as {
        token?: string;
        action?: string;
    };

    const token = (query.token || "").trim();
    const action = (query.action || "").trim().toLowerCase();

    function htmlPage(title: string, message: string) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Veyra Watch</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#000; color:#fff; font-family:Arial,sans-serif; }
    .card { width:420px; padding:38px; border:1px solid #fff; border-radius:14px; text-align:center;
            box-shadow:0 0 8px rgba(255,255,255,.9),0 0 25px rgba(255,255,255,.45); }
    h1 { margin:0 0 16px; font-size:24px; font-weight:500; }
    p { margin:0; color:#ccc; line-height:1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
    }

    if (!token || (action !== "approve" && action !== "reject")) {
        return reply
            .type("text/html")
            .code(400)
            .send(htmlPage("Invalid link", "This review link is invalid."));
    }

    try {
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const row = await getVerificationRequestByReviewToken(tokenHash);

        if (!row) {
            return reply
                .type("text/html")
                .code(404)
                .send(htmlPage("Link expired", "This request was already reviewed or the link is invalid."));
        }

        if (row.status !== "pending") {
            return reply
                .type("text/html")
                .code(409)
                .send(htmlPage("Already reviewed", `This request is already marked as ${row.status}.`));
        }

        if (action === "approve") {
            const result = await approveVerificationRequest(row.id, row.user_id);

            if (!result) {
                return reply
                    .type("text/html")
                    .code(409)
                    .send(htmlPage("Already reviewed", "This request could not be approved."));
            }

            return reply
                .type("text/html")
                .send(htmlPage(
                    "Approved",
                    `@${row.username} is now verified. The badge will appear next to their name.`
                ));
        }

        const result = await rejectVerificationRequest(row.id);

        if (!result) {
            return reply
                .type("text/html")
                .code(409)
                .send(htmlPage("Already reviewed", "This request could not be rejected."));
        }

        return reply
            .type("text/html")
            .send(htmlPage(
                "Rejected",
                `Verification request from @${row.username} was rejected.`
            ));
    } catch (error) {
        console.error(error);

        return reply
            .type("text/html")
            .code(500)
            .send(htmlPage("Error", "Could not process this review link."));
    }
});


const PORT = 3000;



app.listen({ port: PORT }, (error, address) => {
    if (error) {
        app.log.error(error);
        process.exit(1);
    }

    console.log(
        `VeyraWatch is running on ${address}`
    );
});