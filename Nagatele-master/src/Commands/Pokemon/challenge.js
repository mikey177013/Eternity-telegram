// src/Commands/Pokemon/challenge.js
// Challenge another trainer to a Pokemon battle (Telegram version)
// Usage:
//   .challenge (reply to user)            -> issue a challenge
//   .challenge @username                  -> issue a challenge
//   .challenge <user_id>                  -> issue a challenge
//   .challenge --accept | --a             -> accept incoming challenge
//   .challenge --reject | --r             -> reject incoming challenge
//   .challenge --cancel | --c             -> cancel your own challenge

const pkmnManager = require('../../Database/pokemonManager');
const { capitalize } = require('../../Helpers/pokemonStats');

function escapeMd(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/([_*`\[\]])/g, '\\$1');
}

function getMention(user) {
    if (!user) return 'Trainer';
    const name = user.first_name || user.username || `User_${user.id}`;
    return escapeMd(name);
}

async function resolveTarget(client, M, args) {
    // 1. Reply target
    if (M.reply_to_message?.from) {
        const r = M.reply_to_message.from;
        if (r.is_bot) return { error: '🤖 You cannot challenge a bot.' };
        return {
            id: String(r.id),
            name: r.first_name || r.username || `User_${r.id}`,
        };
    }
    // 2. text_mention entity (user tap-mention)
    if (Array.isArray(M.entities)) {
        for (const e of M.entities) {
            if (e.type === 'text_mention' && e.user) {
                return {
                    id: String(e.user.id),
                    name: e.user.first_name || `User_${e.user.id}`,
                };
            }
        }
    }
    // 3. @username from active member cache
    const candidate = args.find((a) => /^@/.test(a));
    if (candidate) {
        const uname = candidate.slice(1).toLowerCase();
        const cache = client.handler?.activeMembers?.get(String(M.chat.id));
        if (cache) {
            for (const info of cache.values()) {
                if (info.username && info.username.toLowerCase() === uname) {
                    return { id: String(info.id), name: info.first_name || uname };
                }
            }
        }
        return { error: `❌ Couldn't find @${uname} in this chat. Have them send a message first.` };
    }
    // 4. numeric ID
    const numeric = args.find((a) => /^\d{4,}$/.test(a));
    if (numeric) {
        try {
            const member = await client.bot.getChatMember(M.chat.id, numeric);
            return { id: String(numeric), name: member?.user?.first_name || `User_${numeric}` };
        } catch (_) {
            return { id: String(numeric), name: `User_${numeric}` };
        }
    }
    return null;
}

module.exports = {
    name: 'challenge',
    aliases: ['ch'],
    category: 'pokemon',
    exp: 5,
    cool: 5,
    react: '🟩',
    usage: '.challenge (reply / @user / id) | .challenge --accept | --reject | --cancel',
    description: 'Challenge another trainer for a Pokemon battle',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const senderId = String(M.from.id);
            const args = String(arg || '').trim().split(/\s+/).filter(Boolean);
            const sub = (args[0] || '').toLowerCase();

            // Init shared state on client
            client.pokemonChallengeResponse ??= new Map();    // chatId -> { challenger, challengee, name1, name2 }
            client.pokemonBattleResponse ??= new Map();       // chatId -> battleState
            client.pokemonBattlePlayerMap ??= new Map();      // userId -> chatId

            // ============================================
            // ACCEPT
            // ============================================
            if (sub === '--accept' || sub === '--a' || sub === 'accept') {
                const data = client.pokemonChallengeResponse.get(String(chatId));
                if (!data || data.challengee !== senderId) {
                    return client.sendMessage(chatId, '❌ No one challenged you for a Pokemon battle.',
                        { reply_to_message_id: M.message_id });
                }

                // Make sure both still have pokemon capable of battling
                const acceptorParty = (await pkmnManager.listParty(senderId)).filter((p) => p.hp > 0);
                if (!acceptorParty.length) {
                    client.pokemonChallengeResponse.delete(String(chatId));
                    return client.sendMessage(chatId,
                        '🟥 Challenge cancelled — your Pokémon have all fainted.',
                        { reply_to_message_id: M.message_id });
                }

                const challengerParty = (await pkmnManager.listParty(data.challenger)).filter((p) => p.hp > 0);
                if (!challengerParty.length) {
                    client.pokemonChallengeResponse.delete(String(chatId));
                    return client.sendMessage(chatId,
                        '🟥 Challenge cancelled — challenger has no battle-ready Pokémon.',
                        { reply_to_message_id: M.message_id });
                }

                client.pokemonChallengeResponse.delete(String(chatId));

                // Build battle state
                const p1Active = challengerParty.find((p) => p.isActive) || challengerParty[0];
                const p2Active = acceptorParty.find((p) => p.isActive) || acceptorParty[0];

                const battleState = {
                    chatId: String(chatId),
                    player1: {
                        userId: data.challenger,
                        name: data.challengerName || `User_${data.challenger}`,
                        ready: false,
                        move: '',
                        activePokemon: { ...p1Active, currentHp: p1Active.hp },
                        party: challengerParty.map((p) => ({ ...p, currentHp: p.hp })),
                    },
                    player2: {
                        userId: senderId,
                        name: M.from.first_name || `User_${senderId}`,
                        ready: false,
                        move: '',
                        activePokemon: { ...p2Active, currentHp: p2Active.hp },
                        party: acceptorParty.map((p) => ({ ...p, currentHp: p.hp })),
                    },
                    turn: 1,
                    turnStartedAt: Date.now(),
                    startedAt: Date.now(),
                    players: [data.challenger, senderId],
                };

                client.pokemonBattleResponse.set(String(chatId), battleState);
                client.pokemonBattlePlayerMap.set(senderId, String(chatId));
                client.pokemonBattlePlayerMap.set(data.challenger, String(chatId));

                const p1 = battleState.player1.activePokemon;
                const p2 = battleState.player2.activePokemon;

                const caption =
`🌀 *Pokemon Battle Started!* 🌀

👤 *${escapeMd(battleState.player1.name)}*
   ${capitalize(p1.name)} — HP ${p1.currentHp}/${p1.maxHp} · Lv ${p1.level}
   Type: ${(p1.types || []).map(capitalize).join('/') || 'Unknown'}

🆚

👤 *${escapeMd(battleState.player2.name)}*
   ${capitalize(p2.name)} — HP ${p2.currentHp}/${p2.maxHp} · Lv ${p2.level}
   Type: ${(p2.types || []).map(capitalize).join('/') || 'Unknown'}

🎮 *How to play*
• \`.battle fight\` — choose a move
• \`.move <number|name>\` — pick your attack
• \`.battle switch <id>\` — swap active Pokémon
• \`.battle forfeit\` — give up
• \`.battle status\` — show battle state

⏱️ Both trainers have 60 seconds each turn.`;

                await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
                return;
            }

            // ============================================
            // REJECT
            // ============================================
            if (sub === '--reject' || sub === '--r' || sub === 'reject') {
                const data = client.pokemonChallengeResponse.get(String(chatId));
                if (!data || data.challengee !== senderId) {
                    return client.sendMessage(chatId, '❌ No one challenged you for a Pokemon battle.',
                        { reply_to_message_id: M.message_id });
                }
                client.pokemonChallengeResponse.delete(String(chatId));
                return client.sendMessage(chatId,
                    `❎ You rejected *${escapeMd(data.challengerName || 'their')}* challenge.`,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // ============================================
            // CANCEL
            // ============================================
            if (sub === '--cancel' || sub === '--c' || sub === 'cancel') {
                const data = client.pokemonChallengeResponse.get(String(chatId));
                if (!data || data.challenger !== senderId) {
                    return client.sendMessage(chatId, "❌ You didn't challenge anyone.",
                        { reply_to_message_id: M.message_id });
                }
                client.pokemonChallengeResponse.delete(String(chatId));
                return client.sendMessage(chatId, '✅ You cancelled your own challenge.',
                    { reply_to_message_id: M.message_id });
            }

            // ============================================
            // ISSUE NEW CHALLENGE
            // ============================================
            // Reject if a battle is already running in this chat
            if (client.pokemonBattleResponse.has(String(chatId))) {
                return client.sendMessage(chatId, '⚠️ A battle in this chat is already ongoing.',
                    { reply_to_message_id: M.message_id });
            }

            // Check sender's party
            const senderParty = (await pkmnManager.listParty(senderId)).filter((p) => p.hp > 0);
            if (!senderParty.length) {
                return client.sendMessage(chatId,
                    "❌ You don't have any Pokemon capable of battling. Use `.heal` or `.pstart` first.",
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            const target = await resolveTarget(client, M, args);
            if (!target) {
                return client.sendMessage(chatId,
                    '❌ Tag, reply to, or provide the user ID of the trainer you want to challenge.\n' +
                    'Example: `.challenge @username` or reply to their message with `.challenge`.',
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }
            if (target.error) {
                return client.sendMessage(chatId, target.error, { reply_to_message_id: M.message_id });
            }
            if (target.id === senderId) {
                return client.sendMessage(chatId, '🤡 You cannot challenge yourself.',
                    { reply_to_message_id: M.message_id });
            }

            // Check if target is in another battle
            if (client.pokemonBattlePlayerMap.has(target.id)) {
                return client.sendMessage(chatId,
                    `⚠️ *${escapeMd(target.name)}* is already in a battle. You can't challenge them right now.`,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // Check opponent's party
            const opponentParty = (await pkmnManager.listParty(target.id)).filter((p) => p.hp > 0);
            if (!opponentParty.length) {
                return client.sendMessage(chatId,
                    `❌ *${escapeMd(target.name)}* doesn't have any battle-ready Pokémon.`,
                    { parse_mode: 'Markdown', reply_to_message_id: M.message_id });
            }

            // Save challenge
            const senderName = M.from.first_name || `User_${senderId}`;
            client.pokemonChallengeResponse.set(String(chatId), {
                challenger: senderId,
                challengee: target.id,
                challengerName: senderName,
                challengeeName: target.name,
                createdAt: Date.now(),
            });

            await client.sendMessage(chatId,
                `⚔️ *${escapeMd(senderName)}* has challenged *${escapeMd(target.name)}* to a Pokémon battle!\n\n` +
                `*${escapeMd(target.name)}*, type \`.challenge --accept\` to accept, ` +
                `or \`.challenge --reject\` to decline.\n\n` +
                `⏳ Challenge expires in 6 minutes.`,
                { parse_mode: 'Markdown', reply_to_message_id: M.message_id }
            );

            // Auto-expire
            setTimeout(async () => {
                const still = client.pokemonChallengeResponse.get(String(chatId));
                if (!still) return;
                if (still.challenger === senderId && still.challengee === target.id) {
                    client.pokemonChallengeResponse.delete(String(chatId));
                    try {
                        await client.sendMessage(chatId,
                            `⌛ Challenge cancelled — *${escapeMd(target.name)}* didn't respond in time.`,
                            { parse_mode: 'Markdown' });
                    } catch (_) {}
                }
            }, 6 * 60 * 1000);
        } catch (err) {
            console.error('challenge command error:', err);
            try {
                await client.sendMessage(M.chat.id, `❌ Error in challenge: ${err.message || 'Unknown'}`);
            } catch (_) {}
        }
    },
};
