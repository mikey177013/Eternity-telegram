// src/Commands/Fun/cringe.js
module.exports = {
    name: 'cringe',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime cringe GIF',
    usage: '.cringe (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/cringe';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😬 *${M.from.first_name}* cringed at *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😬 *${M.from.first_name}* cringed!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Cringe command error:', error);
        }
    }
};