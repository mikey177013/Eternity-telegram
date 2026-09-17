// src/Commands/Fun/smile.js
module.exports = {
    name: 'smile',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime smile GIF',
    usage: '.smile (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/smile';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😊 *${M.from.first_name}* smiled at *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😊 *${M.from.first_name}* is smiling!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Smile command error:', error);
        }
    }
};