// src/Commands/Fun/glomp.js
module.exports = {
    name: 'glomp',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime glomp GIF',
    usage: '.glomp (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/glomp';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `🤗 *${M.from.first_name}* glomped *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `🤗 *${M.from.first_name}* glomped themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Glomp command error:', error);
        }
    }
};