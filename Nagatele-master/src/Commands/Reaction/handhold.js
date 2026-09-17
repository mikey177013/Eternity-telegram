// src/Commands/Fun/handhold.js
module.exports = {
    name: 'handhold',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime handhold GIF',
    usage: '.handhold (reply to someone)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/handhold';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `👫 *${M.from.first_name}* held hands with *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `👫 *${M.from.first_name}* held their own hands!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Handhold command error:', error);
        }
    }
};