// src/Commands/Reaction/horny.js
const { resolveTargetUser } = require('../../Helpers/mention');

module.exports = {
    name: 'horny',
    aliases: [],
    category: 'Reaction',
    exp: 1,
    cool: 4,
    react: '🚓',
    description: 'Send someone to horny jail',
    usage: '.horny @username | reply to user',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://files.catbox.moe/lopo48.gif';

            const target = await resolveTargetUser(client, M, arg);
            const fromName = M.from.first_name || 'User';

            let targetLabel;
            if (target && !target._unresolved) {
                targetLabel = target.username
                    ? `@${target.username}`
                    : (target.first_name || 'User');
            } else if (target?._unresolved) {
                targetLabel = `@${target.username}`;
            } else {
                targetLabel = `themselves`;
            }

            const caption =
                `🚓 *HORNY JAIL!* 🚓\n\n` +
                `🔒 *${fromName}* sent *${targetLabel}* to horny jail!\n` +
                `_No bail. No parole. Reflect on your actions._`;

            try {
                await client.sendAnimation(chatId, gifUrl, {
                    caption,
                    parse_mode: 'Markdown',
                    reply_to_message_id: M.reply_to_message?.message_id || M.message_id,
                });
            } catch (_) {
                await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
            }
        } catch (err) {
            console.error('horny command error:', err);
        }
    },
};
