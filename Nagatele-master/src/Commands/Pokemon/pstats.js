// src/Commands/Pokemon/pstats.js
const pkmnManager = require('../../Database/pokemonManager');

module.exports = {
  name: 'pstats',
  aliases: ['trainerstats'],
  category: 'pokemon',
  exp: 1,
  cool: 3,
  react: '📊',
  usage: '.pstats',
  description: 'Show your trainer stats (level, exp, wins).',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);

      await pkmnManager.ensureUser(userId);
      const t = await pkmnManager.getTrainer(userId) || {};
      const exp = t.exp || 0;
      const level = client.getLevelFromExp ? client.getLevelFromExp(exp) : (t.level || 1);
      const next = client.getNextLevelExp ? client.getNextLevelExp(exp) : null;

      const text =
`*Trainer Stats*

Level: *${level}*
EXP: *${exp}*${next !== null ? ` / ${next}` : ''}
Wins: *${t.wins || 0}*
Losses: *${t.losses || 0}*
Coins: *${t.coins || 0}*`;

      return client.sendMessage(chatId, text,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('pstats error:', err);
      return client.sendMessage(M.chat.id, 'Error.');
    }
  }
};
