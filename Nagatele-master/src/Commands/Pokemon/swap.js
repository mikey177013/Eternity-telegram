// src/Commands/Pokemon/swap.js
// Swap or transfer Pokemon between party and PSS.
// Usage:
//   .swap p<index>            -> move party -> PSS
//   .swap pc<index>           -> move PSS -> party
//   .swap p<i1> p<i2>         -> swap inside party
//   .swap pc<i1> pc<i2>       -> swap inside PSS
//   .swap p<i> pc<j>          -> swap party<->PSS
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

function parseToken(t) {
  if (!t) return null;
  const m = String(t).toLowerCase().match(/^(p|pc)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], index: parseInt(m[2], 10) - 1 };
}

module.exports = {
  name: 'swap',
  aliases: ['swapmon'],
  category: 'pokemon',
  exp: 2,
  cool: 4,
  react: '🔄',
  usage: '.swap p<i> | pc<i> | p<i> p<j> | p<i> pc<j>',
  description: 'Move or swap Pokemon between party and PSS.',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);

      const args = (arg || '').trim().split(/\s+/).filter(Boolean);
      if (!args.length) {
        return client.sendMessage(chatId,
          'Usage:\n`.swap p<i>` move party→PSS\n`.swap pc<i>` move PSS→party\n`.swap p<i> p<j>` swap in party\n`.swap p<i> pc<j>` swap between',
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      const party = await pkmnManager.listParty(userId);
      const pss   = await pkmnManager.listPSS(userId);

      // ============ SINGLE TOKEN: transfer ============
      if (args.length === 1) {
        const t = parseToken(args[0]);
        if (!t) return client.sendMessage(chatId, 'Bad token. Use p<i> or pc<i>.',
          { reply_to_message_id: M.message_id });

        if (t.prefix === 'p') {
          if (t.index < 0 || t.index >= party.length)
            return client.sendMessage(chatId, 'Invalid party index.', { reply_to_message_id: M.message_id });
          const p = party[t.index];
          await pkmnManager.deletePartyPokemon(userId, p.id);
          await pkmnManager.addPokemonToPSS(userId, p);
          return client.sendMessage(chatId,
            `Moved *${capitalize(p.name)}* from Party → PSS.`,
            { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        }

        // pc<i>: PSS -> party
        if (t.index < 0 || t.index >= pss.length)
          return client.sendMessage(chatId, 'Invalid PSS index.', { reply_to_message_id: M.message_id });
        if (party.length >= 6)
          return client.sendMessage(chatId, 'Party is full. Move one out first.', { reply_to_message_id: M.message_id });
        const p = pss[t.index];
        await pkmnManager.deletePSSPokemon(userId, p.id);
        await pkmnManager.addPokemonToParty(userId, p);
        return client.sendMessage(chatId,
          `Moved *${capitalize(p.name)}* from PSS → Party.`,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      // ============ TWO TOKENS: swap ============
      if (args.length >= 2) {
        const a = parseToken(args[0]);
        const b = parseToken(args[1]);
        if (!a || !b) return client.sendMessage(chatId, 'Bad tokens.', { reply_to_message_id: M.message_id });

        // p <-> p (swap stays in party — only reordering matters when displayed)
        if (a.prefix === 'p' && b.prefix === 'p') {
          return client.sendMessage(chatId,
            'Party order is auto-sorted. Use `.setactive <id>` to change active pokemon.',
            { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        }

        if (a.prefix === 'pc' && b.prefix === 'pc') {
          return client.sendMessage(chatId,
            'PSS swap not needed — entries are stored by ID.',
            { reply_to_message_id: M.message_id });
        }

        // mixed: p<->pc
        const pIdx  = a.prefix === 'p'  ? a.index : b.index;
        const pcIdx = a.prefix === 'pc' ? a.index : b.index;

        if (pIdx < 0 || pIdx >= party.length)
          return client.sendMessage(chatId, 'Invalid party index.', { reply_to_message_id: M.message_id });
        if (pcIdx < 0 || pcIdx >= pss.length)
          return client.sendMessage(chatId, 'Invalid PSS index.', { reply_to_message_id: M.message_id });

        const partyMon = party[pIdx];
        const pssMon   = pss[pcIdx];

        await pkmnManager.deletePartyPokemon(userId, partyMon.id);
        await pkmnManager.deletePSSPokemon(userId, pssMon.id);
        await pkmnManager.addPokemonToParty(userId, pssMon);
        await pkmnManager.addPokemonToPSS(userId, partyMon);

        return client.sendMessage(chatId,
          `Swapped *${capitalize(partyMon.name)}* (Party) ↔ *${capitalize(pssMon.name)}* (PSS).`,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }
    } catch (err) {
      console.error('swap error:', err);
      return client.sendMessage(M.chat.id, 'Error swapping pokemon.');
    }
  }
};
