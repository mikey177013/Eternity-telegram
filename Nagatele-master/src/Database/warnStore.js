// src/Database/warnStore.js
// Lightweight JSON-backed warn store for the warn / removewarn dev commands.
// Stores per-chat warning records keyed by chatId+userId.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const FILE = path.join(DATA_DIR, 'warns.json');

function load() {
    try {
        if (!fs.existsSync(FILE)) return {};
        const txt = fs.readFileSync(FILE, 'utf8');
        if (!txt.trim()) return {};
        return JSON.parse(txt);
    } catch (e) {
        console.error('[warnStore] load error:', e.message);
        return {};
    }
}

function save(data) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[warnStore] save error:', e.message);
    }
}

function _key(chatId, userId) {
    return `${chatId}:${userId}`;
}

function getWarn(chatId, userId) {
    const data = load();
    return data[_key(chatId, userId)] || null;
}

function addWarn(chatId, userId, reason, byId, byName, groupName = '') {
    const data = load();
    const key = _key(chatId, userId);
    const now = new Date();
    const ts = now.toISOString();
    let entry = data[key];
    if (!entry) {
        entry = {
            chatId: String(chatId),
            userId: String(userId),
            warns: 0,
            reasons: [],
            group: groupName || ''
        };
    }
    entry.warns = (entry.warns || 0) + 1;
    entry.reasons.push({
        reason: String(reason || 'No reason'),
        by: String(byId),
        byName: String(byName || ''),
        at: ts
    });
    data[key] = entry;
    save(data);
    return entry;
}

function clearWarns(chatId, userId) {
    const data = load();
    const key = _key(chatId, userId);
    if (!data[key]) return false;
    delete data[key];
    save(data);
    return true;
}

function listChatWarns(chatId) {
    const data = load();
    const prefix = `${chatId}:`;
    const out = [];
    for (const k of Object.keys(data)) {
        if (k.startsWith(prefix)) out.push(data[k]);
    }
    return out;
}

module.exports = {
    getWarn,
    addWarn,
    clearWarns,
    listChatWarns
};
