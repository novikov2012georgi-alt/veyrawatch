function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function isUserVerified(userOrFlag) {
    if (userOrFlag == null) return false;
    if (typeof userOrFlag === "boolean") return userOrFlag;
    return Boolean(
        userOrFlag.is_verified ||
        userOrFlag.user_is_verified
    );
}

function verifiedBadgeHtml() {
    return `<span class="verified-badge" title="Verified" aria-label="Verified"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M10.1 2.6 4.5 8.7 1.9 6.1 1 7l3.5 3.5 6.5-7.1z"/></svg></span>`;
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || "";
}

function formatTime(totalSeconds) {
    const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
}

const watchVideo = document.getElementById("watchVideo");
const playPauseButton = document.getElementById("playPauseButton");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const restartButton = document.getElementById("restartButton");
const progressTrack = document.getElementById("progressTrack");
const progressFill = document.getElementById("progressFill");
const playerTime = document.getElementById("playerTime");
const watchTitle = document.getElementById("watchTitle");
const watchMeta = document.getElementById("watchMeta");
const watchDescription = document.getElementById("watchDescription");
const watchViews = document.getElementById("watchViews");
const backHomeButton = document.getElementById("backHomeButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const enterFullscreenIcon = document.getElementById("enterFullscreenIcon");
const exitFullscreenIcon = document.getElementById("exitFullscreenIcon");
const playerShell = document.querySelector(".player-shell");

let isEnded = false;
let viewCounted = false;
let controlsHideTimer = null;
const CONTROLS_HIDE_DELAY_MS = 2000;

function showPlayerChrome() {
    if (!playerShell) {
        return;
    }

    playerShell.classList.remove("controls-hidden");

    if (controlsHideTimer) {
        clearTimeout(controlsHideTimer);
        controlsHideTimer = null;
    }

    // auto-hide only while video is playing and not ended
    if (watchVideo && !watchVideo.paused && !isEnded) {
        controlsHideTimer = setTimeout(() => {
            if (watchVideo && !watchVideo.paused && !isEnded) {
                playerShell.classList.add("controls-hidden");
            }
        }, CONTROLS_HIDE_DELAY_MS);
    }
}

function hidePlayerChromeNow() {
    if (!playerShell) {
        return;
    }

    if (controlsHideTimer) {
        clearTimeout(controlsHideTimer);
        controlsHideTimer = null;
    }

    if (watchVideo && !watchVideo.paused && !isEnded) {
        playerShell.classList.add("controls-hidden");
    }
}

function updateTimeUI() {
    if (!watchVideo || !progressFill || !playerTime) {
        return;
    }

    const current = watchVideo.currentTime || 0;
    const duration = Number.isFinite(watchVideo.duration) ? watchVideo.duration : 0;
    const percent = duration > 0 ? (current / duration) * 100 : 0;

    progressFill.style.width = `${percent}%`;
    playerTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

function hideCenterButtons() {
    if (playPauseButton) {
        playPauseButton.hidden = true;
    }
    if (restartButton) {
        restartButton.hidden = true;
    }
}

function showPlayButton() {
    if (playIcon) {
        playIcon.hidden = false;
    }
    if (pauseIcon) {
        pauseIcon.hidden = true;
    }
    if (playPauseButton) {
        playPauseButton.hidden = false;
        playPauseButton.setAttribute("aria-label", "Play");
    }
    if (restartButton) {
        restartButton.hidden = true;
    }
}

function showEndedState() {
    isEnded = true;
    if (playPauseButton) {
        playPauseButton.hidden = true;
    }
    if (restartButton) {
        restartButton.hidden = false;
    }
}

function isFullscreenActive() {
    return Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement
    );
}

function updateFullscreenButton() {
    const active = isFullscreenActive();

    if (enterFullscreenIcon) {
        enterFullscreenIcon.hidden = active;
    }
    if (exitFullscreenIcon) {
        exitFullscreenIcon.hidden = !active;
    }
    if (fullscreenButton) {
        fullscreenButton.setAttribute(
            "aria-label",
            active ? "Exit fullscreen" : "Fullscreen"
        );
    }
}

async function toggleFullscreen() {
    const target = playerShell || watchVideo;

    if (!target) {
        return;
    }

    try {
        if (isFullscreenActive()) {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        } else if (target.requestFullscreen) {
            await target.requestFullscreen();
        } else if (target.webkitRequestFullscreen) {
            target.webkitRequestFullscreen();
        } else if (watchVideo && watchVideo.webkitEnterFullscreen) {
            // iOS Safari
            watchVideo.webkitEnterFullscreen();
        }
    } catch (error) {
        console.error("Fullscreen error:", error);
    }

    updateFullscreenButton();
}

if (backHomeButton) {
    backHomeButton.addEventListener("click", () => {
        window.location.href = "/home.html";
    });
}

if (playPauseButton && watchVideo) {
    playPauseButton.addEventListener("click", (event) => {
        event.stopPropagation();

        if (watchVideo.paused) {
            watchVideo.play().catch(() => {});
        } else {
            watchVideo.pause();
        }
    });
}

if (restartButton && watchVideo) {
    restartButton.addEventListener("click", (event) => {
        event.stopPropagation();
        isEnded = false;
        watchVideo.currentTime = 0;
        watchVideo.play().catch(() => {});
    });
}

if (watchVideo) {
    watchVideo.addEventListener("play", () => {
        isEnded = false;
        hideCenterButtons();
        showPlayerChrome();
    });

    watchVideo.addEventListener("pause", () => {
        if (!isEnded) {
            showPlayButton();
        }
        showPlayerChrome();
    });

    watchVideo.addEventListener("ended", () => {
        showEndedState();
        updateTimeUI();
        showPlayerChrome();
    });

    watchVideo.addEventListener("timeupdate", () => {
        updateTimeUI();

        if (!viewCounted && (watchVideo.currentTime || 0) >= 2) {
            maybeCountView();
        }
    });
    watchVideo.addEventListener("loadedmetadata", updateTimeUI);

    watchVideo.addEventListener("click", () => {
        if (isEnded) {
            return;
        }

        if (watchVideo.paused) {
            watchVideo.play().catch(() => {});
        } else {
            watchVideo.pause();
        }
    });
}

if (playerShell) {
    playerShell.addEventListener("mousemove", () => {
        showPlayerChrome();
    });

    playerShell.addEventListener("mouseleave", () => {
        if (watchVideo && !watchVideo.paused && !isEnded) {
            hidePlayerChromeNow();
        }
    });

    playerShell.addEventListener("touchstart", () => {
        showPlayerChrome();
    }, { passive: true });
}

if (progressTrack && watchVideo) {
    progressTrack.addEventListener("click", (event) => {
        if (!watchVideo.duration || !Number.isFinite(watchVideo.duration)) {
            return;
        }

        const rect = progressTrack.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        watchVideo.currentTime = ratio * watchVideo.duration;
        isEnded = false;
        updateTimeUI();
    });
}

if (fullscreenButton) {
    fullscreenButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFullscreen();
    });
}

