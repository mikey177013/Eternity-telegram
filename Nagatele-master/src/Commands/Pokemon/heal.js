// src/Commands/Pokemon/heal.js
const pkmnManager = require('../../Database/pokemonManager');

const HEAL_COOLDOWN_KEY = (uid) => `${uid}_heal_cd`;
const COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes

module.exports = {
  name: 'heal',
  aliases: ['healall'],
  category: 'pokemon',
  exp: 2,
  cool: 4,
  react: '💊',
  usage: '.heal',
  description: 'Heal all Pokemon in your party.',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);

      const last = (client.healCooldowns ??= new Map()).get(userId) || 0;
      if (last && Date.now() - last < COOLDOWN_MS) {
        const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 60000);
        return client.sendMessage(chatId,
          `You healed recently. Try again in *${left}* minute(s).`,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      const party = await pkmnManager.listParty(userId);
      if (!party.length) {
        return client.sendMessage(chatId, 'Your party is empty.',
          { reply_to_message_id: M.message_id });
      }

      const updated = await pkmnManager.healAllParty(userId);
      client.healCooldowns.set(userId, Date.now());

      return client.sendMessage(chatId,
        `*Party healed!* Restored ${updated} Pokemon to full HP.`,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('heal error:', err);
      return client.sendMessage(M.chat.id, 'Error healing party.');
    }
  }
};
