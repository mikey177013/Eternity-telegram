// src/Commands/Fun/dance.js
module.exports = {
    name: 'dance',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime dance GIF',
    usage: '.dance (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/dance';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `💃 *${M.from.first_name}* danced with *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `💃 *${M.from.first_name}* is dancing!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Dance command error:', error);
        }
    }
};