document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

function maybeCountView() {
    if (viewCounted || !currentVideoId) {
        return;
    }

    if ((watchVideo?.currentTime || 0) < 2) {
        return;
    }

    viewCounted = true;

    fetch(`/api/videos/${encodeURIComponent(currentVideoId)}/view`, {
        method: "POST",
        credentials: "include"
    })
        .then((response) => response.json())
        .then((data) => {
            if (data && typeof data.views === "number" && watchViews) {
                watchViews.textContent =
                    `${data.views} view${data.views === 1 ? "" : "s"}`;
            }
        })
        .catch((error) => {
            console.error("Could not count view:", error);
            viewCounted = false;
        });
}

updateFullscreenButton();

const subscribeButton = document.getElementById("subscribeButton");
const likeButton = document.getElementById("likeButton");
const dislikeButton = document.getElementById("dislikeButton");
const likeCount = document.getElementById("likeCount");
const dislikeCount = document.getElementById("dislikeCount");
const commentCount = document.getElementById("commentCount");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentsList = document.getElementById("commentsList");

let currentVideoId = null;
let currentVideoOwnerId = null;
let currentViewerId = null;

function updateEngagementUI(engagement) {
    if (!engagement) {
        return;
    }

    if (likeCount) {
        likeCount.textContent = String(engagement.likes ?? 0);
    }
    if (dislikeCount) {
        dislikeCount.textContent = String(engagement.dislikes ?? 0);
    }
    if (commentCount) {
        commentCount.textContent = String(engagement.comments ?? 0);
    }

    if (likeButton) {
        likeButton.classList.toggle("active", engagement.myReaction === 1);
    }
    if (dislikeButton) {
        dislikeButton.classList.toggle("active", engagement.myReaction === -1);
    }

    if (subscribeButton) {
        const isOwner =
            currentViewerId != null &&
            currentVideoOwnerId != null &&
            Number(currentViewerId) === Number(currentVideoOwnerId);

        if (isOwner) {
            subscribeButton.hidden = true;
        } else {
            subscribeButton.hidden = false;
            subscribeButton.textContent = engagement.subscribed
                ? "Subscribed"
                : "Subscribe";
            subscribeButton.classList.toggle("active", Boolean(engagement.subscribed));
        }
    }
}

