// src/controllers/settingsController.js
const { get, run } = require('../utils/helper');
const { logAction } = require('../utils/auditLogger');

const getEmailSettings = async (req, res) => {
    try {
        const email = await get("SELECT value FROM settings WHERE key = 'sender_email'");
        const name = await get("SELECT value FROM settings WHERE key = 'sender_name'");
        
        res.status(200).json({
            success: true,
            data: {
                sender_email: email ? email.value : '',
                sender_name: name ? name.value : ''
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const updateEmailSettings = async (req, res) => {
    try {
        const { sender_email, sender_name } = req.body;
        
        await run("INSERT OR REPLACE INTO settings (key, value) VALUES ('sender_email', ?)", [sender_email]);
        await run("INSERT OR REPLACE INTO settings (key, value) VALUES ('sender_name', ?)", [sender_name]);
        
        await logAction(req, 'SETTINGS_UPDATE', `Updated email sender to: ${sender_email}`);
        
        res.status(200).json({ success: true, data: "Settings saved." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const getSystemSettings = async (req, res) => {
    try {
        const settings = await all("SELECT key, value FROM settings");
        const data = {};
        settings.forEach(s => data[s.key] = s.value);
        
        // Provide defaults if not set in DB yet
        if (!data.afk_timer) data.afk_timer = "30";
        if (!data.open_positions) data.open_positions = "Security Guard,Lady Guard,VIP Escort,CCTV Operator";
        
        res.status(200).json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const updateSystemSettings = async (req, res) => {
    try {
        const { afk_timer, open_positions } = req.body;
        
        if (afk_timer) {
            await run("INSERT OR REPLACE INTO settings (key, value) VALUES ('afk_timer', ?)", [afk_timer.toString()]);
        }
        if (open_positions) {
            await run("INSERT OR REPLACE INTO settings (key, value) VALUES ('open_positions', ?)", [open_positions]);
        }
        
        await logAction(req, 'SETTINGS_UPDATE', `Updated system configuration (AFK Timer / Positions).`);
        res.status(200).json({ success: true, data: "System settings saved successfully." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

module.exports = { getEmailSettings, updateEmailSettings, getSystemSettings, updateSystemSettings };