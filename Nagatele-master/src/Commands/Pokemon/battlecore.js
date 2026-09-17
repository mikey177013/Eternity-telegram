// src/Commands/Pokemon/battlecore.js
// Pure processing logic — resolve one turn when both players have chosen moves.
// Exports processTurn(client, chatId)

const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

// Pokemon-style type chart (simplified, primary type only)
const TYPE_CHART = {
    normal:   { strong: [],            weak: ['rock','steel'],     immune: ['ghost'] },
    fire:     { strong: ['grass','ice','bug','steel'], weak: ['fire','water','rock','dragon'], immune: [] },
    water:    { strong: ['fire','ground','rock'], weak: ['water','grass','dragon'], immune: [] },
    electric: { strong: ['water','flying'], weak: ['electric','grass','dragon'], immune: ['ground'] },
    grass:    { strong: ['water','ground','rock'], weak: ['fire','grass','poison','flying','bug','dragon','steel'], immune: [] },
    ice:      { strong: ['grass','ground','flying','dragon'], weak: ['fire','water','ice','steel'], immune: [] },
    fighting: { strong: ['normal','ice','rock','dark','steel'], weak: ['poison','flying','psychic','bug','fairy'], immune: ['ghost'] },
    poison:   { strong: ['grass','fairy'], weak: ['poison','ground','rock','ghost'], immune: ['steel'] },
    ground:   { strong: ['fire','electric','poison','rock','steel'], weak: ['grass','bug'], immune: ['flying'] },
    flying:   { strong: ['grass','fighting','bug'], weak: ['electric','rock','steel'], immune: [] },
    psychic:  { strong: ['fighting','poison'], weak: ['psychic','steel'], immune: ['dark'] },
    bug:      { strong: ['grass','psychic','dark'], weak: ['fire','fighting','poison','flying','ghost','steel','fairy'], immune: [] },
    rock:     { strong: ['fire','ice','flying','bug'], weak: ['fighting','ground','steel'], immune: [] },
    ghost:    { strong: ['psychic','ghost'], weak: ['dark'], immune: ['normal'] },
    dragon:   { strong: ['dragon'], weak: ['steel'], immune: ['fairy'] },
    dark:     { strong: ['psychic','ghost'], weak: ['fighting','dark','fairy'], immune: [] },
    steel:    { strong: ['ice','rock','fairy'], weak: ['fire','water','electric','steel'], immune: [] },
    fairy:    { strong: ['fighting','dragon','dark'], weak: ['fire','poison','steel'], immune: [] },
};

function typeMultiplier(attackerType, defenderType) {
    if (!attackerType) return 1;
    const a = String(attackerType).toLowerCase();
    const d = String(defenderType || '').toLowerCase();
    const entry = TYPE_CHART[a];
    if (!entry) return 1;
    if (entry.immune.includes(d)) return 0;
    if (entry.strong.includes(d)) return 1.5;
    if (entry.weak.includes(d)) return 0.75;
    return 1;
}

function calcDamage(attacker, defender, move) {
    const atk = Math.max(1, attacker.attack || 10);
    const def = Math.max(1, defender.defense || 10);
    const power = Math.max(20, Number(move.power) || 40);
    const lvl = Math.max(1, attacker.level || 1);

    const base = ((2 * lvl) / 5 + 2) * power * (atk / def) / 50 + 2;
    const aType = (attacker.types && attacker.types[0]) || '';
    const dType = (defender.types && defender.types[0]) || '';
    const mult = typeMultiplier(aType, dType);
    const crit = Math.random() < 0.0625 ? 1.5 : 1;
    const variance = 0.85 + Math.random() * 0.15;
    const dmg = Math.max(1, Math.floor(base * mult * crit * variance));
    return { dmg, typeMult: mult, crit: crit > 1 };
}

