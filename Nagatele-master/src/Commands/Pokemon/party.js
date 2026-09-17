// src/Commands/Pokemon/party.js
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

module.exports = {
  name: 'party',
  aliases: ['team'],
  category: 'pokemon',
  exp: 1,
  cool: 3,
  react: '🟩',
  usage: '.party [index]',
  description: 'View your Pokemon party.',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);

      const party = await pkmnManager.listParty(userId);
      if (!party.length) {
        return client.sendMessage(chatId,
          'Your party is empty. Start with `.pstart`.',
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      const idx = arg ? parseInt(arg, 10) : 0;

      // Show single pokemon detail
      if (idx && idx >= 1 && idx <= party.length) {
        const p = party[idx - 1];
        const types = (p.types || []).join(', ') || 'Unknown';
        const text =
`*${capitalize(p.name)}* ${p.female ? '♀' : '♂'}

ID: *${p.id}*
Level: *${p.level}*
EXP: *${p.exp}*
HP: *${p.hp}/${p.maxHp}*
ATK: *${p.attack}*  DEF: *${p.defense}*  SPD: *${p.speed}*
Type: ${types}
Rarity: ${(p.rarity || 'common').toUpperCase()}
Active: ${p.isActive ? 'Yes' : 'No'}`;

        if (p.image) {
          return client.sendPhoto(chatId, p.image,
            { caption: text, parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        }
        return client.sendMessage(chatId, text,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      // List view
      let text = `*Your Party* (${party.length}/6)\n\n`;
      party.forEach((p, i) => {
        const active = p.isActive ? ' *[A]*' : '';
        text += `${i + 1}. *${capitalize(p.name)}* — Lv ${p.level} · HP ${p.hp}/${p.maxHp}${active}\n`;
      });
      text += `\nUse \`.party <n>\` for details · \`.setactive <id>\` to switch active.`;

      return client.sendMessage(chatId, text,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('party error:', err);
      return client.sendMessage(M.chat.id, 'Error.');
    }
  }
};
