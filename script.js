const registrationForm = document.getElementById("registrationForm");
const loginForm = document.getElementById("loginForm");
const verificationForm = document.getElementById("verificationForm");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");

const registrationWindow = document.getElementById("registrationWindow");
const loginWindow = document.getElementById("loginWindow");
const verificationWindow = document.getElementById("verificationWindow");
const forgotPasswordWindow = document.getElementById("forgotPasswordWindow");
const resetPasswordWindow = document.getElementById("resetPasswordWindow");

const openLogin = document.getElementById("openLogin");
const openForgotPassword = document.getElementById("openForgotPassword");
const backToRegistration = document.getElementById("backToRegistration");
const backToLogin = document.getElementById("backToLogin");

let verificationEmail = "";
let resetToken = "";

function hideAllWindows() {
    registrationWindow.hidden = true;
    loginWindow.hidden = true;
    verificationWindow.hidden = true;
    forgotPasswordWindow.hidden = true;
    resetPasswordWindow.hidden = true;
}

function showWindow(window) {
    hideAllWindows();
    window.hidden = false;
}

openLogin.addEventListener("click", (event) => {
    event.preventDefault();
    showWindow(loginWindow);
});

backToRegistration.addEventListener("click", (event) => {
    event.preventDefault();
    showWindow(registrationWindow);
});

openForgotPassword.addEventListener("click", (event) => {
    event.preventDefault();
    showWindow(forgotPasswordWindow);
});

backToLogin.addEventListener("click", (event) => {
    event.preventDefault();
    showWindow(loginWindow);
});

registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                email,
                username,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Registration failed");
            return;
        }

        verificationEmail = email;

        registrationForm.reset();

        showWindow(verificationWindow);
    } catch (error) {
        console.error(error);
        alert("Could not connect to Veyra Watch");
    }
});

verificationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const code = document.getElementById("verificationCode").value.trim();

    try {
        const response = await fetch("/api/auth/verify-email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: verificationEmail,
                code
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Verification failed");
            return;
        }

        alert("Email verified successfully");

        verificationForm.reset();
        showWindow(loginWindow);
    } catch (error) {
        console.error(error);
        alert("Could not connect to Veyra Watch");
    }
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Login failed");
            return;
        }

        loginForm.reset();

        window.location.href = "/home.html";
    } catch (error) {
        console.error(error);
        alert("Could not connect to Veyra Watch");
    }
});

forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("forgotEmail").value.trim();
    const username = document.getElementById("forgotUsername").value.trim();

    try {
        const response = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                username
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Could not send reset link");
            return;
        }

        alert("Password reset email sent");

        forgotPasswordForm.reset();
        showWindow(loginWindow);
    } catch (error) {
        console.error(error);
        alert("Could not connect to Veyra Watch");
    }
});

resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    try {
        const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: resetToken,
                password: newPassword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Could not reset password");
            return;
        }

        alert("Password reset successfully");

        resetPasswordForm.reset();
        resetToken = "";

        window.history.replaceState({}, document.title, "/");

        showWindow(loginWindow);
    } catch (error) {
        console.error(error);
        alert("Could not connect to Veyra Watch");
    }
});

const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get("token");

if (tokenFromUrl) {
    resetToken = tokenFromUrl;
    showWindow(resetPasswordWindow);
}

async function checkExistingSession() {
    try {
        const response = await fetch("/api/auth/me");

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (data.user) {
            window.location.href = "/home.html";
        }
    } catch (error) {
        console.error("Could not check existing session:", error);
    }
}

checkExistingSession();