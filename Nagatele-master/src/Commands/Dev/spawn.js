// src/Commands/Dev/spawn.js
// Manually trigger a card / pokemon spawn in the current chat.
module.exports = {
    name: 'spawn',
    aliases: ['forcespawn'],
    category: 'dev',
    description: 'Force-spawn a card / pokemon in this chat',
    usage: '.spawn [card|poke]',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const type = (arg || '').trim().toLowerCase() || 'card';
        const handler = M.handler || client.handler;

        try {
            if (type.startsWith('p') && handler?.pokeHandler?.spawnPokemon) {
                await handler.pokeHandler.spawnPokemon(chatId);
                return client.sendMessage(chatId, '✨ Pokemon spawned!');
            }

            if (handler?.cardHandler?.spawnCard) {
                await handler.cardHandler.spawnCard(chatId);
                return client.sendMessage(chatId, '✨ Card spawned!');
            }
            if (client.spawnCard) {
                await client.spawnCard(chatId);
                return client.sendMessage(chatId, '✨ Card spawned!');
            }

            await client.sendMessage(chatId, '❌ Spawn handler not available.');
        } catch (e) {
            await client.sendMessage(chatId, `❌ Spawn error: ${e.message}`);
        }
    }
};
