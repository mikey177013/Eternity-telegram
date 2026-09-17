// src/Commands/Fun/bully.js
module.exports = {
    name: 'bully',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime bully GIF',
    usage: '.bully (reply to someone)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/bully';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😈 *${M.from.first_name}* bullied *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😈 *${M.from.first_name}* bullied themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Bully command error:', error);
        }
    }
};