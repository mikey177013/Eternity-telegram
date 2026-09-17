// src/Commands/Dev/totalwarn.js
// Show total warnings in the current chat (or for a specific user).
module.exports = {
    name: 'totalwarn',
    aliases: ['warns', 'warnlist'],
    category: 'dev',
    description: 'Show warnings in this chat',
    usage: '.totalwarn   OR   .totalwarn <user_id>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const handler = M.handler || client.handler;
        handler.warns ??= new Map();

        const tokens = (arg || '').trim().split(/\s+/).filter(Boolean);
        let onlyUser = null;
        if (M.reply_to_message && M.reply_to_message.from) onlyUser = M.reply_to_message.from.id;
        else if (tokens.length && /^\d{5,}$/.test(tokens[0])) onlyUser = parseInt(tokens[0], 10);

        const prefix = `${chatId}_`;
        const rows = [];
        for (const [key, entry] of handler.warns.entries()) {
            if (!key.startsWith(prefix)) continue;
            const uid = key.slice(prefix.length);
            if (onlyUser && String(onlyUser) !== uid) continue;
            rows.push(`• \`${uid}\` — ${entry.count}/3`);
        }

        if (!rows.length) {
            return client.sendMessage(chatId, 'ℹ️ No warnings recorded for this chat.');
        }

        await client.sendMessage(chatId,
            `⚠️ *Warnings in this chat:*\n\n${rows.join('\n')}`,
            { parse_mode: 'Markdown' }
        );
    }
};
