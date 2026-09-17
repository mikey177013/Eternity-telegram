// src/Commands/Dev/switch.js
// Enable / disable spawning in the current chat.
module.exports = {
    name: 'switch',
    aliases: ['togglespawn'],
    category: 'dev',
    description: 'Toggle card / pokemon spawning in this chat',
    usage: '.switch on|off',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const handler = M.handler || client.handler;
        handler.spawnDisabled ??= new Set();

        const v = (arg || '').trim().toLowerCase();
        let on = !handler.spawnDisabled.has(chatId);
        if (v === 'on') on = true;
        else if (v === 'off') on = false;
        else on = !on; // toggle if not specified

        if (on) handler.spawnDisabled.delete(chatId);
        else handler.spawnDisabled.add(chatId);

        await client.sendMessage(chatId,
            on ? '✅ Spawning *enabled* in this chat.' : '🚫 Spawning *disabled* in this chat.',
            { parse_mode: 'Markdown' }
        );
    }
};
