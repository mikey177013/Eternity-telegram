// src/Commands/Pokemon/setactive.js
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

module.exports = {
  name: 'setactive',
  aliases: ['setpokemon', 'active'],
  category: 'pokemon',
  exp: 1,
  cool: 3,
  react: '⭐',
  usage: '.setactive <partyId>',
  description: 'Set your active Pokemon (used in catch battles).',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);
      const pokeId = parseInt((arg || '').trim(), 10);

      if (!pokeId) {
        return client.sendMessage(chatId, 'Usage: `.setactive <partyId>`',
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      const p = await pkmnManager.getPokemonById(userId, pokeId);
      if (!p) {
        return client.sendMessage(chatId, 'Pokemon not found in your party.',
          { reply_to_message_id: M.message_id });
      }
      await pkmnManager.setActivePokemon(userId, pokeId);
      return client.sendMessage(chatId,
        `*${capitalize(p.name)}* (ID ${pokeId}) is now your active Pokemon.`,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('setactive error:', err);
      return client.sendMessage(M.chat.id, 'Error.');
    }
  }
};
