// src/Commands/Dev/warn.js
// Warn a user. Auto-bans after 3 warnings.
// Usable by owner / mods / chat admins.

const { isStaff } = require('../../core/permissions');
const warnStore = require('../../Database/warnStore');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
}

module.exports = {
    name: 'warn',
    aliases: ['warning'],
    category: 'dev',
    exp: 0,
    cool: 3,
    react: '⚠️',
    usage: '.warn (reply | @user | user_id) <reason>',
    description: 'Warn a user. Auto-bans after 3 warnings.',

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
                    '❌ Only owner, mods, or group admins can warn.',
                    { reply_to_message_id: M.message_id }
                );
            }

            const tokens = (arg || '').trim().split(/\s+/).filter(Boolean);

            // Target resolution
            let targetUserId = null;
            let targetName = 'User';
            let consumedTokenIndex = -1;

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
                for (let i = 0; i < tokens.length; i++) {
                    const t = tokens[i];
                    if (t.startsWith('@') && chatCache) {
                        const uname = t.slice(1).toLowerCase();
                        for (const [uid, info] of chatCache.entries()) {
                            if (info.username && String(info.username).toLowerCase() === uname) {
                                targetUserId = uid;
                                targetName = info.first_name || uname;
                                consumedTokenIndex = i;
                                break;
                            }
                        }
                        if (targetUserId) break;
                    }
                }
            }

            if (!targetUserId) {
                for (let i = 0; i < tokens.length; i++) {
                    if (/^\d{5,}$/.test(tokens[i])) {
                        targetUserId = parseInt(tokens[i], 10);
                        targetName = `User ${tokens[i]}`;
                        consumedTokenIndex = i;
                        break;
                    }
                }
            }

            if (!targetUserId) {
                return client.sendMessage(chatId,
                    '❌ Reply, mention, or specify a user.\nUsage: `.warn (reply | @user | user_id) <reason>`',
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
                );
            }

            // Reason = remaining tokens (drop the consumed @user / id one if any)
            let reasonTokens = tokens;
            if (consumedTokenIndex !== -1) {
                reasonTokens = tokens.filter((_, idx) => idx !== consumedTokenIndex);
            }
            // Also strip any @username / numeric-id leftovers
            reasonTokens = reasonTokens.filter(t => !t.startsWith('@') && !/^\d{5,}$/.test(t));
            const reason = reasonTokens.join(' ').trim() || 'No reason provided';

            // Don't allow warning self
            if (Number(targetUserId) === Number(senderId)) {
                return client.sendMessage(chatId,
                    '❌ You cannot warn yourself.',
                    { reply_to_message_id: M.message_id }
                );
            }

            // Don't allow warning the bot
            try {
                const me = await client.bot.getMe();
                if (me && Number(me.id) === Number(targetUserId)) {
                    return client.sendMessage(chatId,
                        '❌ I cannot warn myself.',
                        { reply_to_message_id: M.message_id }
                    );
                }
            } catch (_) {}

            // Don't warn other admins
            try {
                const cm = await client.bot.getChatMember(chatId, targetUserId);
                if (cm && ['administrator', 'creator'].includes(cm.status) && !isStaff(senderId)) {
                    return client.sendMessage(chatId,
                        '❌ Cannot warn another admin.',
                        { reply_to_message_id: M.message_id }
                    );
                }
                if (cm?.user?.first_name) targetName = cm.user.first_name;
            } catch (_) {}

            let groupName = 'Unknown Group';
            try {
                const chatInfo = await client.bot.getChat(chatId);
                groupName = chatInfo?.title || groupName;
            } catch (_) {}

            const senderName = M.from.first_name || 'Staff';
            const entry = warnStore.addWarn(chatId, targetUserId, reason, senderId, senderName, groupName);

            if (entry.warns >= 3) {
                // Auto-ban
                let banOk = true;
                let banErr = '';
                try {
                    await client.bot.banChatMember(chatId, targetUserId);
                } catch (e) {
                    banOk = false;
                    banErr = e.message || String(e);
                }
                // Clear after ban
                warnStore.clearWarns(chatId, targetUserId);

                const text = banOk
                    ? `🚫 *${escMd(targetName)}* has been auto-banned for receiving 3 warnings.\n` +
                      `🆔 \`${targetUserId}\`\n` +
                      `📝 Last Reason: ${escMd(reason)}\n` +
                      `👤 Warned By: *${escMd(senderName)}*`
                    : `⚠️ Could not auto-ban *${escMd(targetName)}* (3 warnings reached).\n` +
                      `Error: ${escMd(banErr)}`;
                try {
                    await client.sendMessage(chatId, text, {
                        parse_mode: 'Markdown',
                        reply_to_message_id: M.message_id
                    });
                } catch (_) {
                    await client.sendMessage(chatId,
                        banOk
                            ? `🚫 ${targetName} (${targetUserId}) auto-banned for 3 warnings. Reason: ${reason}`
                            : `⚠️ Could not auto-ban ${targetName}. Error: ${banErr}`,
                        { reply_to_message_id: M.message_id }
                    );
                }
            } else {
                const text =
                    `⚠️ *${escMd(targetName)}* has been warned.\n` +
                    `🆔 \`${targetUserId}\`\n` +
                    `📝 Reason: ${escMd(reason)}\n` +
                    `📌 Warning *${entry.warns}/3*\n` +
                    `👤 Warned By: *${escMd(senderName)}*`;
                try {
                    await client.sendMessage(chatId, text, {
                        parse_mode: 'Markdown',
                        reply_to_message_id: M.message_id
                    });
                } catch (_) {
                    await client.sendMessage(chatId,
                        `⚠️ ${targetName} (${targetUserId}) warned [${entry.warns}/3]. Reason: ${reason}`,
                        { reply_to_message_id: M.message_id }
                    );
                }
            }
        } catch (err) {
            console.error('[warn] Error:', err);
            try {
                await client.sendMessage(M.chat.id, `❌ Error: ${err.message}`);
            } catch (_) {}
        }
    }
};