function escapeMd(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/([_*`\[\]])/g, '\\$1');
}

function defaultMove(mon) {
    if (Array.isArray(mon.moves) && mon.moves.length) {
        const m = mon.moves[0];
        if (typeof m === 'string') return { name: m, power: 40 };
        return { name: m.name || 'Tackle', power: m.power || 40 };
    }
    return { name: 'Tackle', power: 40 };
}

module.exports = {
    /**
     * Resolve one full turn. Both players must have a `move` set in
     * client.pokemonBattleResponse.get(chatId).playerN.move
     */
    async processTurn(client, chatId) {
        try {
            const key = String(chatId);
            const battle = client.pokemonBattleResponse?.get(key);
            if (!battle) return;

            const p1 = battle.player1;
            const p2 = battle.player2;

            const m1 = p1.move ? { name: p1.move.name || p1.move, power: p1.move.power || 50 } : defaultMove(p1.activePokemon);
            const m2 = p2.move ? { name: p2.move.name || p2.move, power: p2.move.power || 50 } : defaultMove(p2.activePokemon);

            // Decide order by speed
            let first, second;
            if ((p1.activePokemon.speed || 0) > (p2.activePokemon.speed || 0)) {
                first = { player: p1, move: m1, other: p2 };
                second = { player: p2, move: m2, other: p1 };
            } else if ((p2.activePokemon.speed || 0) > (p1.activePokemon.speed || 0)) {
                first = { player: p2, move: m2, other: p1 };
                second = { player: p1, move: m1, other: p2 };
            } else {
                if (Math.random() < 0.5) {
                    first = { player: p1, move: m1, other: p2 };
                    second = { player: p2, move: m2, other: p1 };
                } else {
                    first = { player: p2, move: m2, other: p1 };
                    second = { player: p1, move: m1, other: p2 };
                }
            }

            const messages = [];
            messages.push(`🎯 *Turn ${battle.turn}*`);

            // First attack
            const r1 = calcDamage(first.player.activePokemon, second.player.activePokemon, first.move);
            second.player.activePokemon.currentHp = Math.max(0, (second.player.activePokemon.currentHp ?? second.player.activePokemon.hp) - r1.dmg);

            messages.push(
                `👊 *${escapeMd(first.player.name)}*'s *${capitalize(first.player.activePokemon.name)}* used *${capitalize(first.move.name)}*!\n` +
                `➡️ Damage: *${r1.dmg}*${r1.crit ? ' (CRITICAL!)' : ''}` +
                (r1.typeMult > 1 ? `\n⚡ It's super effective!` : (r1.typeMult === 0 ? `\n🚫 It had no effect…` : (r1.typeMult < 1 ? `\n🟦 Not very effective…` : ''))) +
                `\n❤️ ${capitalize(second.player.activePokemon.name)}: ${second.player.activePokemon.currentHp}/${second.player.activePokemon.maxHp}`
            );

            let winner = null;
            if (second.player.activePokemon.currentHp <= 0) {
                messages.push(`💀 *${capitalize(second.player.activePokemon.name)}* fainted!`);
                // Try auto-switch — find next alive party member
                const next = (second.player.party || []).find(
                    (p) => p.id !== second.player.activePokemon.id && (p.currentHp ?? p.hp) > 0
                );
                if (next) {
                    second.player.activePokemon = { ...next, currentHp: next.currentHp ?? next.hp };
                    messages.push(`🔁 *${escapeMd(second.player.name)}* sent out *${capitalize(next.name)}*!`);
                } else {
                    winner = first.player;
                }
            } else {
                // Counter attack
                const r2 = calcDamage(second.player.activePokemon, first.player.activePokemon, second.move);
                first.player.activePokemon.currentHp = Math.max(0, (first.player.activePokemon.currentHp ?? first.player.activePokemon.hp) - r2.dmg);

                messages.push(
                    `🔁 *Counter!*\n` +
                    `👊 *${escapeMd(second.player.name)}*'s *${capitalize(second.player.activePokemon.name)}* used *${capitalize(second.move.name)}*!\n` +
                    `➡️ Damage: *${r2.dmg}*${r2.crit ? ' (CRITICAL!)' : ''}` +
                    (r2.typeMult > 1 ? `\n⚡ It's super effective!` : (r2.typeMult === 0 ? `\n🚫 It had no effect…` : (r2.typeMult < 1 ? `\n🟦 Not very effective…` : ''))) +
                    `\n❤️ ${capitalize(first.player.activePokemon.name)}: ${first.player.activePokemon.currentHp}/${first.player.activePokemon.maxHp}`
                );

                if (first.player.activePokemon.currentHp <= 0) {
                    messages.push(`💀 *${capitalize(first.player.activePokemon.name)}* fainted!`);
                    const next = (first.player.party || []).find(
                        (p) => p.id !== first.player.activePokemon.id && (p.currentHp ?? p.hp) > 0
                    );
                    if (next) {
                        first.player.activePokemon = { ...next, currentHp: next.currentHp ?? next.hp };
                        messages.push(`🔁 *${escapeMd(first.player.name)}* sent out *${capitalize(next.name)}*!`);
                    } else {
                        winner = second.player;
                    }
                }
            }

            // Clear chosen moves for next turn
            p1.move = '';
            p2.move = '';
            p1.ready = false;
            p2.ready = false;
            battle.turn = (battle.turn || 1) + 1;
            battle.turnStartedAt = Date.now();

            // Send aggregated turn report
            await client.sendMessage(chatId, messages.join('\n\n'), { parse_mode: 'Markdown' });

            // ===== If there's a winner, finalise =====
            if (winner) {
                const loser = winner.userId === p1.userId ? p2 : p1;
                // Persist HP back to DB for surviving Pokemon
                try {
                    await pkmnManager.updatePokemon(winner.userId, winner.activePokemon.id, {
                        hp: winner.activePokemon.currentHp,
                    });
                    await pkmnManager.updatePokemon(loser.userId, loser.activePokemon.id, {
                        hp: 0,
                    });
                } catch (_) {}

                // Award trainer EXP / wins
                const expGain = 40 + Math.floor(Math.random() * 30);
                try {
                    await pkmnManager.addTrainerExp(winner.userId, expGain, client.getLevelFromExp);
                    await pkmnManager.addWin(winner.userId);
                    await pkmnManager.addLoss(loser.userId);
                    await pkmnManager.addCoins(winner.userId, 100);
                } catch (_) {}

                await client.sendMessage(chatId,
                    `🏆 *${escapeMd(winner.name)}* wins the battle!\n\n` +
                    `*${capitalize(winner.activePokemon.name)}* gained *+${expGain} EXP* and *+100 coins*.`,
                    { parse_mode: 'Markdown' }
                );

                // Cleanup
                client.pokemonBattleResponse.delete(String(chatId));
                client.pokemonBattlePlayerMap.delete(p1.userId);
                client.pokemonBattlePlayerMap.delete(p2.userId);
                return;
            }

            // No winner → prompt for next move
            await client.sendMessage(chatId,
                `🔜 *Turn ${battle.turn}* — both trainers, choose your move with \`.move <name|index>\`.\n` +
                `Use \`.battle status\` to see current state.`,
                { parse_mode: 'Markdown' }
            );

            // Save state back
            client.pokemonBattleResponse.set(String(chatId), battle);
        } catch (err) {
            console.error('battlecore.processTurn error:', err);
        }
    },
};
