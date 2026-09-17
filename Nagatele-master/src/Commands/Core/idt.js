// src/Commands/Core/idt.js
// Get Telegram user ID (supports reply, @mention, text_mention, numeric id).
const { resolveTargetUser } = require('../../Helpers/mention');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

function fmtBlock(label, target) {
    const fullName =
        [target.first_name, target.last_name].filter(Boolean).map(escMd).join(' ') ||
        '_(no name)_';
    const username = target.username ? `@${escMd(target.username)}` : '_None_';

    return `${label}\n\n` +
        `📛 *Name:* ${fullName}\n` +
        `🔖 *Username:* ${username}\n` +
        `🆔 *User ID:* \`${target.id}\``;
}

module.exports = {
    name: 'idt',
    aliases: ['userid', 'getid'],
    category: 'core',
    description: 'Get Telegram user ID',
    usage: '.idt @user | reply .idt | .idt <numeric_id>',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;

            const target = await resolveTargetUser(client, M, arg);

            if (target && !target._unresolved && target.id) {
                return client.sendMessage(
                    chatId,
                    fmtBlock('👤 *User Info*', target),
                    { parse_mode: 'Markdown' }
                );
            }

            if (target?._unresolved) {
                return client.sendMessage(
                    chatId,
                    `❌ Cannot resolve @${escMd(target.username)} to an ID.\n\n` +
                    `Plain @mentions only work for users registered to this bot.\n` +
                    `Please *reply* to the user's message instead:\n` +
                    `• Reply to their message with \`.idt\`\n` +
                    `• Or ask them to use \`.myid\``,
                    { parse_mode: 'Markdown' }
                );
            }

            // Default: sender's own info
            const sender = {
                id: M.from.id,
                first_name: M.from.first_name,
                last_name: M.from.last_name,
                username: M.from.username,
            };
            const body = fmtBlock('👤 *Your Info*', sender) +
                `\n\n*To get someone else's ID:*\n` +
                `• Reply with \`.idt\`\n` +
                `• Or use \`.idt @username\``;

            return client.sendMessage(chatId, body, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('IDT command error:', error);
            try {
                await client.bot.sendMessage(M.chat.id, '❌ Error getting user ID.');
            } catch (_) {}
        }
    },
};
