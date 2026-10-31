const cameraButton =
    document.getElementById("cameraButton");

const avatarInput =
    document.getElementById("avatarInput");

const avatarPanel =
    document.getElementById("avatarPanel");

const avatarPreview =
    document.getElementById("avatarPreview");

const cancelAvatarButton =
    document.getElementById("cancelAvatarButton");

const saveAvatarButton =
    document.getElementById("saveAvatarButton");

const avatarCircle =
    document.getElementById("avatarCircle");

const avatarLetter =
    document.getElementById("avatarLetter");

const saveChangesButton =
    document.getElementById("saveChangesButton");


let selectedFile = null;
let selectedImageUrl = null;
let editorImage = null;

let imageX = 0;
let imageY = 0;
let imageScale = 1;

let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startImageX = 0;
let startImageY = 0;

let croppedAvatarBlob = null;
let croppedAvatarUrl = null;


/* =========================
   LOAD CURRENT AVATAR
   ========================= */

async function loadCurrentProfile() {
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
            return;
        }

        const user = data.user;

        const name = user.name || user.username || "?";
        const firstLetter = name.charAt(0).toUpperCase();

        const nameInput = document.getElementById("editName");
        const usernameInput = document.getElementById("editUsername");
        const bioInput = document.getElementById("editBio");

        if (nameInput) {
            nameInput.value = user.name || "";
        }

        if (usernameInput) {
            usernameInput.value = user.username || "";
        }

        if (bioInput) {
            bioInput.value = user.bio || "";
        }

        if (avatarLetter) {
            avatarLetter.textContent = firstLetter;
        }

        if (user.avatar_url) {
            avatarCircle.innerHTML = "";

            const image = document.createElement("img");
            image.src = user.avatar_url;
            image.alt = "Current avatar";

            image.onerror = () => {
                avatarCircle.innerHTML = "";
                const span = document.createElement("span");
                span.id = "avatarLetter";
                span.textContent = firstLetter;
                avatarCircle.appendChild(span);
            };

            avatarCircle.appendChild(image);
        }

    } catch (error) {
        console.error("Could not load profile:", error);
    }
}


/* =========================
   OPEN FILE SELECTOR
   ========================= */

cameraButton.addEventListener(
    "click",
    () => {
        avatarInput.click();
    }
);


/* =========================
   SELECT IMAGE
   ========================= */

avatarInput.addEventListener(
    "change",
    () => {

        const file =
            avatarInput.files[0];

        if (!file) {
            return;
        }

        selectedFile =
            file;

        croppedAvatarBlob =
            null;

        if (selectedImageUrl) {
            URL.revokeObjectURL(
                selectedImageUrl
            );
        }

        selectedImageUrl =
            URL.createObjectURL(file);

        avatarPreview.innerHTML =
            "";

        editorImage =
            document.createElement("img");

        editorImage.src =
            selectedImageUrl;

        editorImage.alt =
            "Avatar preview";

        avatarPreview.appendChild(
            editorImage
        );

        editorImage.onload =
            () => {

                const previewWidth =
                    avatarPreview.clientWidth;

                const previewHeight =
                    avatarPreview.clientHeight;

                const imageWidth =
                    editorImage.naturalWidth;

                const imageHeight =
                    editorImage.naturalHeight;

                const scaleX =
                    previewWidth /
                    imageWidth;

                const scaleY =
                    previewHeight /
                    imageHeight;

                /*
                 * Cover the entire circle.
                 */

                imageScale =
                    Math.max(
                        scaleX,
                        scaleY
                    );

                imageX =
                    (
                        previewWidth -
                        imageWidth *
                        imageScale
                    ) / 2;

                imageY =
                    (
                        previewHeight -
                        imageHeight *
                        imageScale
                    ) / 2;

                updateEditorImage();

                avatarPanel.style.display =
                    "block";
            };
    }
);


/* =========================
   UPDATE EDITOR IMAGE
   ========================= */

function updateEditorImage() {

    if (!editorImage) {
        return;
    }

    editorImage.style.position =
        "absolute";

    editorImage.style.left =
        "0px";

    editorImage.style.top =
        "0px";

    editorImage.style.width =
        `${editorImage.naturalWidth}px`;

    editorImage.style.height =
        `${editorImage.naturalHeight}px`;

    editorImage.style.maxWidth =
        "none";

    editorImage.style.maxHeight =
        "none";

    editorImage.style.transformOrigin =
        "top left";

    editorImage.style.transform =
        `translate(${imageX}px, ${imageY}px) scale(${imageScale})`;

    editorImage.style.display =
        "block";

    editorImage.style.visibility =
        "visible";

    editorImage.style.opacity =
        "1";

    editorImage.style.userSelect =
        "none";

    editorImage.style.pointerEvents =
        "none";
}


/* =========================
   DRAG IMAGE
   ========================= */

avatarPreview.addEventListener(
    "mousedown",
    (event) => {

        if (!editorImage) {
            return;
        }

        dragging =
            true;

        dragStartX =
            event.clientX;

        dragStartY =
            event.clientY;

        startImageX =
            imageX;

        startImageY =
            imageY;

        avatarPreview.classList.add(
            "dragging"
        );
    }
);


window.addEventListener(
    "mousemove",
    (event) => {

        if (!dragging) {
            return;
        }

        imageX =
            startImageX +
            event.clientX -
            dragStartX;

        imageY =
            startImageY +
            event.clientY -
            dragStartY;

        updateEditorImage();
    }
);


window.addEventListener(
    "mouseup",
    () => {

        dragging =
            false;

        avatarPreview.classList.remove(
            "dragging"
        );
    }
);


