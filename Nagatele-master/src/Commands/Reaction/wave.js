// src/Commands/Fun/wave.js
module.exports = {
    name: 'wave',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime wave GIF',
    usage: '.wave (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/wave';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `👋 *${M.from.first_name}* waved at *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `👋 *${M.from.first_name}* is waving!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Wave command error:', error);
        }
    }
};