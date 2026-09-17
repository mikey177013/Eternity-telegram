// src/Commands/Fun/kill.js
module.exports = {
    name: 'kill',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime kill GIF',
    usage: '.kill (reply to someone)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/kill';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `☠️ *${M.from.first_name}* killed *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `☠️ *${M.from.first_name}* killed themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Kill command error:', error);
        }
    }
};