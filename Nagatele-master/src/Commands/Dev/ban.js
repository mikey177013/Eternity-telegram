// src/Commands/Dev/ban.js
// Ban a user from a group. Usable by Owner or Mods.
const { isStaff } = require('../../core/permissions');

module.exports = {
    name: 'ban',
    aliases: ['kickban'],
    category: 'dev',
    description: 'Ban a user from the group',
    usage: '.ban (reply) [reason]   OR   .ban <user_id> [reason]',

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

            // Permission: owner / mod / chat admin
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

            // Identify target
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
                tokens.shift();
            }

            if (!targetUserId) {
                return client.sendMessage(chatId,
                    '❌ Usage:\n• `.ban` (reply to user message) [reason]\n• `.ban <user_id> [reason]`',
                    { parse_mode: 'Markdown' }
                );
            }

            if (targetUserId === adminId) {
                return client.sendMessage(chatId, '❌ You cannot ban yourself.');
            }

            // Don't allow banning the bot itself
            try {
                const me = await client.bot.getMe();
                if (me && Number(me.id) === Number(targetUserId)) {
                    return client.sendMessage(chatId, '❌ I cannot ban myself.');
                }
            } catch (_) {}

            // Don't ban other admins
            try {
                const cm = await client.bot.getChatMember(chatId, targetUserId);
                if (cm && ['administrator', 'creator'].includes(cm.status)) {
                    return client.sendMessage(chatId, '❌ Cannot ban another admin.');
                }
                if (cm?.user?.first_name) targetName = cm.user.first_name;
            } catch (_) {}

            const reason = tokens.join(' ').trim() || 'No reason provided';

            try {
                await client.bot.banChatMember(chatId, targetUserId);
            } catch (e) {
                console.error('banChatMember error:', e.message);
                return client.sendMessage(chatId,
                    `❌ Failed to ban user. Bot may lack permissions.\nError: ${e.message}`,
                    { parse_mode: 'Markdown' }
                );
            }

            const escMd = (s) => String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
            await client.sendMessage(chatId,
                `🚫 *${escMd(targetName)}* has been banned!\n` +
                `🆔 \`${targetUserId}\`\n` +
                `📝 Reason: ${escMd(reason)}`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.error('Ban command error:', error);
            await client.sendMessage(M.chat.id, `❌ Error: ${error.message}`);
        }
    }
};
