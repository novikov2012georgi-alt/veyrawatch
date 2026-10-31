function setupSelect(btnId, labelId, dropdownId, inputId, onChange) {
    const btn = document.getElementById(btnId);
    const label = document.getElementById(labelId);
    const dropdown = document.getElementById(dropdownId);
    const input = document.getElementById(inputId);

    btn.addEventListener("click", (event) => {
        event.stopPropagation();

        document.querySelectorAll(".role-select-btn[aria-expanded='true']").forEach((other) => {
            if (other !== btn) {
                other.setAttribute("aria-expanded", "false");
                const otherDropdown = other.parentElement.querySelector(".role-dropdown");
                if (otherDropdown) otherDropdown.hidden = true;
            }
        });

        const isOpen = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!isOpen));
        dropdown.hidden = isOpen;
    });

    dropdown.querySelectorAll("li").forEach((item) => {
        item.addEventListener("click", (event) => {
            event.stopPropagation();

            const value = item.getAttribute("data-value") || "";
            const text = item.textContent || "";

            input.value = value;
            label.textContent = text;

            dropdown.querySelectorAll("li").forEach((li) => {
                li.removeAttribute("aria-selected");
            });
            item.setAttribute("aria-selected", "true");

            btn.setAttribute("aria-expanded", "false");
            dropdown.hidden = true;

            if (typeof onChange === "function") {
                onChange(value);
            }
        });
    });
}

setupSelect("roleSelectBtn", "roleSelectLabel", "roleDropdown", "roleSelect");

setupSelect(
    "productSelectBtn",
    "productSelectLabel",
    "productDropdown",
    "productSelect",
    (value) => {
        const videoField = document.getElementById("productVideoField");
        const linkField = document.getElementById("productLinkField");
        const videoInput = document.getElementById("productVideo");
        const linkInput = document.getElementById("productLink");
        const videoName = document.getElementById("productVideoName");

        if (value === "video") {
            videoField.hidden = false;
            linkField.hidden = true;
            linkInput.value = "";
        } else if (value === "link") {
            videoField.hidden = true;
            linkField.hidden = false;
            videoInput.value = "";
            videoName.textContent = "No file chosen";
        } else {
            videoField.hidden = true;
            linkField.hidden = true;
            videoInput.value = "";
            linkInput.value = "";
            videoName.textContent = "No file chosen";
        }
    }
);

const productVideo = document.getElementById("productVideo");
const productVideoBtn = document.getElementById("productVideoBtn");
const productVideoName = document.getElementById("productVideoName");

productVideoBtn.addEventListener("click", () => {
    productVideo.click();
});

productVideo.addEventListener("change", () => {
    if (productVideo.files && productVideo.files[0]) {
        productVideoName.textContent = productVideo.files[0].name;
    } else {
        productVideoName.textContent = "No file chosen";
    }
});

document.addEventListener("click", () => {
    document.querySelectorAll(".role-select-btn").forEach((btn) => {
        btn.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".role-dropdown").forEach((dropdown) => {
        dropdown.hidden = true;
    });
});

const verifyForm = document.getElementById("verifyForm");
const verifyWindow = document.getElementById("verifyWindow");
const verifySuccessWindow = document.getElementById("verifySuccessWindow");
const verifySubmitBtn = document.getElementById("verifySubmitBtn");

verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("verifyName").value.trim();
    const role = document.getElementById("roleSelect").value;
    const product = document.getElementById("productSelect").value;
    const link = document.getElementById("productLink").value.trim();
    const video = document.getElementById("productVideo");

    if (!name) {
        alert("Please enter your name");
        return;
    }

    if (!role) {
        alert("Please select a role");
        return;
    }

    if (!product) {
        alert("Please select a product");
        return;
    }

    if (product === "video" && (!video.files || !video.files[0])) {
        alert("Please choose a video file");
        return;
    }

    if (product === "link" && !link) {
        alert("Please enter a link");
        return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("role", role);
    formData.append("product", product);

    if (product === "video") {
        formData.append("productVideo", video.files[0]);
    } else {
        formData.append("productLink", link);
    }

    verifySubmitBtn.disabled = true;
    verifySubmitBtn.textContent = "Sending...";

    try {
        const response = await fetch("/api/verification/request", {
            method: "POST",
            credentials: "include",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Could not submit verification request");
            verifySubmitBtn.disabled = false;
            verifySubmitBtn.textContent = "Verify";
            return;
        }

        verifyWindow.hidden = true;
        verifySuccessWindow.hidden = false;
    } catch (error) {
        console.error(error);
        alert("Could not connect to Veyra Watch");
        verifySubmitBtn.disabled = false;
        verifySubmitBtn.textContent = "Verify";
    }
});