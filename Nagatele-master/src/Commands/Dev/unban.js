// src/Commands/Dev/unban.js
// Unban a previously banned user. Usable by Owner or Mods.
const { isStaff } = require('../../core/permissions');

module.exports = {
    name: 'unban',
    aliases: ['removeban'],
    category: 'dev',
    description: 'Unban a user from the group',
    usage: '.unban (reply)   OR   .unban <user_id>',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const adminId = M.from.id;
            const handler = M.handler || client.handler;

            if (!['group', 'supergroup'].includes(M.chat.type)) {
                return client.sendMessage(chatId,
                    '❌ This command can only be used in groups.',
                    { parse_mode: 'Markdown' }
                );
            }

            let allowed = isStaff(adminId);
            if (!allowed && handler && handler.isAdminOrOwner) {
                allowed = await handler.isAdminOrOwner(chatId, adminId);
            }
            if (!allowed) {
                return client.sendMessage(chatId,
                    '❌ Only the bot owner, mods, or group admins can use this command.',
                    { parse_mode: 'Markdown' }
                );
            }

            const tokens = (arg || '').trim().split(/\s+/).filter(Boolean);

            let targetUserId = null;
            let targetName = 'User';

            if (M.reply_to_message && M.reply_to_message.from) {
                targetUserId = M.reply_to_message.from.id;
                targetName = M.reply_to_message.from.first_name || 'User';
            } else if (Array.isArray(M.entities)) {
                for (const e of M.entities) {
                    if (e.type === 'text_mention' && e.user) {
                        targetUserId = e.user.id;
                        targetName = e.user.first_name || 'User';
                        break;
                    }
                }
            }
            if (!targetUserId && tokens.length && /^\d{5,}$/.test(tokens[0])) {
                targetUserId = parseInt(tokens[0], 10);
            }

            if (!targetUserId) {
                return client.sendMessage(chatId,
                    '❌ Usage:\n• `.unban` (reply to user message)\n• `.unban <user_id>`',
                    { parse_mode: 'Markdown' }
                );
            }

            try {
                await client.bot.unbanChatMember(chatId, targetUserId, { only_if_banned: true });
            } catch (e) {
                console.error('unbanChatMember error:', e.message);
                return client.sendMessage(chatId,
                    `❌ Failed to unban user. Bot may lack permissions.\nError: ${e.message}`,
                    { parse_mode: 'Markdown' }
                );
            }

            const escMd = (s) => String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
            await client.sendMessage(chatId,
                `✅ *${escMd(targetName)}* has been unbanned!\n🆔 \`${targetUserId}\``,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.error('Unban command error:', error);
            await client.sendMessage(M.chat.id, `❌ Error: ${error.message}`);
        }
    }
};
