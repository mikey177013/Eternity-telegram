// src/Commands/Dev/pm.js
// Send a private message to a user by ID (or to the replied user).
module.exports = {
    name: 'pm',
    aliases: ['dm', 'send'],
    category: 'dev',
    description: 'Send a private message to a user',
    usage: '.pm <user_id> <message>   OR   reply: .pm <message>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const tokens = (arg || '').trim().split(/\s+/);

        let targetId = null;
        let text = '';

        if (M.reply_to_message && M.reply_to_message.from) {
            targetId = M.reply_to_message.from.id;
            text = tokens.join(' ').trim();
        } else if (tokens.length >= 2 && /^\d{5,}$/.test(tokens[0])) {
            targetId = tokens.shift();
            text = tokens.join(' ').trim();
        }

        if (!targetId || !text) {
            return client.sendMessage(chatId,
                '❌ Usage:\n• `.pm <user_id> <message>`\n• Reply to a user with `.pm <message>`',
                { parse_mode: 'Markdown' }
            );
        }

        try {
            await client.sendMessage(targetId,
                `📨 *Message from the bot owner:*\n\n${text}`,
                { parse_mode: 'Markdown' }
            );
            await client.sendMessage(chatId, `✅ Sent to \`${targetId}\``, { parse_mode: 'Markdown' });
        } catch (e) {
            await client.sendMessage(chatId,
                `❌ Failed to PM \`${targetId}\`: ${e.message}\n_(They probably haven't started the bot.)_`,
                { parse_mode: 'Markdown' }
            );
        }
    }
};
