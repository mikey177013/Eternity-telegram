// src/Commands/Core/id.js
// Markdown-safe ID command with @mention / reply / numeric id support.
const { resolveTargetUser } = require('../../Helpers/mention');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

module.exports = {
    name: 'id',
    aliases: ['myid'],
    category: 'core',
    exp: 1,
    cool: 2,
    react: '🆔',
    usage: '.id [@user | reply | numeric id]',
    description: 'Get your or another user\'s Telegram ID',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;

            // Try to resolve a target user — reply, @mention or numeric id
            const target = await resolveTargetUser(client, M, arg);

            // Self info
            if (!target) {
                const userId = M.from.id.toString();
                const userName = escMd(M.from.first_name || 'User');
                const username = M.from.username ? `@${escMd(M.from.username)}` : 'No username';

                return client.sendMessage(
                    chatId,
                    `🆔 *Your Telegram Info*\n\n` +
                    `👤 *Name:* ${userName}\n` +
                    `📛 *Username:* ${username}\n` +
                    `🔢 *User ID:* \`${userId}\`\n` +
                    `💬 *Chat ID:* \`${chatId}\`\n\n` +
                    `*To share your ID:*\n\`${userId}\``,
                    { parse_mode: 'Markdown' }
                );
            }

            // Unresolved @username
            if (target._unresolved) {
                return client.sendMessage(
                    chatId,
                    `❌ Could not resolve @${escMd(target.username)}.\n\n` +
                    `Plain @mentions only work if the user is registered to the bot.\n` +
                    `Try replying to their message with \`.id\` instead.`,
                    { parse_mode: 'Markdown' }
                );
            }

            const fullName =
                [target.first_name, target.last_name].filter(Boolean).map(escMd).join(' ') ||
                '_(no name)_';
            const usernameOut = target.username ? `@${escMd(target.username)}` : '_None_';

            return client.sendMessage(
                chatId,
                `🆔 *User Info*\n\n` +
                `📛 *Name:* ${fullName}\n` +
                `🔖 *Username:* ${usernameOut}\n` +
                `🔢 *User ID:* \`${target.id}\``,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error('ID command error:', err);
            try {
                await client.bot.sendMessage(M.chat.id, '❌ Error fetching ID.');
            } catch (_) {}
        }
    },
};
