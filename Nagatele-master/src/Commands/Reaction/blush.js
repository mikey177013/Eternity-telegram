// src/Commands/Fun/blush.js
module.exports = {
    name: 'blush',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime blush GIF',
    usage: '.blush (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/blush';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😊 *${M.from.first_name}* blushed at *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😊 *${M.from.first_name}* is blushing!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Blush command error:', error);
        }
    }
};