/* =========================
   ZOOM
   ========================= */

avatarPreview.addEventListener(
    "wheel",
    (event) => {

        if (!editorImage) {
            return;
        }

        event.preventDefault();

        if (event.deltaY < 0) {
            imageScale *= 1.05;
        } else {
            imageScale *= 0.95;
        }

        imageScale =
            Math.max(
                0.1,
                Math.min(
                    imageScale,
                    5
                )
            );

        updateEditorImage();
    },
    {
        passive: false
    }
);


/* =========================
   CREATE 512x512 CROP
   ========================= */

function createCroppedAvatar() {

    return new Promise((resolve, reject) => {

        if (!editorImage) {
            reject(new Error("No image selected"));
            return;
        }

        const outputSize = 512;
        const canvas = document.createElement("canvas");
        canvas.width = outputSize;
        canvas.height = outputSize;

        const context = canvas.getContext("2d");

        if (!context) {
            reject(new Error("Could not create canvas"));
            return;
        }

        const imgW = editorImage.naturalWidth;
        const imgH = editorImage.naturalHeight;

        if (!imgW || !imgH) {
            reject(new Error("Image has no size"));
            return;
        }

        /*
         * Map what is visible in the 150x150 preview
         * (pan + zoom) onto a 512x512 square.
         */
        const previewSize = avatarPreview.clientWidth || 150;
        const outputScale = outputSize / previewSize;

        const drawX = imageX * outputScale;
        const drawY = imageY * outputScale;
        const drawW = imgW * imageScale * outputScale;
        const drawH = imgH * imageScale * outputScale;

        context.clearRect(0, 0, outputSize, outputSize);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(editorImage, drawX, drawY, drawW, drawH);

        canvas.toBlob((blob) => {
            if (!blob || blob.size === 0) {
                reject(new Error("Could not create avatar"));
                return;
            }

            console.log("Cropped avatar blob size:", blob.size);
            resolve(blob);
        }, "image/png");
    });
}

/* =========================
   SAVE IN EDITOR
   ========================= */

saveAvatarButton.addEventListener(
    "click",
    async () => {

        if (!editorImage) {
            alert("No image selected");
            return;
        }

        try {
            const blob = await createCroppedAvatar();

            if (!blob || blob.size === 0) {
                alert("Could not crop avatar. Try another image.");
                return;
            }

            croppedAvatarBlob = blob;

            if (croppedAvatarUrl) {
                URL.revokeObjectURL(croppedAvatarUrl);
            }

            croppedAvatarUrl = URL.createObjectURL(blob);

            avatarCircle.innerHTML = "";

            const image = document.createElement("img");
            image.src = croppedAvatarUrl;
            image.alt = "Avatar";
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "cover";
            image.style.display = "block";

            avatarCircle.appendChild(image);

            avatarPanel.style.display = "none";

            console.log("Cropped 512x512 avatar ready, size:", blob.size);

        } catch (error) {
            console.error("Failed to create cropped avatar:", error);
            alert("Could not crop avatar. Try another image.");
        }
    }
);

/* =========================
   CANCEL
   ========================= */

cancelAvatarButton.addEventListener(
    "click",
    () => {

        avatarPanel.style.display =
            "none";

        avatarInput.value =
            "";

        selectedFile =
            null;

        editorImage =
            null;

        croppedAvatarBlob =
            null;

        avatarPreview.innerHTML =
            "<span>Preview</span>";
    }
);


/* =========================
   SAVE CHANGES
   ========================= */

saveChangesButton.addEventListener(
    "click",
    async () => {
        const nameInput = document.getElementById("editName");
        const usernameInput = document.getElementById("editUsername");
        const bioInput = document.getElementById("editBio");

        const name = (nameInput?.value || "").trim();
        const username = (usernameInput?.value || "").trim();
        const bio = (bioInput?.value || "").trim();

        if (!name || !username) {
            alert("Name and username are required");
            return;
        }

        try {
            saveChangesButton.disabled = true;
            saveChangesButton.textContent = "Saving...";

            // 1) Save profile fields
            const profileResponse = await fetch("/api/profile", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, username, bio })
            });

            let profileData = null;

            try {
                profileData = await profileResponse.json();
            } catch (_) {
                profileData = null;
            }

            if (!profileResponse.ok) {
                const message =
                    (profileData && profileData.error) ||
                    ("Could not update profile (" + profileResponse.status + ")");
                alert(message);
                saveChangesButton.disabled = false;
                saveChangesButton.textContent = "Save changes";
                return;
            }

            // 2) Upload avatar if changed
            if (croppedAvatarBlob) {
                const formData = new FormData();
                formData.append("avatar", croppedAvatarBlob, "avatar.png");

                const avatarResponse = await fetch("/api/profile/avatar", {
                    method: "POST",
                    body: formData,
                    credentials: "include"
                });

                let avatarData = null;

                try {
                    avatarData = await avatarResponse.json();
                } catch (_) {
                    avatarData = null;
                }

                if (!avatarResponse.ok) {
                    const message =
                        (avatarData && avatarData.error) ||
                        ("Avatar upload failed (" + avatarResponse.status + ")");
                    alert(message);
                    saveChangesButton.disabled = false;
                    saveChangesButton.textContent = "Save changes";
                    return;
                }
            }

            window.location.href = "/profile.html";

        } catch (error) {
            console.error("Could not save profile:", error);
            alert("Could not save profile. Check console / network.");
            saveChangesButton.disabled = false;
            saveChangesButton.textContent = "Save changes";
        }
    }
);



/* =========================
   START
   ========================= */

loadCurrentProfile();