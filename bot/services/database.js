const fs = require('fs');
const path = require('path');

const DB_PATH = './database/db.json';

// ========== اطمینان از وجود دیتابیس ==========
if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }));
}

// ========== خواندن دیتابیس ==========
function readDB() {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

// ========== نوشتن در دیتابیس ==========
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ========== افزودن کاربر ==========
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

// ========== دریافت کاربر ==========
function getUser(userId) {
    const db = readDB();
    return db.users.find(u => u.id === userId);
}

// ========== دریافت همه کاربران ==========
function getAllUsers() {
    const db = readDB();
    return db.users;
}

// ========== بروزرسانی موجودی ==========
function updateUserBalance(userId, amount) {
    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    
    if (user) {
        user.balance = (user.balance || 0) + amount;
        writeDB(db);
        return true;
    }
    return false;
}

// ========== تنظیم موجودی (برای ادمین) ==========
function setUserBalance(userId, amount) {
    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    
    if (user) {
        user.balance = amount;
        writeDB(db);
        return true;
    }
    return false;
}

module.exports = {
    addUser,
    getUser,
    getAllUsers,
    updateUserBalance,
    setUserBalance
};