// src/Commands/Dev/timer.js
// Change the spawn interval (in minutes) for card / pokemon spawning.
module.exports = {
    name: 'timer',
    aliases: ['spawntimer', 'setinterval'],
    category: 'dev',
    description: 'Set spawn interval (minutes)',
    usage: '.timer <minutes>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const mins = parseInt((arg || '').trim(), 10);

        if (!Number.isFinite(mins) || mins < 1 || mins > 240) {
            return client.sendMessage(chatId,
                '❌ Usage: `.timer <minutes>` (1 – 240)',
                { parse_mode: 'Markdown' }
            );
        }

        try {
            client.spawnIntervalMinutes = mins;
            if (typeof client.startCardSpawner === 'function') {
                await client.startCardSpawner(mins);
            }
            await client.sendMessage(chatId,
                `⏱ Spawn interval set to *${mins}* minute(s).`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            await client.sendMessage(chatId, `❌ Error: ${e.message}`);
        }
    }
};
