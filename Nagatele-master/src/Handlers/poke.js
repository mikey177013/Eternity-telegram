// src/Handlers/poke.js
// Pokemon wild spawn handler — attaches togglePokemonGame, spawn loop and
// helpers to the client. This is what `.enable --wild` / `.disable --wild`
// rely on.

const axios = require('axios');
const pkmnManager = require('../Database/pokemonManager');
const { getPokemonStats, capitalize } = require('../Helpers/pokemonStats');

module.exports = async function PokemonHandler(client) {
    console.log('🔄 PokemonHandler initializing...');

    // ============== STORAGE ==============
    client.pokemonSettings ??= new Map();   // chatId -> { enabled, lastSpawn }
    client.activePokemon   ??= new Map();   // chatId -> wild spawn cache
    client.pokemonTimers   ??= new Map();   // chatId -> intervalId

    // ============== HELPERS ==============
    // Simple level-from-exp curve (used by addTrainerExp)
    client.getLevelFromExp = (exp) => {
        const e = Number(exp) || 0;
        // Level grows ~ sqrt(exp / 50). Capped at 100.
        return Math.min(100, Math.max(1, Math.floor(Math.sqrt(e / 50)) + 1));
    };

    // Rarity weights for wild spawns
    const RARITIES = [
        { name: 'common',    weight: 60, minLv: 3,  maxLv: 12 },
        { name: 'uncommon',  weight: 25, minLv: 8,  maxLv: 22 },
        { name: 'rare',      weight: 10, minLv: 18, maxLv: 35 },
        { name: 'epic',      weight: 4,  minLv: 30, maxLv: 50 },
        { name: 'legendary', weight: 1,  minLv: 45, maxLv: 70 },
    ];

    function pickRarity() {
        const total = RARITIES.reduce((a, b) => a + b.weight, 0);
        let r = Math.random() * total;
        for (const t of RARITIES) {
            if ((r -= t.weight) <= 0) return t;
        }
        return RARITIES[0];
    }

    // Random Pokedex id (Gen 1 – Gen 8, 1..898)
    function randomDexId() {
        return Math.floor(Math.random() * 898) + 1;
    }

    // ============== FETCH A RANDOM WILD ==============
    client.fetchRandomWildPokemon = async () => {
        try {
            const dexId = randomDexId();
            const { data } = await axios.get(
                `https://pokeapi.co/api/v2/pokemon/${dexId}`,
                { timeout: 15000 }
            );

            const rarity = pickRarity();
            const level = Math.floor(
                Math.random() * (rarity.maxLv - rarity.minLv + 1)
            ) + rarity.minLv;

            const stats = await getPokemonStats(dexId, level);
            const image =
                data.sprites?.other?.['official-artwork']?.front_default ||
                data.sprites?.front_default ||
                null;
            const types = (data.types || []).map(t => t.type.name);

            return {
                pid: dexId,
                name: data.name,
                rarity: rarity.name,
                level,
                hp: stats.hp,
                attack: stats.attack,
                defense: stats.defense,
                speed: stats.speed,
                image,
                types,
                spawnedAt: Date.now(),
                expiresAt: Date.now() + 8 * 60 * 1000, // 8 min
            };
        } catch (err) {
            console.log('fetchRandomWildPokemon failed:', err.message);
            return null;
        }
    };

    // ============== SPAWN IN CHAT ==============
    client.spawnPokemonInChat = async (chatId) => {
        const cfg = client.pokemonSettings.get(String(chatId));
        if (!cfg?.enabled) return;

        const wild = await client.fetchRandomWildPokemon();
        if (!wild) return;

        // Store in memory + DB for persistence
        client.activePokemon.set(String(chatId), wild);
        try { await pkmnManager.saveWildSpawn(String(chatId), wild); } catch (_) {}

        const rarityEmoji = {
            common: '🟢',
            uncommon: '🔵',
            rare: '🟣',
            epic: '🟠',
            legendary: '🟡',
        }[wild.rarity] || '⚪';

        const caption =
`🌿 *A wild Pokemon appeared!* 🌿

${rarityEmoji} *Rarity:* ${wild.rarity.toUpperCase()}
⭐ *Level:* ${wild.level}
🧬 *Type:* ${(wild.types || []).join(', ') || 'Unknown'}

📝 Type \`.catch <name>\` to catch it!
⏰ It will run away in *8 minutes*.`;

        try {
            if (wild.image) {
                await client.sendPhoto(chatId, wild.image, {
                    caption,
                    parse_mode: 'Markdown',
                });
            } else {
                await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
            }
        } catch (e) {
            console.log('Pokemon spawn send error:', e.message);
            try {
                await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
            } catch (_) {}
        }

        // Auto despawn
        setTimeout(async () => {
            const current = client.activePokemon.get(String(chatId));
            if (current && current.spawnedAt === wild.spawnedAt) {
                client.activePokemon.delete(String(chatId));
                try { await pkmnManager.clearWildSpawn(String(chatId)); } catch (_) {}
            }
        }, 8 * 60 * 1000);
    };

    // ============== TIMER LOOP ==============
    client.startPokemonSpawner = (chatId) => {
        const id = String(chatId);
        client.stopPokemonSpawner(chatId);

        // First spawn after 5s, then every 20 min
        setTimeout(() => client.spawnPokemonInChat(chatId), 5000);
        const t = setInterval(
            () => client.spawnPokemonInChat(chatId),
            20 * 60 * 1000
        );
        client.pokemonTimers.set(id, t);
    };

    client.stopPokemonSpawner = (chatId) => {
        const id = String(chatId);
        const t = client.pokemonTimers.get(id);
        if (t) clearInterval(t);
        client.pokemonTimers.delete(id);
    };

    // ============== ENABLE / DISABLE ==============
    client.togglePokemonGame = async (chatId, enabled = true) => {
        const id = String(chatId);
        client.pokemonSettings.set(id, {
            enabled: !!enabled,
            lastSpawn: Date.now(),
        });

        if (enabled) {
            client.startPokemonSpawner(chatId);
        } else {
            client.stopPokemonSpawner(chatId);
            client.activePokemon.delete(id);
            try { await pkmnManager.clearWildSpawn(id); } catch (_) {}
        }
        return true;
    };

    // ============== STATUS HELPERS ==============
    client.getPokemonGameStatus = (chatId) =>
        client.pokemonSettings.get(String(chatId)) || { enabled: false };

    console.log('✅ PokemonHandler loaded (wild spawn + .enable --wild)');
};
