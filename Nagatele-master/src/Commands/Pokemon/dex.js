// src/Commands/Pokemon/dex.js
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

module.exports = {
  name: 'dex',
  aliases: ['pokedex'],
  category: 'pokemon',
  exp: 1,
  cool: 3,
  react: '📚',
  usage: '.dex',
  description: 'Show total caught Pokemon (party + PSS).',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);

      const party = await pkmnManager.listParty(userId);
      const pss   = await pkmnManager.listPSS(userId);

      if (!party.length && !pss.length) {
        return client.sendMessage(chatId, 'Your Pokedex is empty.',
          { reply_to_message_id: M.message_id });
      }

      const all = [...party, ...pss];
      const uniq = new Map();
      all.forEach(p => uniq.set(p.pid, p.name));

      const trainer = await pkmnManager.getTrainer(userId);
      const lvl = trainer?.level || 1;

      let text =
`*Pokedex Summary*

Total Caught: *${all.length}*
Unique Species: *${uniq.size}*
In Party: *${party.length}/6*
In PSS: *${pss.length}*
Trainer Level: *${lvl}*

`;

      // Show first 20 unique species
      const list = Array.from(uniq.entries()).slice(0, 20)
        .map(([pid, name]) => `#${pid} — *${capitalize(name)}*`).join('\n');
      text += list;
      if (uniq.size > 20) text += `\n…and ${uniq.size - 20} more.`;

      return client.sendMessage(chatId, text,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('dex error:', err);
      return client.sendMessage(M.chat.id, 'Error.');
    }
  }
};
