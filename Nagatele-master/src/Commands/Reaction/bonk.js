// src/Commands/Fun/bonk.js
module.exports = {
    name: 'bonk',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime bonk GIF',
    usage: '.bonk (reply to someone)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/bonk';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `🔨 *${M.from.first_name}* bonked *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `🔨 *${M.from.first_name}* bonked themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Bonk command error:', error);
        }
    }
};