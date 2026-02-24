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

const sendOtpEmail = async (userEmail, userName, otp) => {
    if (!process.env.BREVO_API_KEY) {
        console.error("❌ OTP Skipped: Missing BREVO_API_KEY");
        throw new Error("Email service is not configured.");
    }

    try {
        // 1. FETCH SENDER FROM DB (Fixes the "unverified sender" error)
        let senderEmail = 'noreply@example.com';
        let senderName = 'Aloha Security';

        const dbEmail = await get("SELECT value FROM settings WHERE key = 'sender_email'");
        const dbName = await get("SELECT value FROM settings WHERE key = 'sender_name'");

        if (dbEmail) senderEmail = dbEmail.value;
        if (dbName) senderName = dbName.value;

        console.log(`📨 Attempting to send OTP to ${userEmail} from ${senderEmail}...`);

        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        const sendSmtpEmail = {
            to: [{ email: userEmail, name: userName }],
            sender: { email: senderEmail, name: senderName },
            subject: "Your Password Reset Code - Aloha Security",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="border-bottom: 2px solid #e53828; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="color: #e53828; margin: 0;">Password Reset</h2>
                    </div>
                    <p>Hello <strong>${userName}</strong>,</p>
                    <p>We received a request to reset your password. Use the verification code below to complete the process:</p>
                    
                    <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #232323;">${otp}</span>
                    </div>

                    <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `
        };

        // 2. Send and Capture Response
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        
        // 3. Log Success details for debugging
        console.log(`✅ OTP Email sent successfully!`);
        console.log(`📝 Message ID: ${data.body.messageId}`);

    } catch (error) {
        // 4. Log Failure details
        console.error("❌ OTP Email Failed. Details below:");
        console.error(JSON.stringify(error, null, 2)); // Detailed JSON error
        throw new Error("Failed to send OTP email. Check server console.");
    }
};

// Update module.exports at the bottom
module.exports = { sendStatusEmail, sendOtpEmail };