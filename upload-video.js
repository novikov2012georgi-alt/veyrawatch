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

checkSession();

const backToProfileButton = document.getElementById("backToProfileButton");
const openUploadButton = document.getElementById("openUploadButton");
const uploadPanel = document.getElementById("uploadPanel");
const uploadPanelTitle = document.getElementById("uploadPanelTitle");

const cancelUploadButton = document.getElementById("cancelUploadButton");
const nextUploadButton = document.getElementById("nextUploadButton");
const prevUploadButton = document.getElementById("prevUploadButton");

const stepVideo = document.getElementById("stepVideo");
const stepIcon = document.getElementById("stepIcon");
const stepDetails = document.getElementById("stepDetails");

const pickVideoButton = document.getElementById("pickVideoButton");
const videoFileInput = document.getElementById("videoFileInput");
const videoPreview = document.getElementById("videoPreview");
const previewVideo = document.getElementById("previewVideo");
const playVideoButton = document.getElementById("playVideoButton");

const pickIconButton = document.getElementById("pickIconButton");
const iconFileInput = document.getElementById("iconFileInput");
const iconPreview = document.getElementById("iconPreview");
const previewIcon = document.getElementById("previewIcon");

const videoTitleInput = document.getElementById("videoTitleInput");
const videoDescriptionInput = document.getElementById("videoDescriptionInput");

let currentStep = 1;

let selectedVideoFile = null;
let selectedVideoUrl = null;

let selectedIconFile = null;
let selectedIconUrl = null;

if (backToProfileButton) {
    backToProfileButton.addEventListener("click", () => {
        window.location.href = "/profile.html";
    });
}

function showVideoPreviewState() {
    if (!selectedVideoFile || !selectedVideoUrl) {
        if (pickVideoButton) {
            pickVideoButton.hidden = false;
        }
        if (videoPreview) {
            videoPreview.hidden = true;
        }
        if (previewVideo) {
            previewVideo.pause();
            previewVideo.removeAttribute("src");
            previewVideo.load();
        }
        if (playVideoButton) {
            playVideoButton.hidden = false;
        }
        return;
    }

    if (previewVideo) {
        if (previewVideo.src !== selectedVideoUrl) {
            previewVideo.src = selectedVideoUrl;
        }
        previewVideo.pause();
        try {
            previewVideo.currentTime = 0;
        } catch (_) {}
    }

    if (pickVideoButton) {
        pickVideoButton.hidden = true;
    }
    if (videoPreview) {
        videoPreview.hidden = false;
    }
    if (playVideoButton) {
        playVideoButton.hidden = false;
    }
}

function showIconPreviewState() {
    if (!selectedIconFile || !selectedIconUrl) {
        if (pickIconButton) {
            pickIconButton.hidden = false;
        }
        if (iconPreview) {
            iconPreview.hidden = true;
        }
        if (previewIcon) {
            previewIcon.removeAttribute("src");
        }
        return;
    }

    if (previewIcon) {
        previewIcon.src = selectedIconUrl;
    }

    if (pickIconButton) {
        pickIconButton.hidden = true;
    }
    if (iconPreview) {
        iconPreview.hidden = false;
    }
}

function setStep(step) {
    currentStep = step;

    if (stepVideo) {
        stepVideo.hidden = step !== 1;
    }
    if (stepIcon) {
        stepIcon.hidden = step !== 2;
    }
    if (stepDetails) {
        stepDetails.hidden = step !== 3;
    }

    if (prevUploadButton) {
        prevUploadButton.hidden = step === 1;
    }

    if (nextUploadButton) {
        nextUploadButton.hidden = false;
        nextUploadButton.textContent = "Next";
    }

    if (previewVideo) {
        previewVideo.pause();
    }

    if (step === 1) {
        if (uploadPanelTitle) {
            uploadPanelTitle.textContent = "Upload Video";
        }
        if (nextUploadButton) {
            nextUploadButton.textContent = "Next";
        }
        showVideoPreviewState();
    } else if (step === 2) {
        if (uploadPanelTitle) {
            uploadPanelTitle.textContent = "Upload Icon";
        }
        if (nextUploadButton) {
            nextUploadButton.textContent = "Next";
        }
        showIconPreviewState();
    } else if (step === 3) {
        if (uploadPanelTitle) {
            uploadPanelTitle.textContent = "Video Details";
        }
        if (nextUploadButton) {
            nextUploadButton.textContent = "Publish";
        }
    }
}

function resetAll() {
    currentStep = 1;

    selectedVideoFile = null;
    if (selectedVideoUrl) {
        URL.revokeObjectURL(selectedVideoUrl);
        selectedVideoUrl = null;
    }

    selectedIconFile = null;
    if (selectedIconUrl) {
        URL.revokeObjectURL(selectedIconUrl);
        selectedIconUrl = null;
    }

    if (videoFileInput) {
        videoFileInput.value = "";
    }
    if (iconFileInput) {
        iconFileInput.value = "";
    }
    if (videoTitleInput) {
        videoTitleInput.value = "";
    }
    if (videoDescriptionInput) {
        videoDescriptionInput.value = "";
    }

    showVideoPreviewState();
    showIconPreviewState();
    setStep(1);
}

