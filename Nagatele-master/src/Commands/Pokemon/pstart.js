// src/Commands/Pokemon/pstart.js
const axios = require('axios');
const pkmnManager = require('../../Database/pokemonManager');
const { getPokemonStats, capitalize } = require('../../Helpers/pokemonStats');

const REGIONS = {
  kanto:  [1, 4, 7],
  johto:  [152, 155, 158],
  hoenn:  [252, 255, 258],
  sinnoh: [387, 390, 393],
  unova:  [495, 498, 501],
  kalos:  [650, 653, 656],
  alola:  [722, 725, 728],
  galar:  [810, 813, 816],
};

// Per-user temporary region selection (in-memory).
const pendingRegion = new Map();

module.exports = {
  name: 'pstart',
  aliases: ['startjourney', 'journey'],
  category: 'pokemon',
  exp: 3,
  cool: 4,
  react: '🎊',
  usage: '.pstart <region> | .pstart --select <index>',
  description: 'Start your Pokemon journey by choosing a starter.',

  async execute(client, arg, M) {
    try {
      const chatId = M.chat.id;
      const userId = String(M.from.id);

      const companion = await pkmnManager.getCompanion(userId);
      if (companion) {
        return client.sendMessage(chatId,
          `You already started your journey with *${capitalize(companion)}*.`,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
        );
      }

      const args = (arg || '').trim().split(/\s+/).filter(Boolean);

      // No arg — show region list
      if (!args.length) {
        const list = Object.keys(REGIONS).map(r => `• \`${r}\``).join('\n');
        return client.sendMessage(chatId,
          `*Choose a Region*\n\n${list}\n\nExample: \`.pstart kanto\``,
          { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
        );
      }

      // Step 1: select region
      if (REGIONS[args[0].toLowerCase()]) {
        const region = args[0].toLowerCase();
        pendingRegion.set(userId, region);

        let text = `*${capitalize(region)} Starters*\n\n`;
        for (let i = 0; i < REGIONS[region].length; i++) {
          const dex = REGIONS[region][i];
          try {
            const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${dex}`, { timeout: 15000 });
            text += `${i + 1}. *${capitalize(data.name)}*\n`;
          } catch (_) {
            text += `${i + 1}. *#${dex}*\n`;
          }
        }
        text += `\nPick one: \`.pstart --select <number>\``;
        return client.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      // Step 2: --select
      if (args[0] === '--select' || args[0] === 'select') {
        const region = pendingRegion.get(userId);
        if (!region) {
          return client.sendMessage(chatId,
            `First pick a region with \`.pstart <region>\`.`,
            { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
          );
        }
        const starters = REGIONS[region];
        const idx = parseInt(args[1], 10);
        if (!idx || idx < 1 || idx > starters.length) {
          return client.sendMessage(chatId, `Invalid choice. Pick 1 to ${starters.length}.`,
            { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        }
        const dexId = starters[idx - 1];

        const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${dexId}`, { timeout: 15000 });
        const name = data.name;
        const image = data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default || null;
        const types = (data.types || []).map(t => t.type.name);
        const level = 5;
        const stats = await getPokemonStats(dexId, level);

        await pkmnManager.ensureUser(userId);
        await pkmnManager.setCompanion(userId, name);

        const ins = await pkmnManager.addPokemonToParty(userId, {
          pid: dexId, name, level, exp: 0,
          hp: stats.hp, attack: stats.attack, defense: stats.defense, speed: stats.speed,
          maxHp: stats.hp, maxAttack: stats.attack, maxDefense: stats.defense, maxSpeed: stats.speed,
          image, types, moves: [],
          rarity: 'common', female: Math.random() < 0.5, tag: '0',
          region, regionalIndex: idx, isActive: 1,
        });
        if (ins?.ok) await pkmnManager.setActivePokemon(userId, ins.id);
        pendingRegion.delete(userId);

        const caption =
`*Journey Started*

Starter: *${capitalize(name)}*
Region: *${capitalize(region)}*
Level: *${level}*
Type: ${types.join(', ')}

Use \`.party\` to view your team.
Use \`.catch <name>\` to catch wild pokemon.`;

        if (image) {
          return client.sendPhoto(chatId, image, { caption, parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        }
        return client.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
      }

      return client.sendMessage(chatId,
        `Unknown option. Use \`.pstart <region>\` or \`.pstart --select <n>\`.`,
        { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
      );
    } catch (err) {
      console.error('pstart error:', err);
      return client.sendMessage(M.chat.id, 'Error starting journey.');
    }
  }
};
