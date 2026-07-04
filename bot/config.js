import dotenv from 'dotenv';
dotenv.config();

export default {
    BOT_TOKEN: process.env.BOT_TOKEN || '8539240079:AAEh4IDe93eTTsU7WD_gSdUHowu1qnAHpm8',
    API_ID: parseInt(process.env.API_ID) || 38336000,
    API_HASH: process.env.API_HASH || 'b1d2b7352baa64eca9015a53cfae4934',
    GROUP_ID: parseInt(process.env.GROUP_ID) || -1001234567890,
    PRICE: parseInt(process.env.PRICE) || 50000,
    SESSIONS_DIR: './bot/sessions',
    DATABASE_PATH: './database/db.json'
};