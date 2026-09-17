// src/Commands/Dev/eval.js
// Evaluate arbitrary JavaScript. Owner-only (gated by category=dev in MessageHandler).
const util = require('util');

module.exports = {
    name: 'eval',
    aliases: ['ev', '>'],
    category: 'dev',
    description: 'Evaluate JavaScript code',
    usage: '.eval <code>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const code = (arg || '').trim();

        if (!code) {
            return client.sendMessage(chatId, '❌ Usage: `.eval <code>`', { parse_mode: 'Markdown' });
        }

        try {
            // Useful locals
            const bot = client.bot;
            const handler = M.handler || client.handler;
            const ctx = M;

            let result = eval(code); // eslint-disable-line no-eval
            if (result && typeof result.then === 'function') {
                result = await result;
            }

            let out = typeof result === 'string'
                ? result
                : util.inspect(result, { depth: 1, maxArrayLength: 30 });

            if (!out || out === 'undefined') out = '✅ Done (no return value)';
            if (out.length > 3500) out = out.slice(0, 3500) + '\n...[truncated]';

            await client.sendMessage(chatId,
                '```js\n' + out + '\n```',
                { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
            );
        } catch (error) {
            await client.sendMessage(chatId,
                '❌ *Eval Error:*\n```\n' + String(error && error.stack ? error.stack : error).slice(0, 3500) + '\n```',
                { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
            );
        }
    }
};
