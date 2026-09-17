// src/Commands/Dev/removewarn.js
// Clear all warnings of a user in the current chat.

const { isStaff } = require('../../core/permissions');
const warnStore = require('../../Database/warnStore');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
}

module.exports = {
    name: 'removewarn',
    aliases: ['rwarn', 'clearwarn', 'unwarn'],
    category: 'dev',
    exp: 0,
    cool: 3,
    react: '✅',
    usage: '.removewarn (reply | @user | user_id)',
    description: 'Clear all warnings of a user.',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const senderId = M.from.id;
            const handler = M.handler || client.handler;

            if (!['group', 'supergroup'].includes(M.chat.type)) {
                return client.sendMessage(chatId,
                    '❌ This command can only be used in groups.',
                    { reply_to_message_id: M.message_id }
                );
            }

            let allowed = isStaff(senderId);
            if (!allowed && handler && handler.isAdminOrOwner) {
                allowed = await handler.isAdminOrOwner(chatId, senderId);
            }
            if (!allowed) {
                return client.sendMessage(chatId,
                    '❌ Only owner, mods, or group admins can clear warnings.',
                    { reply_to_message_id: M.message_id }
                );
            }

            const tokens = (arg || '').trim().split(/\s+/).filter(Boolean);

            let targetUserId = null;
            let targetName = 'User';

            if (M.reply_to_message && M.reply_to_message.from) {
                targetUserId = M.reply_to_message.from.id;
                targetName = M.reply_to_message.from.first_name || 'User';
            }

            if (!targetUserId && Array.isArray(M.entities)) {
                for (const e of M.entities) {
                    if (e.type === 'text_mention' && e.user) {
                        targetUserId = e.user.id;
                        targetName = e.user.first_name || 'User';
                        break;
                    }
                }
            }

            if (!targetUserId) {
                const chatCache = handler?.activeMembers?.get(chatId);
                const usernameToken = tokens.find(t => t.startsWith('@'));
                if (usernameToken && chatCache) {
                    const uname = usernameToken.slice(1).toLowerCase();
                    for (const [uid, info] of chatCache.entries()) {
                        if (info.username && String(info.username).toLowerCase() === uname) {
                            targetUserId = uid;
                            targetName = info.first_name || uname;
                            break;
                        }
                    }
                }
            }

            if (!targetUserId) {
                const idToken = tokens.find(t => /^\d{5,}$/.test(t));
                if (idToken) {
                    targetUserId = parseInt(idToken, 10);
                    targetName = `User ${idToken}`;
                }
            }

            if (!targetUserId) {
                return client.sendMessage(chatId,
                    '❌ Reply, mention, or specify a user.\nUsage: `.removewarn (reply | @user | user_id)`',
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
                );
            }

            const existed = warnStore.getWarn(chatId, targetUserId);
            const ok = warnStore.clearWarns(chatId, targetUserId);

            if (!ok || !existed) {
                return client.sendMessage(chatId,
                    `⚠️ *${escMd(targetName)}* has no warnings to clear.`,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
                );
            }

            const text =
                `✅ Cleared *${existed.warns}* warning(s) for *${escMd(targetName)}*\n` +
                `🆔 \`${targetUserId}\``;
            try {
                await client.sendMessage(chatId, text, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: M.message_id
                });
            } catch (_) {
                await client.sendMessage(chatId,
                    `✅ Cleared ${existed.warns} warning(s) for ${targetName} (${targetUserId}).`,
                    { reply_to_message_id: M.message_id }
                );
            }
        } catch (err) {
            console.error('[removewarn] Error:', err);
            try {
                await client.sendMessage(M.chat.id, `❌ Error: ${err.message}`);
            } catch (_) {}
        }
    }
};
