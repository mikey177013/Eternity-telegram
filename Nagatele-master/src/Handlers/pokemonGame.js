// src/Handlers/pokemonGame.js
// Pokemon spawn handler — self-contained Telegram pokemon system.
const axios = require('axios');
const pkmnManager = require('../Database/pokemonManager');
const { getPokemonStats, capitalize } = require('../Helpers/pokemonStats');

module.exports = async function PokemonGame(client) {
  console.log('Pokemon handler initializing...');

  // ================= STORAGE =================
  client.pokemonSettings ??= new Map();   // chatId -> { enabled, lastSpawn }
  client.activePokemon ??= new Map();     // chatId -> spawn object
  client.pokemonTimers ??= new Map();     // chatId -> interval id
  client.chatHistory ??= new Map();       // chatId -> { sender }

  // ================= LEVEL TABLE =================
  client.levelTable = [];
  for (let i = 1; i <= 100; i++) {
    client.levelTable.push({ level: i, expRequired: Math.floor(50 * Math.pow(i, 1.6)) });
  }

  client.getLevelFromExp = (exp = 0) => {
    exp = Number(exp) || 0;
    let lvl = 1;
    for (const row of client.levelTable) {
      if (exp >= row.expRequired) lvl = row.level;
      else break;
    }
    return lvl;
  };

  client.getNextLevelExp = (exp = 0) => {
    const current = client.getLevelFromExp(exp);
    const next = client.levelTable.find((x) => x.level === current + 1);
    return next ? next.expRequired : null;
  };

  // ================= RARITY =================
  client.rollRarity = () => {
    const roll = Math.random() * 100;
    if (roll >= 99) return 'legendary';
    if (roll >= 93) return 'epic';
    if (roll >= 75) return 'rare';
    return 'common';
  };

  client.rarityRange = (rarity) => {
    const r = {
      common: [1, 650],
      rare: [651, 850],
      epic: [851, 950],
      legendary: [951, 1010],
    };
    return r[rarity] || [1, 650];
  };

  // ================= RANDOM WILD =================
  client.fetchRandomPokemon = async (trainerLevel = 1) => {
    try {
      const rarity = client.rollRarity();
      const [min, max] = client.rarityRange(rarity);
      const pid = Math.floor(Math.random() * (max - min + 1)) + min;

      const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pid}`, { timeout: 15000 });
      const name = data.name;
      const image = data.sprites?.other?.['official-artwork']?.front_default
                 || data.sprites?.front_default || null;
      const types = (data.types || []).map((t) => t.type.name);

      const wildMin = Math.max(1, trainerLevel - 5);
      const wildMax = Math.min(100, trainerLevel + 3);
      const level = Math.floor(Math.random() * (wildMax - wildMin + 1)) + wildMin;

      const stats = await getPokemonStats(pid, level);
      return {
        pid, name, image, types, rarity, level,
        hp: stats.hp, attack: stats.attack, defense: stats.defense, speed: stats.speed,
      };
    } catch (err) {
      console.log('fetchRandomPokemon failed:', err.message);
      return null;
    }
  };

  // ================= SPAWN =================
  client.spawnPokemonInChat = async (chatId) => {
    const id = chatId.toString();
    const settings = client.pokemonSettings.get(id);
    if (!settings?.enabled) return;

    if (client.activePokemon.get(id)) return;
    const dbSpawn = await pkmnManager.getWildSpawn(id);
    if (dbSpawn) {
      client.activePokemon.set(id, dbSpawn);
      return;
    }

    // trainer level scaling
    let trainerLevel = 1;
    const last = client.chatHistory.get(id);
    if (last?.sender) {
      const t = await pkmnManager.getTrainer(String(last.sender));
      trainerLevel = t?.level || 1;
    }

    const poke = await client.fetchRandomPokemon(trainerLevel);
    if (!poke) return;

    const spawn = {
      chatId: id,
      ...poke,
      spawnedAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 1000,
    };

    client.activePokemon.set(id, spawn);
    await pkmnManager.saveWildSpawn(id, spawn);

    const hint = poke.name[0].toUpperCase() + '•'.repeat(Math.max(poke.name.length - 1, 1));

    const caption =
`*A Wild Pokemon Appeared*

Hint: *${hint}*
Rarity: *${poke.rarity.toUpperCase()}*
Level: *${poke.level}*
Type: ${poke.types.join(', ') || 'Unknown'}

Catch with: \`.catch <name>\`
Expires in 8 minutes.`;

    try {
      if (poke.image) {
        await client.sendPhoto(id, poke.image, { caption, parse_mode: 'Markdown' });
      } else {
        await client.sendMessage(id, caption, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      console.log('spawn send fail:', err.message);
    }

    // expire timer
    setTimeout(async () => {
      const active = client.activePokemon.get(id);
      if (active && active.pid === spawn.pid) {
        client.activePokemon.delete(id);
        await pkmnManager.clearWildSpawn(id);
      }
    }, 8 * 60 * 1000);
  };

  // ================= TIMER =================
  client.startPokemonSpawner = (chatId) => {
    const id = chatId.toString();
    client.stopPokemonSpawner(chatId);
    setTimeout(() => client.spawnPokemonInChat(chatId), 3000);
    const timer = setInterval(() => client.spawnPokemonInChat(chatId), 20 * 60 * 1000);
    client.pokemonTimers.set(id, timer);
  };

  client.stopPokemonSpawner = (chatId) => {
    const id = chatId.toString();
    const t = client.pokemonTimers.get(id);
    if (t) clearInterval(t);
    client.pokemonTimers.delete(id);
  };

  // ================= TOGGLE =================
  client.togglePokemonGame = async (chatId, enabled = true) => {
    const id = chatId.toString();
    client.pokemonSettings.set(id, { enabled, lastSpawn: Date.now() });
    if (enabled) client.startPokemonSpawner(chatId);
    else client.stopPokemonSpawner(chatId);
  };

  // ================= MESSAGE TRACK =================
  // Hook into incoming messages to capture last chatter (trainer level scaling)
  if (client.bot && typeof client.bot.on === 'function' && !client._pokemonTracker) {
    client._pokemonTracker = true;
    client.bot.on('message', (msg) => {
      try {
        if (!msg?.chat?.id || !msg?.from?.id) return;
        client.chatHistory.set(String(msg.chat.id), { sender: msg.from.id });
      } catch (_) { /* noop */ }
    });
  }

  console.log('Pokemon handler loaded');
};
