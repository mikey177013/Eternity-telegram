// src/Commands/Fun/slap.js
module.exports = {
    name: 'slap',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime slap GIF',
    usage: '.slap (reply to someone)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/slap';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `👋 *${M.from.first_name}* slapped *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `👋 *${M.from.first_name}* slapped themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Slap command error:', error);
        }
    }
};