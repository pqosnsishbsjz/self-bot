const config = require('../config');
const fs = require('fs');
const path = require('path');

const SESSIONS_DIR = config.SESSIONS_DIR || './bot/sessions';
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const activeSelfbots = {};

// ========== ساخت سلف جدید ==========
async function createSelfbot(userId, phone, code = null) {
    try {
        const sessionPath = path.join(SESSIONS_DIR, `${userId}.session`);
        
        // ===== درخواست کد =====
        if (!code) {
            console.log(`📱 درخواست کد برای ${phone}`);
            return { 
                success: true, 
                message: 'کد ارسال شد',
                step: 'awaiting_code'
            };
        }
        
        // ===== تایید کد و ذخیره سشن =====
        console.log(`✅ تایید کد ${code} برای ${phone}`);
        
        // ذخیره سشن (ساختگی)
        fs.writeFileSync(sessionPath, JSON.stringify({
            phone: phone,
            userId: userId,
            createdAt: new Date().toISOString()
        }));
        
        // ===== اجرای سلف =====
        startSelfbot(userId, sessionPath);
        
        return { 
            success: true, 
            message: 'سلف با موفقیت فعال شد',
            sessionPath: sessionPath
        };
        
    } catch (error) {
        console.error('❌ خطا در createSelfbot:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

// ========== اجرای سلف‌بات ==========
function startSelfbot(userId, sessionPath) {
    if (activeSelfbots[userId]) {
        console.log(`⚠️ سلف کاربر ${userId} قبلاً فعال است`);
        return;
    }
    
    console.log(`🔄 شروع سلف برای کاربر ${userId}`);
    
    // ===== اجرای سلف به صورت یک پروسه جداگانه =====
    // فعلاً فقط یک تایمر میذاریم
    const timer = setInterval(() => {
        console.log(`✅ سلف کاربر ${userId} فعال است (${new Date().toISOString()})`);
    }, 60000);
    
    activeSelfbots[userId] = {
        startedAt: new Date().toISOString(),
        timer: timer,
        sessionPath: sessionPath
    };
}

// ========== لغو سلف ==========
async function deleteSelfbot(userId) {
    try {
        if (activeSelfbots[userId]) {
            clearInterval(activeSelfbots[userId].timer);
            delete activeSelfbots[userId];
            console.log(`🛑 سلف کاربر ${userId} خاموش شد`);
        }
        
        const sessionPath = path.join(SESSIONS_DIR, `${userId}.session`);
        if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
            console.log(`🗑️ سشن کاربر ${userId} حذف شد`);
        }
        
        return { success: true };
    } catch (error) {
        console.error('❌ خطا در deleteSelfbot:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

// ========== وضعیت سلف ==========
async function getSelfbotStatus(userId) {
    if (activeSelfbots[userId]) {
        return {
            active: true,
            startedAt: activeSelfbots[userId].startedAt,
            sessionPath: activeSelfbots[userId].sessionPath
        };
    }
    
    // چک کردن اینکه فایل سشن وجود داره ولی سلف روشن نیست
    const sessionPath = path.join(SESSIONS_DIR, `${userId}.session`);
    if (fs.existsSync(sessionPath)) {
        return {
            active: false,
            message: 'سشن وجود دارد اما سلف روشن نیست'
        };
    }
    
    return { active: false };
}

// ========== دریافت لیست سلف‌های فعال ==========
function getActiveSelfbots() {
    return Object.keys(activeSelfbots).map(userId => ({
        userId: userId,
        startedAt: activeSelfbots[userId].startedAt
    }));
}

module.exports = {
    createSelfbot,
    deleteSelfbot,
    getSelfbotStatus,
    getActiveSelfbots
};