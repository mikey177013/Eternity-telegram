// src/Commands/Reaction/lolice.js
const { resolveTargetUser } = require('../../Helpers/mention');

module.exports = {
    name: 'lolice',
    aliases: [],
    category: 'Reaction',
    exp: 1,
    cool: 4,
    react: '👮',
    description: 'Call the lolice on someone',
    usage: '.lolice @username | reply to user',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://files.catbox.moe/1cqylh.gif';

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
                `🚨 *LOLICE INCOMING!* 🚨\n\n` +
                `🚓 *${fromName}* called the lolice on *${targetLabel}*!\n` +
                `_Put your hands up — you have the right to remain adorable._`;

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
            console.error('lolice command error:', err);
        }
    },
};
