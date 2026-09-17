// src/Commands/Pokemon/catch.js
const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

module.exports = {
  name: 'catch',
  aliases: ['capture'],
  category: 'pokemon',
  exp: 3,
  cool: 4,
  react: '⚔️',
  usage: '.catch <name>',
  description: 'Catch the wild Pokemon currently spawned in this chat.',

  async execute(client, arg, M) {
    try {
      const chatId = String(M.chat.id);
      const userId = String(M.from.id);
      const guess = (arg || '').trim().toLowerCase();

      if (!guess) {
        return client.sendMessage(M.chat.id, 'Usage: `.catch <name>`',
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      const companion = await pkmnManager.getCompanion(userId);
      if (!companion) {
        return client.sendMessage(M.chat.id,
          'Start your journey first: `.pstart`',
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      // get wild spawn
      let wild = client.activePokemon?.get?.(chatId);
      if (!wild) wild = await pkmnManager.getWildSpawn(chatId);

      if (!wild) {
        return client.sendMessage(M.chat.id, 'No wild Pokemon here right now.',
          { reply_to_message_id: M.message_id });
      }

      if (wild.expiresAt && Date.now() > wild.expiresAt) {
        client.activePokemon?.delete?.(chatId);
        await pkmnManager.clearWildSpawn(chatId);
        return client.sendMessage(M.chat.id, 'That wild Pokemon ran away.',
          { reply_to_message_id: M.message_id });
      }

      if (guess !== String(wild.name).toLowerCase()) {
        return client.sendMessage(M.chat.id, 'Wrong name. Try again.',
          { reply_to_message_id: M.message_id });
      }

      // Caught!
      const pokemonData = {
        pid: wild.pid,
        name: wild.name,
        level: wild.level || 1,
        exp: 0,
        hp: wild.hp, attack: wild.attack, defense: wild.defense, speed: wild.speed,
        maxHp: wild.hp, maxAttack: wild.attack, maxDefense: wild.defense, maxSpeed: wild.speed,
        image: wild.image || null,
        types: wild.types || [],
        moves: [],
        rarity: wild.rarity || 'common',
        female: Math.random() < 0.5,
        tag: '0',
        region: 'wild',
        regionalIndex: 0,
        isActive: 0,
      };

      let storedIn = 'party';
      let newId = null;

      const insert = await pkmnManager.addPokemonToParty(userId, pokemonData);
      if (insert?.ok) {
        newId = insert.id;
      } else if (insert?.full) {
        const box = await pkmnManager.addPokemonToPSS(userId, pokemonData);
        storedIn = 'pss';
        newId = box?.id;
      }

      const expEarned = 30 + (wild.level || 1) * 3;
      const coinEarned = 20 + (wild.level || 1) * 2;
      const trainer = await pkmnManager.addTrainerExp(userId, expEarned, client.getLevelFromExp);
      await pkmnManager.addCoins(userId, coinEarned);

      client.activePokemon?.delete?.(chatId);
      await pkmnManager.clearWildSpawn(chatId);

      const place = storedIn === 'party'
        ? `Added to Party (ID *${newId}*)`
        : `Party full — sent to PSS (ID *${newId}*)`;

      const caption =
`*Pokemon Caught*

Name: *${capitalize(wild.name)}*
Level: *${wild.level}*
Rarity: *${(wild.rarity || 'common').toUpperCase()}*

${place}

+${expEarned} EXP · Trainer Lv *${trainer.level}*
+${coinEarned} Coins`;

      if (wild.image) {
        return client.sendPhoto(M.chat.id, wild.image,
          { caption, parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }
      return client.sendMessage(M.chat.id, caption,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
    } catch (err) {
      console.error('catch error:', err);
      return client.sendMessage(M.chat.id, 'Error catching pokemon.',
        { reply_to_message_id: M.message_id });
    }
  }
};
