// src/Commands/Dev/reset.js
// Reset a user's economy data (balance, treasury, moonstones, mana, items).
const econManager = require('../../Database/econManager');

module.exports = {
    name: 'reset',
    aliases: ['resetuser'],
    category: 'dev',
    description: "Reset a user's economy data",
    usage: '.reset (reply)   OR   .reset <user_id>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const tokens = (arg || '').trim().split(/\s+/).filter(Boolean);

        let targetId = null;
        if (M.reply_to_message && M.reply_to_message.from) {
            targetId = M.reply_to_message.from.id;
        } else if (tokens.length && /^\d{5,}$/.test(tokens[0])) {
            targetId = tokens[0];
        }

        if (!targetId) {
            return client.sendMessage(chatId,
                '❌ Usage: `.reset (reply)` or `.reset <user_id>`',
                { parse_mode: 'Markdown' }
            );
        }

        try {
            const fields = ['aurites', 'treasury', 'moonstones', 'mana', 'pepperspray', 'luckpotion'];
            for (const f of fields) {
                try { await econManager.setValue(String(targetId), f, 0); } catch (_) {}
            }
            await client.sendMessage(chatId,
                `✅ Reset economy for \`${targetId}\`.`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            await client.sendMessage(chatId, `❌ Error: ${e.message}`);
        }
    }
};
