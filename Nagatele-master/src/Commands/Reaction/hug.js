// src/Commands/Fun/hug.js
module.exports = {
    name: 'hug',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime hug GIF',
    usage: '.hug (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/hug';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `🤗 *${M.from.first_name}* hugged *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `🤗 *${M.from.first_name}* hugged themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Hug command error:', error);
        }
    }
};