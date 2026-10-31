
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

const searchInput = document.getElementById("searchInput");

function performSearch() {
    let query = searchInput.value.trim();

    if (!query) {
        return;
    }

    // allow typing @username
    if (query.startsWith("@")) {
        query = query.slice(1).trim();
    }

    if (!query) {
        return;
    }

    window.location.href =
        `/search.html?q=${encodeURIComponent(query)}`;
}

searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        performSearch();
    }
});

const searchIcon = document.querySelector(".search-icon");

if (searchIcon) {
    searchIcon.addEventListener("click", () => {
        performSearch();
    });
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || "";
}

function avatarColor(seed) {
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

    let hash = 0;
    const text = String(seed || "");

    for (let i = 0; i < text.length; i++) {
        hash = (hash + text.charCodeAt(i) * (i + 1)) % colors.length;
    }

    return colors[hash];
}

function createUserRow(user) {
    const row = document.createElement("a");
    row.className = "channel-result";
    row.href = `/profile.html?u=${encodeURIComponent(user.username)}`;

    const avatar = document.createElement("div");
    avatar.className = "channel-result-avatar";

    const name = user.name || user.username || "?";
    const letter = name.charAt(0).toUpperCase();
    avatar.style.backgroundColor = avatarColor(user.username || name);

    if (user.avatar_url) {
        const img = document.createElement("img");
        img.src = user.avatar_url;
        img.alt = name;

        img.onerror = () => {
            avatar.innerHTML = "";
            avatar.textContent = letter;
        };

        avatar.appendChild(img);
    } else {
        avatar.textContent = letter;
    }

    const info = document.createElement("div");
    info.className = "channel-result-info";

    const title = document.createElement("div");
    title.className = "channel-result-name";
    const verified = isUserVerified(user);
    const badge = verified ? verifiedBadgeHtml() : "";
    title.innerHTML = verified
        ? `${escapeHtml(name)}${badge}`
        : escapeHtml(name);

    const username = document.createElement("div");
    username.className = "channel-result-username";
    username.innerHTML = verified
        ? `@${escapeHtml(user.username)}${badge}`
        : `@${escapeHtml(user.username)}`;

    info.appendChild(title);
    info.appendChild(username);

    row.appendChild(avatar);
    row.appendChild(info);

    return row;
}

async function loadSearchResults() {
    const query = getQueryParam("q").trim();
    const results = document.getElementById("searchResults");
    const empty = document.getElementById("searchEmpty");
    const title = document.getElementById("searchTitle");

    if (searchInput && query) {
        searchInput.value = query;
    }

    if (!query) {
        if (title) {
            title.textContent = "Search Results";
        }

        if (empty) {
            empty.textContent = "Enter a username to search";
            empty.hidden = false;
        }

        return;
    }

    if (title) {
        title.textContent = `Search Results for "${query}"`;
    }

    try {
        const response = await fetch(
            `/api/users/search?q=${encodeURIComponent(query)}`,
            { credentials: "include" }
        );

        const data = await response.json();

        if (!response.ok) {
            if (empty) {
                empty.textContent = data.error || "Search failed";
                empty.hidden = false;
            }
            return;
        }

        const users = data.users || [];

        if (!results) {
            return;
        }

        results.innerHTML = "";

        if (users.length === 0) {
            if (empty) {
                empty.textContent = "No channels found";
                empty.hidden = false;
            }
            return;
        }

        if (empty) {
            empty.hidden = true;
        }

        for (const user of users) {
            results.appendChild(createUserRow(user));
        }
    } catch (error) {
        console.error("Search failed:", error);

        if (empty) {
            empty.textContent = "Could not search users";
            empty.hidden = false;
        }
    }
}

loadSearchResults();