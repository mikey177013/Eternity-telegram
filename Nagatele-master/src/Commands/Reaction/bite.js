// src/Commands/Fun/bite.js
module.exports = {
    name: 'bite',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime bite GIF',
    usage: '.bite (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/bite';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😬 *${M.from.first_name}* bit *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😬 *${M.from.first_name}* bit themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Bite command error:', error);
        }
    }
};