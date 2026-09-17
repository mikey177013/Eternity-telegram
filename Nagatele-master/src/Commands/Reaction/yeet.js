// src/Commands/Fun/yeet.js
module.exports = {
    name: 'yeet',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime yeet GIF',
    usage: '.yeet (reply to someone)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/yeet';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `💥 *${M.from.first_name}* yeeted *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `💥 *${M.from.first_name}* yeeted themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Yeet command error:', error);
        }
    }
};