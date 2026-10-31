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

const colors = [
    "#6C5CE7",
    "#00B894",
    "#0984E3",
    "#E17055",
    "#D63031",
    "#E84393",
    "#00CEC9",
    "#FDCB6E"
];

function pickColor(seed) {
    let hash = 0;
    const text = String(seed || "");

    for (let i = 0; i < text.length; i++) {
        hash = (hash + text.charCodeAt(i) * (i + 1)) % colors.length;
    }

    return colors[hash];
}

function setLetter(container, letterId, letter, color) {
    container.innerHTML = "";
    container.style.backgroundColor = color;
    container.style.overflow = "hidden";

    const span = document.createElement("span");
    span.id = letterId;
    span.textContent = letter;
    container.appendChild(span);
}

function setAvatar(container, letterId, letter, color, url) {
    if (!url) {
        setLetter(container, letterId, letter, color);
        return;
    }

    container.innerHTML = "";
    container.style.backgroundColor = color;
    container.style.overflow = "hidden";

    const image = document.createElement("img");
    image.src = url;
    image.alt = "Profile avatar";
    image.style.display = "block";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.borderRadius = "50%";

    image.onerror = () => {
        setLetter(container, letterId, letter, color);
    };

    container.appendChild(image);
}

function formatDuration(totalSeconds) {
    const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
}

let currentProfileUsername = "";
let currentIsOwnProfile = false;

function closeAllVideoMenus() {
    document.querySelectorAll(".video-card-menu.is-open").forEach((menu) => {
        menu.classList.remove("is-open");
        const dropdown = menu.querySelector(".video-card-menu-dropdown");
        if (dropdown) {
            dropdown.hidden = true;
        }
    });
}

async function deleteVideo(videoId) {
    const confirmed = window.confirm("Delete this video?");

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
            method: "DELETE",
            credentials: "include"
        });

        let data = null;

        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (!response.ok) {
            alert((data && data.error) || "Could not delete video");
            return;
        }

        if (currentProfileUsername) {
            loadUserVideos(currentProfileUsername, currentIsOwnProfile);
        }
    } catch (error) {
        console.error("Could not delete video:", error);
        alert("Could not delete video");
    }
}

function renderVideos(videos, isOwnProfile = false) {
    const grid = document.getElementById("videosGrid");
    const empty = document.getElementById("noVideos");
    const videoCount = document.getElementById("videoCount");

    if (!grid) {
        return;
    }

    closeAllVideoMenus();
    grid.innerHTML = "";

    if (videoCount) {
        videoCount.textContent = String(videos.length);
    }

    if (!videos.length) {
        if (empty) {
            empty.hidden = false;
        }
        return;
    }

    if (empty) {
        empty.hidden = true;
    }

    for (const video of videos) {
        const card = document.createElement("a");
        card.className = "video-card";
        card.href = `/watch.html?id=${encodeURIComponent(video.id)}`;

        const thumb = document.createElement("div");
        thumb.className = "video-card-thumb";

        if (video.thumbnail_url) {
            const img = document.createElement("img");
            img.src = video.thumbnail_url;
            img.alt = video.title || "Video";
            thumb.appendChild(img);
        }

        const duration = document.createElement("span");
        duration.className = "video-card-duration";
        duration.textContent = formatDuration(video.duration_seconds);
        thumb.appendChild(duration);

        if (isOwnProfile) {
            const menu = document.createElement("div");
            menu.className = "video-card-menu";

            const menuButton = document.createElement("button");
            menuButton.type = "button";
            menuButton.className = "video-card-menu-button";
            menuButton.setAttribute("aria-label", "Video options");
            menuButton.textContent = "⋯";

            const dropdown = document.createElement("div");
            dropdown.className = "video-card-menu-dropdown";
            dropdown.hidden = true;

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "video-card-delete-button";
            deleteButton.textContent = "Delete";

            menuButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const wasOpen = menu.classList.contains("is-open");
                closeAllVideoMenus();

                if (!wasOpen) {
                    menu.classList.add("is-open");
                    dropdown.hidden = false;
                }
            });

            deleteButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                closeAllVideoMenus();
                deleteVideo(video.id);
            });

            dropdown.appendChild(deleteButton);
            menu.appendChild(menuButton);
            menu.appendChild(dropdown);
            thumb.appendChild(menu);
        }

        const title = document.createElement("div");
        title.className = "video-card-title";
        title.textContent = video.title || "Untitled";

        const views = document.createElement("div");
        views.className = "video-card-views";
        const viewCount = Number(video.views) || 0;
        views.textContent = `${viewCount} view${viewCount === 1 ? "" : "s"}`;

        card.appendChild(thumb);
        card.appendChild(title);
        card.appendChild(views);
        grid.appendChild(card);
    }
}

async function loadUserVideos(username, isOwnProfile = false) {
    currentProfileUsername = username;
    currentIsOwnProfile = isOwnProfile;

    try {
        const response = await fetch(
            `/api/users/${encodeURIComponent(username)}/videos`,
            { credentials: "include" }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(data.error || "Could not load videos");
            renderVideos([], isOwnProfile);
            return;
        }

        renderVideos(data.videos || [], isOwnProfile);
    } catch (error) {
        console.error("Could not load videos:", error);
        renderVideos([], isOwnProfile);
    }
}

