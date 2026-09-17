// src/Commands/Pokemon/pss.js
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

module.exports = {
  name: 'pss',
  aliases: ['pc', 'box'],
  category: 'pokemon',
  exp: 1,
  cool: 3,
  react: '📋',
  usage: '.pss [index]',
  description: 'View your PSS (Pokemon Storage System).',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);

      const pss = await pkmnManager.listPSS(userId);
      if (!pss.length) {
        return client.sendMessage(chatId, 'Your PSS storage is empty.',
          { reply_to_message_id: M.message_id });
      }

      const idx = arg ? parseInt(arg, 10) : 0;
      if (idx && idx >= 1 && idx <= pss.length) {
        const p = pss[idx - 1];
        const types = (p.types || []).join(', ') || 'Unknown';
        const text =
`*${capitalize(p.name)}* ${p.female ? '♀' : '♂'}

PSS ID: *${p.id}*
Level: *${p.level}*
HP: *${p.hp}/${p.maxHp}*
ATK *${p.attack}* · DEF *${p.defense}* · SPD *${p.speed}*
Type: ${types}
Rarity: ${(p.rarity || 'common').toUpperCase()}`;

        if (p.image) {
          return client.sendPhoto(chatId, p.image,
            { caption: text, parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        }
        return client.sendMessage(chatId, text,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      let text = `*PSS Storage* (${pss.length})\n\n`;
      pss.slice(0, 25).forEach((p, i) => {
        text += `${i + 1}. *${capitalize(p.name)}* — Lv ${p.level}\n`;
      });
      if (pss.length > 25) text += `\n…and ${pss.length - 25} more.`;
      text += `\n\nUse \`.pss <n>\` for details · \`.swap pc<n> p<n>\` to swap.`;

      return client.sendMessage(chatId, text,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('pss error:', err);
      return client.sendMessage(M.chat.id, 'Error.');
    }
  }
};
