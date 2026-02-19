// src/utils/emailService.js
const SibApiV3Sdk = require('@sendinblue/client');
const { get } = require('./helper');

const sendStatusEmail = async (applicant, newStatus, extraMessage = '') => {
    if (!process.env.BREVO_API_KEY) {
        console.log("⚠️ Skipped Email: No BREVO_API_KEY in .env");
        return;
    }

    try {
        // 1. Fetch Sender Settings from DB
        let senderEmail = 'noreply@example.com';
        let senderName = 'Aloha Security';

        const dbEmail = await get("SELECT value FROM settings WHERE key = 'sender_email'");
        const dbName = await get("SELECT value FROM settings WHERE key = 'sender_name'");

        if (dbEmail) senderEmail = dbEmail.value;
        if (dbName) senderName = dbName.value;

        // 2. Configure API
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        // 3. Construct Content based on Status
        let subject = "";
        let htmlContent = "";

        const commonStyle = `font-family: Arial, sans-serif; color: #333; line-height: 1.6;`;

        if (newStatus === 'For Interview') {
            subject = "Update: Invitation for Interview - Aloha Security";
            htmlContent = `
                <div style="${commonStyle}">
                    <h2>Good news, ${applicant.first_name}!</h2>
                    <p>We have reviewed your application and would like to invite you for an interview.</p>
                    <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
                        <strong>Instructions:</strong><br/>
                        ${extraMessage || "Please visit our main office at 108 Old Highway, Guiwan, Zamboanga City. Bring your original documents."}
                    </div>
                    <p>See you soon!</p>
                </div>
            `;
        } else if (newStatus === 'Hired') {
            subject = "Congratulations! You're Hired - Aloha Security";
            htmlContent = `
                <div style="${commonStyle}">
                    <h2 style="color: #10b981;">Welcome to the Team!</h2>
                    <p>Dear ${applicant.first_name},</p>
                    <p>We are pleased to inform you that your application for <strong>${applicant.position_applied}</strong> has been accepted.</p>
                    <p>Please report to the office for your deployment briefing and uniform fitting.</p>
                </div>
            `;
        } else if (newStatus === 'Rejected') {
            subject = "Application Status Update - Aloha Security";
            htmlContent = `
                <div style="${commonStyle}">
                    <p>Dear ${applicant.first_name},</p>
                    <p>Thank you for your interest in Aloha Security Agency. After careful review, we regret to inform you that we will not be proceeding with your application at this time.</p>
                    <p>We wish you the best in your future endeavors.</p>
                </div>
            `;
        } else {
            return; // No email for other statuses
        }

        // 4. Send
        const sendSmtpEmail = {
            to: [{ email: applicant.email, name: `${applicant.first_name} ${applicant.last_name}` }],
            sender: { email: senderEmail, name: senderName },
            subject: subject,
            htmlContent: htmlContent
        };

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ Email sent to ${applicant.email} [${newStatus}]`);

    } catch (error) {
        console.error("❌ Email Error:", error.body || error.message);
    }
};

module.exports = { sendStatusEmail };