// src/Commands/Dev/leave.js
// Make the bot leave the current chat (or a specific chat by id).
module.exports = {
    name: 'leave',
    aliases: ['quit'],
    category: 'dev',
    description: 'Make the bot leave the current group (or a specified chat)',
    usage: '.leave   |   .leave <chat_id>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const target = (arg || '').trim();
        const targetChat = target ? target : chatId;

        try {
            await client.sendMessage(chatId, `👋 Leaving chat \`${targetChat}\`...`, { parse_mode: 'Markdown' });
            await client.bot.leaveChat(targetChat);
        } catch (e) {
            await client.sendMessage(chatId, `❌ Failed to leave: ${e.message}`);
        }
    }
};
