// src/Commands/Fun/pat.js
module.exports = {
    name: 'pat',
    aliases: [],
    category: 'Reaction',
    description: 'Send anime pat GIF',
    usage: '.pat (reply to someone or use on yourself)',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const gifUrl = 'https://apis.prexzyvilla.site/anime/pat';
            
            let caption = '';
            if (M.reply_to_message && M.reply_to_message.from) {
                caption = `👋 *${M.from.first_name}* patted *${M.reply_to_message.from.first_name}*!`;
            } else {
                caption = `👋 *${M.from.first_name}* patted themselves!`;
            }
            
            await client.sendAnimation(chatId, gifUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_to_message_id: M.reply_to_message?.message_id
            });
            
        } catch (error) {
            console.error('Pat command error:', error);
        }
    }
};