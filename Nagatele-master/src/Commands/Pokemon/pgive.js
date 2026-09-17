// src/Commands/Pokemon/pgive.js
// Give a Pokemon from your party to another user (with confirm/reject flow).
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

// chatId_targetUserId -> { fromUserId, pokemon, expiresAt }
const pendingGives = new Map();

function key(chatId, targetId) { return `${chatId}_${targetId}`; }

module.exports = {
  name: 'pgive',
  aliases: ['pokemongive'],
  category: 'pokemon',
  exp: 2,
  cool: 4,
  react: '🎁',
  usage: '.pgive <partyIndex> (reply to user) | .pgive confirm | .pgive reject',
  description: 'Give a Pokemon from your party to another user.',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);
      const args = (arg || '').trim().split(/\s+/).filter(Boolean);
      const action = (args[0] || '').toLowerCase();

      // ===== confirm / reject =====
      if (action === 'confirm' || action === 'reject') {
        const k = key(chatId, userId);
        const pending = pendingGives.get(k);
        if (!pending) {
          return client.sendMessage(chatId, 'No pending Pokemon gift for you.',
            { reply_to_message_id: M.message_id });
        }
        if (Date.now() > pending.expiresAt) {
          pendingGives.delete(k);
          return client.sendMessage(chatId, 'The gift offer expired.',
            { reply_to_message_id: M.message_id });
        }

        if (action === 'reject') {
          pendingGives.delete(k);
          return client.sendMessage(chatId,
            `Gift of *${capitalize(pending.pokemon.name)}* rejected.`,
            { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        }

        // confirm
        const ins = await pkmnManager.addPokemonToParty(userId, pending.pokemon);
        let placed = 'Party';
        if (!ins?.ok && ins?.full) {
          await pkmnManager.addPokemonToPSS(userId, pending.pokemon);
          placed = 'PSS';
        }
        pendingGives.delete(k);
        return client.sendMessage(chatId,
          `*${capitalize(pending.pokemon.name)}* received! Stored in *${placed}*.`,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      // ===== initiate give =====
      const replyTo = M.reply_to_message;
      if (!replyTo || !replyTo.from || replyTo.from.is_bot) {
        return client.sendMessage(chatId,
          'Reply to the user you want to give a Pokemon to.',
          { reply_to_message_id: M.message_id });
      }
      const targetId = String(replyTo.from.id);
      if (targetId === userId) {
        return client.sendMessage(chatId, 'You cannot gift yourself.',
          { reply_to_message_id: M.message_id });
      }

      const idx = parseInt(args[0], 10);
      if (!idx || idx < 1) {
        return client.sendMessage(chatId,
          'Usage: reply to user with `.pgive <partyIndex>`',
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      const party = await pkmnManager.listParty(userId);
      if (idx > party.length) {
        return client.sendMessage(chatId, 'Invalid party index.',
          { reply_to_message_id: M.message_id });
      }
      const p = party[idx - 1];

      // remove from sender's party first
      await pkmnManager.deletePartyPokemon(userId, p.id);

      const pokemonData = {
        pid: p.pid, name: p.name, level: p.level, exp: p.exp,
        hp: p.hp, attack: p.attack, defense: p.defense, speed: p.speed,
        maxHp: p.maxHp, maxAttack: p.maxAttack, maxDefense: p.maxDefense, maxSpeed: p.maxSpeed,
        image: p.image, types: p.types, moves: p.moves,
        rarity: p.rarity, female: p.female, tag: p.tag,
        region: p.region, regionalIndex: p.regionalIndex, isActive: 0,
      };

      pendingGives.set(key(chatId, targetId), {
        fromUserId: userId,
        pokemon: pokemonData,
        expiresAt: Date.now() + 60 * 1000, // 60 seconds
      });

      const targetName = replyTo.from.first_name || 'Trainer';
      return client.sendMessage(chatId,
        `*${targetName}*, you are being offered *${capitalize(p.name)}* (Lv ${p.level}).\n\n` +
        `Reply with \`.pgive confirm\` to accept or \`.pgive reject\` to decline.\n` +
        `Offer expires in 60 seconds.`,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('pgive error:', err);
      return client.sendMessage(M.chat.id, 'Error processing gift.');
    }
  }
};
