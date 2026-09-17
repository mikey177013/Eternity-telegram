// src/Commands/Pokemon/pkmn.js
// Lookup a Pokemon by national dex number or name.
const axios = require('axios');
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

module.exports = {
  name: 'pkmn',
  aliases: ['pokemoninfo', 'pinfo'],
  category: 'pokemon',
  exp: 1,
  cool: 3,
  react: '🔎',
  usage: '.pkmn <name|dex>',
  description: 'Look up a Pokemon by name or dex number.',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);
      const term = (arg || '').trim().toLowerCase().split(/\s+/)[0];

      if (!term) {
        return client.sendMessage(chatId, 'Usage: `.pkmn <name|dex>`',
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${term}`, { timeout: 15000 });
      const image = data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default;
      const types = (data.types || []).map(t => t.type.name).join(', ');
      const stats = (data.stats || []).map(s => `${s.stat.name.toUpperCase()}: *${s.base_stat}*`).join('\n');

      const party = await pkmnManager.listParty(userId);
      const pss = await pkmnManager.listPSS(userId);
      const ownedParty = party.filter(p => p.pid === data.id).length;
      const ownedPSS = pss.filter(p => p.pid === data.id).length;

      const caption =
`*${capitalize(data.name)}* (#${data.id})

Type: ${types || 'Unknown'}
Height: ${data.height / 10} m · Weight: ${data.weight / 10} kg

*Base Stats*
${stats}

You own: *${ownedParty}* in Party · *${ownedPSS}* in PSS`;

      if (image) {
        return client.sendPhoto(chatId, image,
          { caption, parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }
      return client.sendMessage(chatId, caption,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      if (err?.response?.status === 404) {
        return client.sendMessage(M.chat.id, 'Pokemon not found.',
          { reply_to_message_id: M.message_id });
      }
      console.error('pkmn error:', err.message);
      return client.sendMessage(M.chat.id, 'Error fetching pokemon.',
        { reply_to_message_id: M.message_id });
    }
  }
};
