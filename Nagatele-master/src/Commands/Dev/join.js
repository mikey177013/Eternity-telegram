// src/Commands/Dev/join.js
// Telegram bots cannot join groups by invite link — but we can advise/share.
module.exports = {
    name: 'join',
    category: 'dev',
    description: 'Get info on how to add the bot to a group',
    usage: '.join',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        let me = null;
        try { me = await client.bot.getMe(); } catch (_) {}
        const username = me?.username ? `@${me.username}` : 'the bot';
        const url = me?.username
            ? `https://t.me/${me.username}?startgroup=true`
            : null;

        const msg =
            `🤝 *Add me to a group*\n\n` +
            `Telegram bots can't auto-join via invite link.\n` +
            `Use this button or share the link to add ${username}:\n` +
            (url ? `\n${url}` : '');

        await client.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: url ? {
                inline_keyboard: [[{ text: '➕ Add me to a group', url }]]
            } : undefined
        });
    }
};
