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

async function checkSession() {
    try {
        const response = await fetch("/api/auth/me", {
            credentials: "include"
        });

        if (!response.ok) {
            window.location.href = "/";
            return;
        }

        const data = await response.json();

        if (!data.user) {
            window.location.href = "/";
        }
    } catch (error) {
        console.error("Could not check session:", error);
        window.location.href = "/";
    }
}

async function logout() {
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });

        if (!response.ok) {
            alert("Could not logout");
            return;
        }

        window.location.href = "/";
    } catch (error) {
        console.error("Could not logout:", error);
        alert("Could not connect to Veyra Watch");
    }
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}

checkSession();

async function setupProfileIcon() {
    // On profile page profile.js owns both icons — avoid race
    if (document.getElementById("largeProfileIcon")) {
        return;
    }

    try {
        const response = await fetch("/api/auth/me", {
            credentials: "include"
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (!data.user) {
            return;
        }

        const profileIcon = document.getElementById("profileIcon");

        if (!profileIcon) {
            return;
        }

        const name = data.user.name || data.user.username || "?";
        const firstLetter = name.charAt(0).toUpperCase();
        const avatarUrl = data.user.avatar_url || null;

        const profileTopName = document.getElementById("profileTopName");
        if (profileTopName) {
            profileTopName.textContent = name;
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

        const randomColor =
            colors[Math.floor(Math.random() * colors.length)];

        profileIcon.style.backgroundColor = randomColor;
        profileIcon.style.overflow = "hidden";

        function setLetter(container, letter) {
            container.innerHTML = "";
            const span = document.createElement("span");
            span.id = "profileLetter";
            span.textContent = letter;
            container.appendChild(span);
        }

        if (avatarUrl) {
            profileIcon.innerHTML = "";

            const image = document.createElement("img");
            image.src = avatarUrl;
            image.alt = "Profile avatar";
            image.style.display = "block";
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "cover";
            image.style.borderRadius = "50%";

            image.onerror = () => {
                setLetter(profileIcon, firstLetter);
            };

            profileIcon.appendChild(image);
        } else {
            setLetter(profileIcon, firstLetter);
        }
    } catch (error) {
        console.error("Could not load profile icon:", error);
    }
}

setupProfileIcon();

const profileArea = document.getElementById("profileArea") || document.getElementById("profileIcon");

if (profileArea) {
    profileArea.addEventListener("click", () => {
        window.location.href = "/profile.html";
    });
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

function renderHomeVideos(videos) {
    const grid = document.getElementById("homeVideosGrid");
    const empty = document.getElementById("homeVideosEmpty");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    if (!videos || videos.length === 0) {
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
        card.className = "home-video-card";
        card.href = `/watch.html?id=${encodeURIComponent(video.id)}`;

        const thumb = document.createElement("div");
        thumb.className = "home-video-thumb";

        if (video.thumbnail_url) {
            const img = document.createElement("img");
            img.src = video.thumbnail_url;
            img.alt = video.title || "Video";
            thumb.appendChild(img);
        }

        const duration = document.createElement("span");
        duration.className = "home-video-duration";
        duration.textContent = formatDuration(video.duration_seconds);
        thumb.appendChild(duration);

        const title = document.createElement("div");
        title.className = "home-video-title";
        title.textContent = video.title || "Untitled";

        const meta = document.createElement("div");
        meta.className = "home-video-meta";
        const author = video.user_name || video.username || "Unknown";
        const views = Number(video.views) || 0;
        const badge = isUserVerified(video) ? verifiedBadgeHtml() : "";
        meta.innerHTML = `${escapeHtml(author)}${badge} · ${views} view${views === 1 ? "" : "s"}`;

        card.appendChild(thumb);
        card.appendChild(title);
        card.appendChild(meta);
        grid.appendChild(card);
    }
}

async function loadHomeVideos(sort = "recommended") {
    try {
        const response = await fetch(
            `/api/videos?sort=${encodeURIComponent(sort)}&limit=24`,
            { credentials: "include" }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(data.error || "Could not load videos");
            renderHomeVideos([]);
            return;
        }

        renderHomeVideos(data.videos || []);
    } catch (error) {
        console.error("Could not load home videos:", error);
        renderHomeVideos([]);
    }
}

const feedTabs = document.querySelectorAll(".feed-tab");

feedTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        feedTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        loadHomeVideos(tab.dataset.sort || "recommended");
    });
});

loadHomeVideos("recommended");