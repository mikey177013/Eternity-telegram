// src/Commands/Pokemon/battle.js
// Battle controller — fight / switch / forfeit / status.
// Works together with challenge.js and battlecore.js.

const pkmnManager = require('../../Database/pokemonManager');
const battleCore = require('./battlecore');
const { capitalize } = require('../../Helpers/pokemonStats');

function escapeMd(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/([_*`\[\]])/g, '\\$1');
}

module.exports = {
    name: 'battle',
    aliases: ['fight'],
    category: 'pokemon',
    exp: 3,
    cool: 4,
    react: '⚔️',
    usage: '.battle <fight|switch|status|forfeit>',
    description: 'Control an ongoing Pokemon battle (fight / switch / status / forfeit).',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const userId = String(M.from.id);
            const args = String(arg || '').trim().split(/\s+/).filter(Boolean);
            const sub = (args[0] || '').toLowerCase();

            client.pokemonBattleResponse ??= new Map();
            client.pokemonBattlePlayerMap ??= new Map();

            const battle = client.pokemonBattleResponse.get(String(chatId));
            if (!battle) {
                return client.sendMessage(chatId,
                    '⚠️ There is no active battle in this chat.\nStart one with `.challenge @user`.',
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // Only the two combatants can use the battle commands
            if (![battle.player1.userId, battle.player2.userId].includes(userId)) {
                return client.sendMessage(chatId,
                    "🚫 You are not part of this battle.",
                    { reply_to_message_id: M.message_id });
            }

            const me = battle.player1.userId === userId ? battle.player1 : battle.player2;
            const opp = battle.player1.userId === userId ? battle.player2 : battle.player1;

            // ============================================
            // STATUS
            // ============================================
            if (!sub || sub === 'status') {
                const a = me.activePokemon;
                const b = opp.activePokemon;
                const text =
`📊 *Battle Status* — Turn ${battle.turn}

👤 *${escapeMd(me.name)}* (You)
   ${capitalize(a.name)} — HP ${a.currentHp}/${a.maxHp} · Lv ${a.level}
   Move chosen: ${me.move ? '✅ ' + (me.move.name || me.move) : '❌ not yet'}

🆚

👤 *${escapeMd(opp.name)}*
   ${capitalize(b.name)} — HP ${b.currentHp}/${b.maxHp} · Lv ${b.level}
   Move chosen: ${opp.move ? '✅' : '❌'}

💡 Use \`.move <name|index>\` to choose your attack.`;
                return client.sendMessage(chatId, text,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // ============================================
            // FIGHT — show moves for active pokemon
            // ============================================
            if (sub === 'fight') {
                const moves = me.activePokemon.moves || [];
                let text = `⚔️ *${capitalize(me.activePokemon.name)}*'s moves:\n\n`;
                if (!moves.length) {
                    text += `1. Tackle (Power 40)\n\nUse \`.move 1\` to attack.`;
                } else {
                    moves.forEach((m, i) => {
                        const name = typeof m === 'string' ? m : (m.name || 'Tackle');
                        const power = typeof m === 'object' && m.power ? m.power : 40;
                        text += `${i + 1}. *${capitalize(name)}* (Power ${power})\n`;
                    });
                    text += `\nUse \`.move <number>\` to attack.`;
                }
                return client.sendMessage(chatId, text,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // ============================================
            // SWITCH — swap active pokemon mid-battle
            // ============================================
            if (sub === 'switch') {
                const idx = parseInt(args[1], 10);
                if (!idx) {
                    let text = `🔁 *Your Party*\n\n`;
                    me.party.forEach((p, i) => {
                        const isAct = p.id === me.activePokemon.id ? ' (active)' : '';
                        const hp = p.currentHp ?? p.hp;
                        text += `${i + 1}. *${capitalize(p.name)}* — HP ${hp}/${p.maxHp}${isAct}\n`;
                    });
                    text += `\nUse \`.battle switch <number>\` to switch.`;
                    return client.sendMessage(chatId, text,
                        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
                }

                const target = me.party[idx - 1];
                if (!target) {
                    return client.sendMessage(chatId, '❌ Invalid party slot.',
                        { reply_to_message_id: M.message_id });
                }
                if (target.id === me.activePokemon.id) {
                    return client.sendMessage(chatId, '⚠️ That Pokémon is already active.',
                        { reply_to_message_id: M.message_id });
                }
                const hp = target.currentHp ?? target.hp;
                if (hp <= 0) {
                    return client.sendMessage(chatId, `❌ *${capitalize(target.name)}* has fainted.`,
                        { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
                }
                // Persist current HP back to the party array before switching
                const meActiveInParty = me.party.find((p) => p.id === me.activePokemon.id);
                if (meActiveInParty) meActiveInParty.currentHp = me.activePokemon.currentHp;
                me.activePokemon = { ...target, currentHp: hp };
                client.pokemonBattleResponse.set(String(chatId), battle);

                return client.sendMessage(chatId,
                    `🔁 *${escapeMd(me.name)}* switched to *${capitalize(target.name)}*!`,
                    { parse_mode: 'Markdown' });
            }

            // ============================================
            // FORFEIT
            // ============================================
            if (sub === 'forfeit' || sub === 'surrender' || sub === 'quit') {
                const winner = opp;
                const loser = me;
                try {
                    await pkmnManager.addWin(winner.userId);
                    await pkmnManager.addLoss(loser.userId);
                    await pkmnManager.addCoins(winner.userId, 50);
                } catch (_) {}
                client.pokemonBattleResponse.delete(String(chatId));
                client.pokemonBattlePlayerMap.delete(battle.player1.userId);
                client.pokemonBattlePlayerMap.delete(battle.player2.userId);
                return client.sendMessage(chatId,
                    `🏳️ *${escapeMd(loser.name)}* forfeited!\n` +
                    `🏆 *${escapeMd(winner.name)}* wins by default (+50 coins).`,
                    { parse_mode: 'Markdown' });
            }

            // Default
            return client.sendMessage(chatId,
                `Usage:\n` +
                `• \`.battle status\` — show battle state\n` +
                `• \`.battle fight\` — list moves\n` +
                `• \`.move <name|index>\` — choose a move\n` +
                `• \`.battle switch <id>\` — switch Pokémon\n` +
                `• \`.battle forfeit\` — give up`,
                { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
        } catch (err) {
            console.error('battle command error:', err);
            try {
                await client.sendMessage(M.chat.id, `❌ Battle error: ${err.message || 'Unknown'}`);
            } catch (_) {}
        }
    },
};