function renderComments(comments) {
    if (!commentsList) {
        return;
    }

    commentsList.innerHTML = "";

    if (!comments || comments.length === 0) {
        const empty = document.createElement("p");
        empty.className = "comments-empty";
        empty.textContent = "No comments yet";
        commentsList.appendChild(empty);
        return;
    }

    for (const comment of comments) {
        const item = document.createElement("div");
        item.className = "comment-item";

        const header = document.createElement("div");
        header.className = "comment-header";

        const author = document.createElement("div");
        author.className = "comment-author";
        const name = comment.user_name || comment.username || "User";
        const username = comment.username ? ` @${comment.username}` : "";
        const badge = isUserVerified(comment) ? verifiedBadgeHtml() : "";
        author.innerHTML = `${escapeHtml(name)}${badge}<span class="comment-username">${escapeHtml(username)}</span>${username && isUserVerified(comment) ? badge : ""}`;

        header.appendChild(author);

        const isOwn =
            currentViewerId != null &&
            comment.user_id != null &&
            Number(currentViewerId) === Number(comment.user_id);

        if (isOwn) {
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "comment-delete-button";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => {
                deleteComment(comment.id);
            });
            header.appendChild(deleteBtn);
        }

        const body = document.createElement("div");
        body.className = "comment-body";
        body.textContent = comment.body || "";

        const date = document.createElement("div");
        date.className = "comment-date";
        try {
            date.textContent = new Date(comment.created_at).toLocaleString();
        } catch (_) {
            date.textContent = "";
        }

        item.appendChild(header);
        item.appendChild(body);
        item.appendChild(date);
        commentsList.appendChild(item);
    }
}

async function deleteComment(commentId) {
    if (!currentVideoId) {
        return;
    }

    const confirmed = window.confirm("Delete this comment?");
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `/api/videos/${encodeURIComponent(currentVideoId)}/comments/${encodeURIComponent(commentId)}/delete`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Could not delete comment");
            return;
        }

        if (data.engagement) {
            updateEngagementUI(data.engagement);
        }

        await loadComments(currentVideoId);
    } catch (error) {
        console.error(error);
        alert("Could not delete comment");
    }
}

async function loadComments(videoId) {
    try {
        const response = await fetch(
            `/api/videos/${encodeURIComponent(videoId)}/comments`,
            { credentials: "include" }
        );
        const data = await response.json();

        if (!response.ok) {
            renderComments([]);
            return;
        }

        renderComments(data.comments || []);
    } catch (error) {
        console.error("Could not load comments:", error);
        renderComments([]);
    }
}

