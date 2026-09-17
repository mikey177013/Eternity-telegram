// src/Commands/Fun/smug.js
module.exports = {
    name: 'smug',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime smug GIF',
    usage: '.smug (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/smug';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😏 *${M.from.first_name}* looked smugly at *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😏 *${M.from.first_name}* looks smug!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Smug command error:', error);
        }
    }
};