// src/Commands/Fun/highfive.js
module.exports = {
    name: 'highfive',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime highfive GIF',
    usage: '.highfive (reply to someone)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/highfive';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `✋ *${M.from.first_name}* high-fived *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `✋ *${M.from.first_name}* high-fived themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Highfive command error:', error);
        }
    }
};