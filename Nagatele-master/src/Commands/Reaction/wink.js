// src/Commands/Fun/wink.js
module.exports = {
    name: 'wink',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime wink GIF',
    usage: '.wink (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/wink';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😉 *${M.from.first_name}* winked at *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😉 *${M.from.first_name}* winked!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Wink command error:', error);
        }
    }
};