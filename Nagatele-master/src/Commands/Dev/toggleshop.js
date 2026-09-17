// src/Commands/Dev/toggleshop.js
// Globally enable / disable the shop.
module.exports = {
    name: 'toggleshop',
    aliases: ['shoptoggle'],
    category: 'dev',
    description: 'Globally enable / disable the shop',
    usage: '.toggleshop on|off',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const v = (arg || '').trim().toLowerCase();

        client.shopEnabled = client.shopEnabled !== false; // default true
        if (v === 'on') client.shopEnabled = true;
        else if (v === 'off') client.shopEnabled = false;
        else client.shopEnabled = !client.shopEnabled;

        await client.sendMessage(chatId,
            client.shopEnabled
                ? '🛒 Shop is now *enabled*.'
                : '🚫 Shop is now *disabled*.',
            { parse_mode: 'Markdown' }
        );
    }
};
