// src/Commands/Dev/disable.js
// Globally enable / disable a command (in-memory).
module.exports = {
    name: 'disable',
    aliases: ['enable', 'togglecmd'],
    category: 'dev',
    description: 'Enable or disable a command globally',
    usage: '.disable <command>   |   .enable <command>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const handler = M.handler || client.handler;
        if (!handler) return client.sendMessage(chatId, '❌ Handler unavailable.');

        handler.disabledCommands ??= new Set();

        const target = (arg || '').trim().toLowerCase().replace(/^\./, '');
        if (!target) {
            const list = [...handler.disabledCommands];
            return client.sendMessage(chatId,
                list.length
                    ? `🚫 Disabled: ${list.map(c => '`' + c + '`').join(', ')}`
                    : '✅ No commands are currently disabled.',
                { parse_mode: 'Markdown' }
            );
        }

        if (!handler.commands.has(target)) {
            return client.sendMessage(chatId, `❌ Unknown command: \`${target}\``, { parse_mode: 'Markdown' });
        }

        // Toggle based on invoked alias name
        const cmdInvoked = (M.text || '').slice(1).split(/\s+/)[0].toLowerCase();
        const action = cmdInvoked === 'enable'
            ? 'enable'
            : cmdInvoked === 'disable'
                ? 'disable'
                : (handler.disabledCommands.has(target) ? 'enable' : 'disable');

        if (action === 'enable') {
            handler.disabledCommands.delete(target);
            return client.sendMessage(chatId, `✅ Enabled \`${target}\``, { parse_mode: 'Markdown' });
        } else {
            handler.disabledCommands.add(target);
            return client.sendMessage(chatId, `🚫 Disabled \`${target}\``, { parse_mode: 'Markdown' });
        }
    }
};
