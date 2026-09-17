// src/Commands/Fun/cry.js
module.exports = {
    name: 'cry',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime cry GIF',
    usage: '.cry (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/cry';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `😭 *${M.from.first_name}* cried with *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `😭 *${M.from.first_name}* cried!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Cry command error:', error);
        }
    }
};