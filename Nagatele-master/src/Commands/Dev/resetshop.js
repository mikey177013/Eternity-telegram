// src/Commands/Dev/resetshop.js
// Reset the in-memory shop state (rotates stock).
module.exports = {
    name: 'resetshop',
    category: 'dev',
    description: 'Reset / rotate the shop stock',
    usage: '.resetshop',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const handler = M.handler || client.handler;

        try {
            if (handler && typeof handler.resetShop === 'function') {
                await handler.resetShop();
            } else if (typeof client.resetShop === 'function') {
                await client.resetShop();
            } else {
                client.shopState = null;
                client.shopLastReset = Date.now();
            }
            await client.sendMessage(chatId, '🔄 Shop stock has been reset.');
        } catch (e) {
            await client.sendMessage(chatId, `❌ Error: ${e.message}`);
        }
    }
};
