// src/Commands/Pokemon/move.js
// Choose a move during an active Pokemon battle.
// When both players have chosen, the turn is auto-processed via battleCore.

const battleCore = require('./battlecore');
const { capitalize } = require('../../Helpers/pokemonStats');

function escapeMd(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/([_*`\[\]])/g, '\\$1');
}

module.exports = {
    name: 'move',
    aliases: ['mv', 'attack'],
    category: 'pokemon',
    exp: 2,
    cool: 3,
    react: '🎯',
    usage: '.move <number|name>',
    description: 'Pick your move during an active Pokemon battle.',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const userId = String(M.from.id);
            const choice = String(arg || '').trim();

            client.pokemonBattleResponse ??= new Map();
            const battle = client.pokemonBattleResponse.get(String(chatId));
            if (!battle) {
                return client.sendMessage(chatId,
                    '⚠️ No active battle in this chat.',
                    { reply_to_message_id: M.message_id });
            }

            if (![battle.player1.userId, battle.player2.userId].includes(userId)) {
                return client.sendMessage(chatId,
                    '🚫 You are not part of this battle.',
                    { reply_to_message_id: M.message_id });
            }

            const me = battle.player1.userId === userId ? battle.player1 : battle.player2;

            if (me.move) {
                return client.sendMessage(chatId,
                    `⏳ You already chose *${escapeMd(me.move.name || me.move)}*. Waiting for the opponent…`,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // Resolve move
            const moves = me.activePokemon.moves || [];
            let picked = null;

            if (/^\d+$/.test(choice)) {
                const idx = parseInt(choice, 10) - 1;
                if (moves.length && idx >= 0 && idx < moves.length) {
                    const m = moves[idx];
                    picked = typeof m === 'string'
                        ? { name: m, power: 50 }
                        : { name: m.name || 'Tackle', power: m.power || 50 };
                } else if (!moves.length && idx === 0) {
                    picked = { name: 'Tackle', power: 40 };
                }
            } else if (choice) {
                // by name
                const lc = choice.toLowerCase();
                const found = moves.find((m) => {
                    const name = typeof m === 'string' ? m : (m.name || '');
                    return String(name).toLowerCase() === lc;
                });
                if (found) {
                    picked = typeof found === 'string'
                        ? { name: found, power: 50 }
                        : { name: found.name || 'Tackle', power: found.power || 50 };
                } else if (lc === 'tackle') {
                    picked = { name: 'Tackle', power: 40 };
                }
            }

            if (!picked) {
                let text = `❌ Invalid move. Your available moves:\n\n`;
                if (!moves.length) {
                    text += `1. Tackle (Power 40)\n`;
                } else {
                    moves.forEach((m, i) => {
                        const name = typeof m === 'string' ? m : (m.name || 'Tackle');
                        const power = (typeof m === 'object' && m.power) ? m.power : 50;
                        text += `${i + 1}. *${capitalize(name)}* (Power ${power})\n`;
                    });
                }
                text += `\nUse \`.move <number|name>\``;
                return client.sendMessage(chatId, text,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // Save chosen move
            me.move = picked;
            me.ready = true;
            client.pokemonBattleResponse.set(String(chatId), battle);

            await client.sendMessage(chatId,
                `✅ *${escapeMd(me.name)}* chose *${capitalize(picked.name)}*.`,
                { parse_mode: 'Markdown' });

            // If both ready → process turn
            if (battle.player1.ready && battle.player2.ready) {
                await battleCore.processTurn(client, chatId);
            }
        } catch (err) {
            console.error('move command error:', err);
            try {
                await client.sendMessage(M.chat.id, `❌ Move error: ${err.message || 'Unknown'}`);
            } catch (_) {}
        }
    },
};