async function loadViewerId() {
    try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return data.user ? data.user.id : null;
    } catch (_) {
        return null;
    }
}

async function loadVideo() {
    const id = getQueryParam("id");

    if (!id) {
        if (watchTitle) {
            watchTitle.textContent = "Video not found";
        }
        return;
    }

    currentVideoId = id;
    currentViewerId = await loadViewerId();

    try {
        const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
            credentials: "include"
        });

        let data = null;

        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (!response.ok || !data || !data.video) {
            if (watchTitle) {
                watchTitle.textContent = (data && data.error) || "Video not found";
            }
            if (watchMeta) {
                watchMeta.textContent = "";
            }
            if (watchDescription) {
                watchDescription.textContent = "";
            }
            console.error("Video load failed:", response.status, data);
            return;
        }

        const video = data.video;
        currentVideoOwnerId = video.user_id;

        if (watchTitle) {
            watchTitle.textContent = video.title || "Untitled";
        }

        if (watchMeta) {
            const name = video.user_name || video.username || "Unknown";
            const username = video.username ? `@${video.username}` : "";
            const verified = isUserVerified(video);
            const badge = verified ? verifiedBadgeHtml() : "";
            if (username) {
                watchMeta.innerHTML = `${escapeHtml(name)}${badge} · ${escapeHtml(username)}${badge}`;
            } else {
                watchMeta.innerHTML = `${escapeHtml(name)}${badge}`;
            }
        }

        if (watchDescription) {
            watchDescription.textContent = video.description || "";
        }

        if (watchViews) {
            const viewCount = Number(video.views) || 0;
            watchViews.textContent = `${viewCount} view${viewCount === 1 ? "" : "s"}`;
        }

        updateEngagementUI({
            likes: video.likes ?? 0,
            dislikes: video.dislikes ?? 0,
            comments: video.comments ?? 0,
            myReaction: video.myReaction ?? null,
            subscribed: Boolean(video.subscribed)
        });

        if (watchVideo) {
            watchVideo.src = video.video_url;
            watchVideo.load();
            showPlayButton();
            updateTimeUI();
        }

        await loadComments(id);
    } catch (error) {
        console.error("Could not load video:", error);
        if (watchTitle) {
            watchTitle.textContent = "Could not load video";
        }
    }
}

async function postReaction(kind) {
    if (!currentVideoId) {
        return;
    }

    try {
        const response = await fetch(
            `/api/videos/${encodeURIComponent(currentVideoId)}/${kind}`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || `Could not ${kind} video`);
            return;
        }

        updateEngagementUI(data.engagement);
    } catch (error) {
        console.error(error);
        alert(`Could not ${kind} video`);
    }
}

if (likeButton) {
    likeButton.addEventListener("click", () => postReaction("like"));
}

if (dislikeButton) {
    dislikeButton.addEventListener("click", () => postReaction("dislike"));
}

if (subscribeButton) {
    subscribeButton.addEventListener("click", async () => {
        if (!currentVideoId) {
            return;
        }

        try {
            const response = await fetch(
                `/api/videos/${encodeURIComponent(currentVideoId)}/subscribe`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Could not update subscription");
                return;
            }

            subscribeButton.textContent = data.subscribed
                ? "Subscribed"
                : "Subscribe";
            subscribeButton.classList.toggle("active", Boolean(data.subscribed));
        } catch (error) {
            console.error(error);
            alert("Could not update subscription");
        }
    });
}

if (commentForm) {
    commentForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!currentVideoId || !commentInput) {
            return;
        }

        const text = commentInput.value.trim();

        if (!text) {
            alert("Write a comment first");
            return;
        }

        try {
            const response = await fetch(
                `/api/videos/${encodeURIComponent(currentVideoId)}/comments`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ text })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Could not add comment");
                return;
            }

            commentInput.value = "";

            if (data.engagement) {
                updateEngagementUI(data.engagement);
            }

            await loadComments(currentVideoId);
        } catch (error) {
            console.error(error);
            alert("Could not add comment");
        }
    });
}

loadVideo();