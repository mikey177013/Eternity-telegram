// src/Commands/Dev/broadcast.js
// Broadcast a message to all groups the bot is in (best effort).
module.exports = {
    name: 'broadcast',
    aliases: ['bc'],
    category: 'dev',
    description: 'Broadcast a message to all known chats',
    usage: '.broadcast <message>   (or reply to a message)',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        let text = (arg || '').trim();

        if (!text && M.reply_to_message && M.reply_to_message.text) {
            text = M.reply_to_message.text;
        }

        if (!text) {
            return client.sendMessage(chatId,
                '❌ Usage: `.broadcast <message>` or reply to a message with `.broadcast`',
                { parse_mode: 'Markdown' }
            );
        }

        // Collect chat ids from known sources
        const targets = new Set();
        try {
            if (client.database && client.database.getAllGroupChatIds) {
                const ids = await client.database.getAllGroupChatIds();
                if (Array.isArray(ids)) ids.forEach(id => targets.add(id));
            }
        } catch (_) { /* ignore */ }

        // Fallback: use active members chat keys from handler
        try {
            const handler = M.handler || client.handler;
            if (handler && handler.activeMembers) {
                for (const cid of handler.activeMembers.keys()) targets.add(cid);
            }
        } catch (_) { /* ignore */ }

        // Always include the current chat
        targets.add(chatId);

        const status = await client.sendMessage(chatId,
            `📣 *Broadcasting to ${targets.size} chat(s)...*`,
            { parse_mode: 'Markdown' }
        );

        let ok = 0, fail = 0;
        const message = `📢 *Broadcast*\n\n${text}`;

        for (const cid of targets) {
            try {
                await client.sendMessage(cid, message, { parse_mode: 'Markdown' });
                ok++;
                // Small delay to avoid hitting Telegram flood limits
                await new Promise(r => setTimeout(r, 50));
            } catch (_) {
                fail++;
            }
        }

        try {
            await client.bot.editMessageText(
                `✅ Broadcast complete.\n• Sent: ${ok}\n• Failed: ${fail}`,
                {
                    chat_id: chatId,
                    message_id: status.message_id,
                    parse_mode: 'Markdown'
                }
            );
        } catch (_) {
            await client.sendMessage(chatId, `✅ Broadcast complete.\n• Sent: ${ok}\n• Failed: ${fail}`);
        }
    }
};
