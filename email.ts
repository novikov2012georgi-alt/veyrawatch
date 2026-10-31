import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
    email: string,
    code: string
) {
    const result = await resend.emails.send({
        from: "VeyraWatch <onboarding@resend.dev>",
        to: email,
        subject: "VeyraWatch Email Verification",
        html: `
            <h2>Verify your VeyraWatch account</h2>
            <p>Your verification code is:</p>
            <h1>${code}</h1>
            <p>This code is valid for 24 hours.</p>
        `
    });

    if (result.error) {
        throw new Error(result.error.message);
    }
}

export async function sendPasswordResetEmail(
    email: string,
    resetUrl: string
) {
    const result = await resend.emails.send({
        from: "VeyraWatch <onboarding@resend.dev>",
        to: email,
        subject: "VeyraWatch Password Reset",
        html: `
            <h2>Reset your VeyraWatch password</h2>
            <p>Click the link below to create a new password:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This link is valid for 1 hour.</p>
        `
    });

    if (result.error) {
        throw new Error(result.error.message);
    }
}

export async function sendVerificationRequestToAdmin(params: {
    adminEmail: string;
    username: string;
    userEmail: string;
    displayName: string;
    role: string;
    productType: string;
    productVideoUrl: string | null;
    productLink: string | null;
    approveUrl: string;
    rejectUrl: string;
}) {
    const productBlock =
        params.productType === "video"
            ? `<p><strong>Product video:</strong> <a href="${params.productVideoUrl}">${params.productVideoUrl}</a></p>`
            : `<p><strong>Product link:</strong> <a href="${params.productLink}">${params.productLink}</a></p>`;

    const result = await resend.emails.send({
        from: "VeyraWatch <onboarding@resend.dev>",
        to: params.adminEmail,
        subject: `VeyraWatch verification request from @${params.username}`,
        html: `
            <h2>New verification request</h2>
            <p><strong>Username:</strong> @${params.username}</p>
            <p><strong>Account email:</strong> ${params.userEmail}</p>
            <p><strong>Display name:</strong> ${params.displayName}</p>
            <p><strong>Role:</strong> ${params.role}</p>
            <p><strong>Product type:</strong> ${params.productType}</p>
            ${productBlock}
            <hr>
            <p>
                <a href="${params.approveUrl}"
                   style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px;">
                    Approve
                </a>
                <a href="${params.rejectUrl}"
                   style="display:inline-block;padding:10px 16px;background:#666;color:#fff;text-decoration:none;border-radius:6px;">
                    Reject
                </a>
            </p>
            <p style="color:#666;font-size:12px;">If the buttons do not work, open the links manually:</p>
            <p style="font-size:12px;">Approve: ${params.approveUrl}</p>
            <p style="font-size:12px;">Reject: ${params.rejectUrl}</p>
        `
    });

    if (result.error) {
        throw new Error(result.error.message);
    }
}