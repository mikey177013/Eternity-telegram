// src/Commands/Fun/awoo.js
module.exports = {
    name: 'awoo',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime awoo GIF',
    usage: '.awoo (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://media.tenor.com/Hab16KybZZIAAAPo/horo-holo.mp4';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `🐺 *${M.from.first_name}* howled at *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `🐺 *${M.from.first_name}* howled!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Awoo command error:', error);
        }
    }
};