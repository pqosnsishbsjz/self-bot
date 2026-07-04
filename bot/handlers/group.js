const { Markup } = require('telegraf');
const { addUser, getUser, updateUserBalance } = require('../services/database');
const { createSelfbot, deleteSelfbot } = require('../services/selfbot');
const config = require('../config');

// ========== بررسی اینکه کاربر در گروه است ==========
function isInGroup(ctx) {
    return ctx.chat && ctx.chat.id === config.GROUP_ID;
}

// ========== دریافت شماره ==========
async function handleContact(ctx) {
    const userId = ctx.from.id;
    const user = getUser(userId);
    
    if (!user) {
        await ctx.reply('❌ لطفاً ابتدا "سلام" رو بفرستید.');
        return;
    }
    
    if (user.active) {
        await ctx.reply('❌ شما قبلاً سلف فعال دارید!');
        return;
    }
    
    const phone = ctx.message.contact.phone_number;
    
    if (!phone) {
        await ctx.reply('❌ شماره دریافت نشد! دوباره تلاش کن.');
        return;
    }
    
    user.phone = phone;
    user.step = 'awaiting_code';
    
    // ===== درخواست کد از تلگرام =====
    const result = await createSelfbot(userId, phone);
    
    if (result.success) {
        await ctx.reply(
            `✅ **کد تایید به شماره ${phone} ارسال شد!**

📱 کد ۵ رقمی رو که به تلگرامت اومده رو وارد کن.`
        );
    } else {
        await ctx.reply(`❌ خطا: ${result.error}`);
    }
}

// ========== دریافت کد تایید ==========
async function handleCode(ctx, code) {
    const userId = ctx.from.id;
    const user = getUser(userId);
    
    if (!user || user.step !== 'awaiting_code') {
        await ctx.reply('❌ شما در مرحله دریافت کد نیستید! از دستور "خرید" استفاده کن.');
        return;
    }
    
    if (!/^\d{5}$/.test(code)) {
        await ctx.reply('❌ کد باید ۵ رقم باشد! دوباره ارسال کن.');
        return;
    }
    
    // ===== تایید کد و فعال‌سازی سلف =====
    const result = await createSelfbot(userId, user.phone, code);
    
    if (result.success) {
        user.active = true;
        user.activeSince = new Date().toISOString();
        user.step = null;
        
        await ctx.reply(
            `✅ **سلف با موفقیت فعال شد!**

📱 شماره: ${user.phone}
🕐 سلف شما ۲۴ ساعته فعال است.

سلف شما به طور خودکار روی اکانت شما فعال شده است.`
        );
    } else {
        await ctx.reply(`❌ خطا: ${result.error}`);
    }
}

// ========== تابع اصلی مدیریت پیام‌های گروه ==========
async function handleGroupMessage(ctx) {
    // فقط در گروه مشخص شده پاسخ بده
    if (!isInGroup(ctx)) return;
    
    const userId = ctx.from.id;
    const text = ctx.message.text?.trim() || '';
    
    // ===== بررسی اینکه کاربر در مرحله کد هست =====
    const user = getUser(userId);
    if (user && user.step === 'awaiting_code' && /^\d{5}$/.test(text)) {
        await handleCode(ctx, text);
        return;
    }
    
    // ===== دستورات متنی =====
    switch (text.toLowerCase()) {
        case 'سلام':
        case 'start':
            await startCommand(ctx);
            break;
            
        case 'خرید':
            await buyCommand(ctx);
            break;
            
        case 'موجودی':
            await myCommand(ctx);
            break;
            
        case 'لغو':
            await cancelCommand(ctx);
            break;
            
        case 'راهنما':
        case 'help':
            await helpCommand(ctx);
            break;
            
        case 'انصراف':
            if (user) {
                user.step = null;
            }
            await ctx.reply('❌ عملیات لغو شد!');
            break;
            
        default:
            // پیام‌های ناشناخته رو نادیده بگیر
            break;
    }
}