function openPanel() {
    resetAll();
    if (uploadPanel) {
        uploadPanel.hidden = false;
    }
}

function closePanel() {
    resetAll();
    if (uploadPanel) {
        uploadPanel.hidden = true;
    }
}

if (openUploadButton) {
    openUploadButton.addEventListener("click", openPanel);
}

if (cancelUploadButton) {
    cancelUploadButton.addEventListener("click", closePanel);
}

if (prevUploadButton) {
    prevUploadButton.addEventListener("click", () => {
        // keep all current data, just go back one step
        if (currentStep === 3) {
            setStep(2);
            return;
        }
        if (currentStep === 2) {
            setStep(1);
        }
    });
}

if (nextUploadButton) {
    nextUploadButton.addEventListener("click", () => {
        if (currentStep === 1) {
            if (!selectedVideoFile) {
                alert("Please select a video first");
                return;
            }
            setStep(2);
            return;
        }

        if (currentStep === 2) {
            setStep(3);
            return;
        }

        if (currentStep === 3) {
            publishVideo();
        }
    });
}

async function getVideoDuration(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";

        video.onloadedmetadata = () => {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            URL.revokeObjectURL(url);
            resolve(duration);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(0);
        };

        video.src = url;
    });
}

async function publishVideo() {
    const title = (videoTitleInput?.value || "").trim();
    const description = (videoDescriptionInput?.value || "").trim();

    if (!title) {
        alert("Please enter a video title");
        return;
    }

    if (!selectedVideoFile) {
        alert("Please select a video first");
        setStep(1);
        return;
    }

    try {
        if (nextUploadButton) {
            nextUploadButton.disabled = true;
            nextUploadButton.textContent = "Publishing...";
        }

        const duration = await getVideoDuration(selectedVideoFile);

        const formData = new FormData();
        formData.append("video", selectedVideoFile, selectedVideoFile.name || "video.mp4");
        formData.append("title", title);
        formData.append("description", description);
        formData.append("duration", String(Math.round(duration)));

        if (selectedIconFile) {
            formData.append(
                "thumbnail",
                selectedIconFile,
                selectedIconFile.name || "thumbnail.png"
            );
        }

        const response = await fetch("/api/videos", {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        let data = null;

        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (!response.ok) {
            alert((data && data.error) || "Could not publish video");
            if (nextUploadButton) {
                nextUploadButton.disabled = false;
                nextUploadButton.textContent = "Publish";
            }
            return;
        }

        window.location.href = "/profile.html";
    } catch (error) {
        console.error("Could not publish video:", error);
        alert("Could not publish video");
        if (nextUploadButton) {
            nextUploadButton.disabled = false;
            nextUploadButton.textContent = "Publish";
        }
    }
}

/* ===== Video file ===== */

if (pickVideoButton && videoFileInput) {
    pickVideoButton.addEventListener("click", () => {
        videoFileInput.click();
    });
}

if (videoFileInput) {
    videoFileInput.addEventListener("change", () => {
        const file = videoFileInput.files && videoFileInput.files[0];

        if (!file) {
            return;
        }

        const name = (file.name || "").toLowerCase();
        const isMp4 =
            file.type === "video/mp4" ||
            name.endsWith(".mp4");

        if (!isMp4) {
            alert("Only .mp4 videos are supported");
            videoFileInput.value = "";
            return;
        }

        if (selectedVideoUrl) {
            URL.revokeObjectURL(selectedVideoUrl);
        }

        selectedVideoFile = file;
        selectedVideoUrl = URL.createObjectURL(file);

        showVideoPreviewState();
    });
}

if (playVideoButton && previewVideo) {
    playVideoButton.addEventListener("click", () => {
        previewVideo.play();
        playVideoButton.hidden = true;
    });

    previewVideo.addEventListener("click", () => {
        if (previewVideo.paused) {
            previewVideo.play();
            playVideoButton.hidden = true;
        } else {
            previewVideo.pause();
            playVideoButton.hidden = false;
        }
    });

    previewVideo.addEventListener("ended", () => {
        playVideoButton.hidden = false;
    });

    previewVideo.addEventListener("pause", () => {
        if (!previewVideo.ended) {
            playVideoButton.hidden = false;
        }
    });
}

/* ===== Icon file ===== */

if (pickIconButton && iconFileInput) {
    pickIconButton.addEventListener("click", () => {
        iconFileInput.click();
    });
}

if (iconFileInput) {
    iconFileInput.addEventListener("change", () => {
        const file = iconFileInput.files && iconFileInput.files[0];

        if (!file) {
            return;
        }

        const name = (file.name || "").toLowerCase();
        const allowed =
            name.endsWith(".png") ||
            name.endsWith(".jpg") ||
            name.endsWith(".jpeg") ||
            name.endsWith(".ico") ||
            file.type === "image/png" ||
            file.type === "image/jpeg" ||
            file.type === "image/x-icon" ||
            file.type === "image/vnd.microsoft.icon";

        if (!allowed) {
            alert("Only .png, .jpg and .ico icons are supported");
            iconFileInput.value = "";
            return;
        }

        if (selectedIconUrl) {
            URL.revokeObjectURL(selectedIconUrl);
        }

        selectedIconFile = file;
        selectedIconUrl = URL.createObjectURL(file);

        showIconPreviewState();
    });
}