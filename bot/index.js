import TelegramBot from 'node-telegram-bot-api';
import config from './config.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

// ========== دیتابیس ساده ==========
const DB_PATH = path.join(__dirname, '../database/db.json');

function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }));
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return { users: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getUser(userId) {
    const db = readDB();
    return db.users.find(u => u.id === userId);
}

function addUser(userId, data) {
    const db = readDB();
    const existing = db.users.find(u => u.id === userId);
    if (existing) {
        Object.assign(existing, data);
    } else {
        db.users.push({ id: userId, ...data });
    }
    writeDB(db);
}

function updateBalance(userId, amount) {
    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    if (user) {
        user.balance = (user.balance || 0) + amount;
        writeDB(db);
        return true;
    }
    return false;
}

// ========== ایجاد ربات ==========
console.log('🤖 ربات فروش سلف شروع به کار کرد!');
console.log(`📱 ربات در گروه ${config.GROUP_ID} فعال است.`);

const bot = new TelegramBot(config.BOT_TOKEN, { 
    polling: true,
    // timeout: 30,
    // baseApiUrl: 'https://api.telegram.org' // میتونی به api.telegram.org/bot هم تغییر بدی
});

// ========== مدیریت خطا ==========
bot.on('polling_error', (error) => {
    console.error('❌ خطا:', error.message);
});

// ========== همه پیام‌های گروه ==========
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim() || '';
    const userId = msg.from.id;
    
    // فقط در گروه مشخص شده پاسخ بده
    if (chatId !== config.GROUP_ID) return;
    
    // ===== کاربر رو پیدا کن یا بساز =====
    let user = getUser(userId);
    if (!user) {
        addUser(userId, { 
            phone: null, 
            active: false,
            balance: 0,
            step: null,
            createdAt: new Date().toISOString()
        });
        user = getUser(userId);
    }
    
    // ===== مدیریت دستورات متنی =====
    switch (text.toLowerCase()) {
        case 'سلام':
        case 'start':
            bot.sendMessage(chatId,
                `🤖 **به ربات فروش سلف خوش آمدی!**

💰 قیمت هر سلف: ${config.PRICE.toLocaleString()} تومان

📌 **دستورات گروه:**
سلام - شروع کار
خرید - خرید سلف
موجودی - مشاهده موجودی
لغو - لغو سلف فعال
راهنما - نمایش راهنما`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 'خرید':
            if (user.active) {
                bot.sendMessage(chatId, '❌ شما قبلاً سلف فعال دارید! برای لغو از دستور "لغو" استفاده کن.');
                return;
            }
            
            if (user.balance < config.PRICE) {
                bot.sendMessage(chatId,
                    `❌ **موجودی کافی نیست!**

💰 موجودی شما: ${user.balance.toLocaleString()} تومان
💳 قیمت سلف: ${config.PRICE.toLocaleString()} تومان

برای افزایش موجودی با پشتیبانی تماس بگیرید.`
                );
                return;
            }
            
            updateBalance(userId, -config.PRICE);
            user.step = 'awaiting_phone';
            bot.sendMessage(chatId, '📱 لطفاً شماره خود را به صورت **+98xxxxxxxxxx** ارسال کن.');
            break;
            
        case 'موجودی':
            let status = user.active ? '✅ فعال' : '❌ غیرفعال';
            bot.sendMessage(chatId,
                `📊 **وضعیت حساب شما:**

👤 کاربر: ${msg.from.first_name}
💰 **موجودی:** ${(user.balance || 0).toLocaleString()} تومان

🕐 **سلف:** ${status}
${user.phone ? `📱 شماره: ${user.phone}` : ''}`
            );
            break;
            
        case 'لغو':
            if (!user.active) {
                bot.sendMessage(chatId, '❌ شما سلف فعالی ندارید!');
                return;
            }
            user.active = false;
            user.activeSince = null;
            bot.sendMessage(chatId, '❌ **سلف شما با موفقیت لغو شد!**');
            break;
            
        case 'راهنما':
        case 'help':
            bot.sendMessage(chatId,
                `📖 **راهنمای ربات:**

سلام - شروع کار
خرید - خرید سلف
موجودی - مشاهده موجودی و وضعیت
لغو - لغو سلف فعال
راهنما - نمایش این راهنما

💰 **قیمت:** ${config.PRICE.toLocaleString()} تومان

⚠️ **توجه:**
- سلف شما ۲۴ ساعته فعال است.
- برای افزایش موجودی با پشتیبانی تماس بگیرید.`
            );
            break;
            
        default:
            // ===== بررسی کد تایید (۵ رقم) =====
            if (/^\d{5}$/.test(text) && user.step === 'awaiting_phone') {
                // شبیه‌سازی فعال‌سازی سلف
                user.active = true;
                user.activeSince = new Date().toISOString();
                user.step = null;
                user.phone = text; // موقتاً کد رو به عنوان شماره ذخیره کن
                bot.sendMessage(chatId,
                    `✅ **سلف با موفقیت فعال شد!**

📱 شماره: ${text}
🕐 سلف شما ۲۴ ساعته فعال است.

سلف شما به طور خودکار روی اکانت شما فعال شده است.`
                );
            }
            break;
    }
});

console.log('✅ ربات روشن شد!');