// src/Commands/Dev/clear.js
// Delete a range of recent messages in the current chat.
module.exports = {
    name: 'clear',
    aliases: ['purge'],
    category: 'dev',
    description: 'Delete the last N messages (bot must be admin in groups)',
    usage: '.clear <count>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const n = Math.min(parseInt((arg || '').trim(), 10) || 10, 100);

        const startId = M.message_id;
        let ok = 0, fail = 0;

        for (let i = 0; i < n; i++) {
            const id = startId - i;
            try {
                await client.bot.deleteMessage(chatId, id);
                ok++;
            } catch (_) {
                fail++;
            }
        }

        const note = await client.sendMessage(chatId,
            `🧹 Cleared ${ok} message(s). (${fail} failed)`,
            { parse_mode: 'Markdown' }
        );
        setTimeout(() => {
            client.bot.deleteMessage(chatId, note.message_id).catch(() => {});
        }, 4000);
    }
};