function applyProfileStats(stats) {
    const videoCount = document.getElementById("videoCount");
    const likeCount = document.getElementById("likeCount");
    const subscriberCount = document.getElementById("subscriberCount");

    if (videoCount) {
        videoCount.textContent = String(stats?.videos ?? 0);
    }
    if (likeCount) {
        likeCount.textContent = String(stats?.likes ?? 0);
    }
    if (subscriberCount) {
        subscriberCount.textContent = String(stats?.subscribers ?? 0);
    }
}

function renderProfileUser(user, isOwnProfile, stats = null) {
    const name = user.name || user.username || "?";
    const username = user.username || "";
    const firstLetter = name.charAt(0).toUpperCase();
    const avatarUrl = user.avatar_url || null;
    const color = pickColor(username || name);

    const nameEl = document.getElementById("profileName");
    const usernameEl = document.getElementById("profileUsername");
    const verified = isUserVerified(user);

    if (nameEl) {
        nameEl.innerHTML = verified
            ? `${escapeHtml(name)}${verifiedBadgeHtml()}`
            : escapeHtml(name);
    }

    if (usernameEl) {
        usernameEl.innerHTML = verified
            ? `@${escapeHtml(username)}${verifiedBadgeHtml()}`
            : `@${escapeHtml(username)}`;
    }

    const profileTopName = document.getElementById("profileTopName");
    // topbar name stays the logged-in user; only set if own profile page without ?u=
    if (profileTopName && isOwnProfile && !getQueryParam("u")) {
        profileTopName.textContent = name;
    }

    const profileBio = document.getElementById("profileBio");
    if (profileBio) {
        profileBio.textContent = user.bio && user.bio.trim()
            ? user.bio
            : "Not bio yet";
    }

    const profileIcon = document.getElementById("profileIcon");
    const largeProfileIcon = document.getElementById("largeProfileIcon");

    // large avatar always for viewed profile
    setAvatar(largeProfileIcon, "largeProfileLetter", firstLetter, color, avatarUrl);

    // small topbar avatar only update when viewing own profile without ?u
    if (isOwnProfile && !getQueryParam("u") && profileIcon) {
        setAvatar(profileIcon, "profileLetter", firstLetter, color, avatarUrl);
        if (profileTopName) {
            profileTopName.textContent = name;
        }
    }

    const editProfileButton = document.getElementById("editProfileButton");
    if (editProfileButton) {
        editProfileButton.style.display = isOwnProfile ? "" : "none";
    }

    const verifyAccountButton = document.getElementById("verifyAccountButton");
    if (verifyAccountButton) {
        // only own profile and not already verified
        verifyAccountButton.hidden = !(isOwnProfile && !isUserVerified(user));
    }

    const uploadVideoButton = document.getElementById("uploadVideoButton");
    if (uploadVideoButton) {
        uploadVideoButton.hidden = !isOwnProfile;
    }

    if (stats) {
        applyProfileStats(stats);
    }

    if (username) {
        loadUserVideos(username, isOwnProfile);
    }
}

document.addEventListener("click", () => {
    closeAllVideoMenus();
});

async function loadOwnSessionUser() {
    const response = await fetch("/api/auth/me", {
        credentials: "include"
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    return data.user || null;
}

async function loadProfile() {
    try {
        const requestedUsername = getQueryParam("u").trim();
        const me = await loadOwnSessionUser();

        if (!me) {
            window.location.href = "/";
            return;
        }

        // Fill topbar with current logged-in user always
        const myName = me.name || me.username || "?";
        const myLetter = myName.charAt(0).toUpperCase();
        const myColor = pickColor(me.username || myName);
        const profileIcon = document.getElementById("profileIcon");
        const profileTopName = document.getElementById("profileTopName");

        if (profileTopName) {
            profileTopName.textContent = myName;
        }

        if (profileIcon) {
            setAvatar(
                profileIcon,
                "profileLetter",
                myLetter,
                myColor,
                me.avatar_url || null
            );
        }

        const profileUsername =
            !requestedUsername || requestedUsername === me.username
                ? me.username
                : requestedUsername;

        const isOwn =
            !requestedUsername || requestedUsername === me.username;

        const response = await fetch(
            `/api/users/${encodeURIComponent(profileUsername)}`,
            { credentials: "include" }
        );

        const data = await response.json();

        if (!response.ok || !data.user) {
            alert(data.error || "User not found");
            window.location.href = "/home.html";
            return;
        }

        renderProfileUser(data.user, isOwn, data.stats || null);

    } catch (error) {
        console.error("Could not load profile:", error);
        window.location.href = "/";
    }
}

loadProfile();

const editProfileButton = document.getElementById("editProfileButton");

if (editProfileButton) {
    editProfileButton.addEventListener("click", () => {
        window.location.href = "/edit-profile.html";
    });
}

const verifyAccountButton = document.getElementById("verifyAccountButton");

if (verifyAccountButton) {
    verifyAccountButton.addEventListener("click", () => {
        window.location.href = "/verify.html";
    });
}

const uploadVideoButton = document.getElementById("uploadVideoButton");

if (uploadVideoButton) {
    uploadVideoButton.addEventListener("click", () => {
        window.location.href = "/upload-video.html";
    });
}

const backHomeButton = document.getElementById("backHomeButton");

if (backHomeButton) {
    backHomeButton.addEventListener("click", () => {
        window.location.href = "/home.html";
    });
}