// ========== دستورات ==========
async function startCommand(ctx) {
    const userId = ctx.from.id;
    const user = getUser(userId);
    
    if (!user) {
        addUser(userId, { 
            phone: null, 
            active: false,
            balance: 0,
            createdAt: new Date().toISOString()
        });
    }
    
    await ctx.reply(
        `🤖 **به ربات فروش سلف خوش آمدی!**

💰 قیمت هر سلف: ${config.PRICE.toLocaleString()} تومان
✅ سلف شما ۲۴ ساعته فعال خواهد بود.

📌 **دستورات گروه:**
سلام - شروع کار
خرید - خرید سلف
موجودی - مشاهده موجودی
لغو - لغو سلف فعال
راهنما - نمایش راهنما`
    );
}

async function buyCommand(ctx) {
    const userId = ctx.from.id;
    const user = getUser(userId);
    
    if (!user) {
        await ctx.reply('❌ لطفاً ابتدا "سلام" رو بفرستید.');
        return;
    }
    
    if (user.active) {
        await ctx.reply('❌ شما قبلاً سلف فعال دارید! برای لغو از دستور "لغو" استفاده کن.');
        return;
    }
    
    // چک کردن موجودی
    if (user.balance < config.PRICE) {
        await ctx.reply(
            `❌ **موجودی کافی نیست!**

💰 موجودی شما: ${user.balance.toLocaleString()} تومان
💳 قیمت سلف: ${config.PRICE.toLocaleString()} تومان

برای افزایش موجودی با پشتیبانی تماس بگیرید.`
        );
        return;
    }
    
    // کم کردن از موجودی
    updateUserBalance(userId, -config.PRICE);
    
    await ctx.reply(
        `📱 **لطفاً شماره خود را ارسال کن:**

روی دکمه زیر کلیک کن تا شماره‌ات ارسال شود.`,
        Markup.keyboard([
            [Markup.button.contactRequest('📱 ارسال شماره')],
            ['❌ انصراف']
        ]).resize()
    );
}

async function myCommand(ctx) {
    const userId = ctx.from.id;
    const user = getUser(userId);
    
    if (!user) {
        await ctx.reply('❌ لطفاً ابتدا "سلام" رو بفرستید.');
        return;
    }
    
    let status = '❌ غیرفعال';
    let phone = 'ندارد';
    let activeSince = 'ندارد';
    
    if (user.active) {
        status = '✅ فعال';
        phone = user.phone || 'نامشخص';
        activeSince = user.activeSince || 'نامشخص';
    }
    
    await ctx.reply(
        `📊 **وضعیت حساب شما:**

👤 کاربر: ${ctx.from.first_name}
🆔 آیدی: ${userId}

💰 **موجودی:** ${user.balance.toLocaleString()} تومان

🕐 **سلف:**
وضعیت: ${status}
شماره: ${phone}
فعال از: ${activeSince}`
    );
}

async function cancelCommand(ctx) {
    const userId = ctx.from.id;
    const user = getUser(userId);
    
    if (!user) {
        await ctx.reply('❌ لطفاً ابتدا "سلام" رو بفرستید.');
        return;
    }
    
    if (!user.active) {
        await ctx.reply('❌ شما سلف فعالی ندارید!');
        return;
    }
    
    const result = await deleteSelfbot(userId);
    
    if (result.success) {
        user.active = false;
        user.activeSince = null;
        await ctx.reply('❌ **سلف شما با موفقیت لغو شد!**');
    } else {
        await ctx.reply(`❌ خطا: ${result.error}`);
    }
}

async function helpCommand(ctx) {
    await ctx.reply(
        `📖 **راهنمای ربات:**

سلام - شروع کار
خرید - خرید سلف (شماره و کد تایید)
موجودی - مشاهده موجودی و وضعیت
لغو - لغو سلف فعال
راهنما - نمایش این راهنما

💰 **قیمت:** ${config.PRICE.toLocaleString()} تومان

⚠️ **توجه:**
- سلف شما ۲۴ ساعته فعال است.
- سشن شما ذخیره میشود.
- برای افزایش موجودی با پشتیبانی تماس بگیرید.`
    );
}

module.exports = {
    handleGroupMessage,
    handleContact
};