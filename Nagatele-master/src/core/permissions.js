// src/core/permissions.js
// Centralised permission helpers for Owner + Mods (configured via .env).
//
// .env format:
//   OWNER_ID=7998469369            (single owner; can be comma-separated for multiple)
//   MODS=12345,67890               (Telegram user IDs of mods, comma-separated)
//
// Mods can: ban, unban, mute, unmute any user.
// Owner can: everything mods can + dev commands.

function parseIdList(str) {
    if (!str) return [];
    return String(str)
        .split(/[,\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

function getOwnerIds() {
    return parseIdList(process.env.OWNER_ID || '7998469369');
}

function getModIds() {
    return parseIdList(process.env.MODS || process.env.MOD_IDS || '');
}

function isOwner(userId) {
    if (userId == null) return false;
    return getOwnerIds().includes(String(userId));
}

function isMod(userId) {
    if (userId == null) return false;
    return getModIds().includes(String(userId));
}

/**
 * Owner OR Mod
 */
function isStaff(userId) {
    return isOwner(userId) || isMod(userId);
}

/**
 * Check if user is owner / mod / chat-admin in the given chat.
 */
async function isAdminOrStaff(client, chatId, userId) {
    if (isStaff(userId)) return true;
    try {
        const admins = await client.bot.getChatAdministrators(chatId);
        return admins.some(a => String(a.user.id) === String(userId));
    } catch (_) {
        return false;
    }
}

module.exports = {
    parseIdList,
    getOwnerIds,
    getModIds,
    isOwner,
    isMod,
    isStaff,
    isAdminOrStaff
};
