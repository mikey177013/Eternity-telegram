// src/Commands/Core/leaderboard.js
// Leaderboards for: mana (wallet + treasury), card (total card count), pokemon
// (party + pss + trainer level). Real data only — pulled live from the
// sqlite databases.

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const econManager = require('../../Database/econManager');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

// Resolve a user's display handle from the registration database.
async function getDisplayName(client, userId) {
    try {
        if (client?.database?.db) {
            const row = await new Promise((resolve) => {
                client.database.db.get(
                    'SELECT username, full_name FROM users WHERE user_id = ?',
                    [userId],
                    (err, r) => resolve(r || null)
                );
            });
            if (row) {
                if (row.username) return `@${row.username}`;
                if (row.full_name) return row.full_name;
            }
        }
    } catch (_) { /* ignore */ }
    return `User ${String(userId).slice(-5)}`;
}

// ----------------- MANA -----------------
// total = aurites (wallet) + treasury (chest)
function fetchManaLeaderboard() {
    return new Promise((resolve) => {
        const dbPath = path.join(__dirname, '../../Database/econ.sqlite');
        const db = new sqlite3.Database(dbPath);
        db.all(
            `SELECT user_id,
                    COALESCE(aurites, 0)  AS wallet,
                    COALESCE(treasury, 0) AS chest,
                    COALESCE(aurites, 0) + COALESCE(treasury, 0) AS total
             FROM economy
             ORDER BY total DESC`,
            [],
            (err, rows) => {
                db.close();
                if (err) return resolve([]);
                resolve(rows || []);
            }
        );
    });
}

// ----------------- CARDS -----------------
function fetchCardLeaderboard() {
    return new Promise((resolve) => {
        const dbPath = path.join(__dirname, '../../Database/card.sqlite');
        const db = new sqlite3.Database(dbPath);
        db.all(
            `SELECT user_id, COUNT(*) AS total
             FROM cards
             GROUP BY user_id
             ORDER BY total DESC`,
            [],
            (err, rows) => {
                db.close();
                if (err) return resolve([]);
                resolve(rows || []);
            }
        );
    });
}

// ----------------- POKEMON -----------------
// total pokemon = party + pss boxes
function fetchPokemonLeaderboard() {
    return new Promise((resolve) => {
        const dbPath = path.join(__dirname, '../../Database/pkmn.sqlite');
        const db = new sqlite3.Database(dbPath);
        db.all(
            `SELECT u.userId AS user_id,
                    COALESCE(p.cnt, 0) + COALESCE(s.cnt, 0) AS total,
                    COALESCE(t.level, 1) AS level
             FROM (
                SELECT userId FROM party
                UNION
                SELECT userId FROM pss
                UNION
                SELECT userId FROM trainers
             ) u
             LEFT JOIN (SELECT userId, COUNT(*) cnt FROM party GROUP BY userId) p ON p.userId = u.userId
             LEFT JOIN (SELECT userId, COUNT(*) cnt FROM pss   GROUP BY userId) s ON s.userId = u.userId
             LEFT JOIN trainers t ON t.userId = u.userId
             ORDER BY total DESC, level DESC`,
            [],
            (err, rows) => {
                db.close();
                if (err) return resolve([]);
                resolve(rows || []);
            }
        );
    });
}

// ----------------- RENDER HELPERS -----------------
async function renderManaBoard(client, rows, viewerId) {
    const top = rows.slice(0, 10);
    const lines = [];
    lines.push('💎 *MANA LEADERBOARD*');
    lines.push('━━━━━━━━━━━━━━━━━');
    if (!top.length) {
        lines.push('_No data yet._');
    } else {
        for (let i = 0; i < top.length; i++) {
            const r = top[i];
            const name = escMd(await getDisplayName(client, r.user_id));
            const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
            lines.push(`${medal} *${name}*`);
            lines.push(`     Mana — \`${Number(r.total).toLocaleString()}\` _(💰 ${Number(r.wallet).toLocaleString()} + 🏦 ${Number(r.chest).toLocaleString()})_`);
        }
    }

    // Viewer rank (if not in top 10)
    if (viewerId) {
        const rank = rows.findIndex(r => String(r.user_id) === String(viewerId));
        if (rank >= 10) {
            const me = rows[rank];
            lines.push('━━━━━━━━━━━━━━━━━');
            lines.push(`Your rank in lb is - *#${rank + 1}* (Mana \`${Number(me.total).toLocaleString()}\`)`);
        } else if (rank === -1) {
            lines.push('━━━━━━━━━━━━━━━━━');
            lines.push(`Your rank in lb is - *unranked* (no mana yet)`);
        }
    }
    return lines.join('\n');
}

async function renderCardBoard(client, rows, viewerId) {
    const top = rows.slice(0, 10);
    const lines = [];
    lines.push('🃏 *CARD LEADERBOARD*');
    lines.push('━━━━━━━━━━━━━━━━━');
    if (!top.length) {
        lines.push('_No data yet._');
    } else {
        for (let i = 0; i < top.length; i++) {
            const r = top[i];
            const name = escMd(await getDisplayName(client, r.user_id));
            const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
            lines.push(`${medal} *${name}*`);
            lines.push(`     Total cards — \`${Number(r.total).toLocaleString()}\``);
        }
    }
    if (viewerId) {
        const rank = rows.findIndex(r => String(r.user_id) === String(viewerId));
        if (rank >= 10) {
            const me = rows[rank];
            lines.push('━━━━━━━━━━━━━━━━━');
            lines.push(`Your rank in lb is - *#${rank + 1}* (Cards \`${Number(me.total).toLocaleString()}\`)`);
        } else if (rank === -1) {
            lines.push('━━━━━━━━━━━━━━━━━');
            lines.push(`Your rank in lb is - *unranked* (no cards yet)`);
        }
    }
    return lines.join('\n');
}

async function renderPokemonBoard(client, rows, viewerId) {
    const top = rows.slice(0, 10);
    const lines = [];
    lines.push('🐣 *POKEMON LEADERBOARD*');
    lines.push('━━━━━━━━━━━━━━━━━');
    if (!top.length) {
        lines.push('_No data yet._');
    } else {
        for (let i = 0; i < top.length; i++) {
            const r = top[i];
            const name = escMd(await getDisplayName(client, r.user_id));
            const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
            lines.push(`${medal} *${name}*`);
            lines.push(`     Pokemon — \`${Number(r.total).toLocaleString()}\` · Trainer Lv \`${r.level || 1}\``);
        }
    }
    if (viewerId) {
        const rank = rows.findIndex(r => String(r.user_id) === String(viewerId));
        if (rank >= 10) {
            const me = rows[rank];
            lines.push('━━━━━━━━━━━━━━━━━');
            lines.push(`Your rank in lb is - *#${rank + 1}* (Pokemon \`${Number(me.total).toLocaleString()}\`)`);
        } else if (rank === -1) {
            lines.push('━━━━━━━━━━━━━━━━━');
            lines.push(`Your rank in lb is - *unranked* (no pokemon yet)`);
        }
    }
    return lines.join('\n');
}

function kbForType(active = null) {
    const mk = (label, type) => ({
        text: (active === type ? '◉ ' : '') + label,
        callback_data: `lb_${type}`,
    });
    return {
        inline_keyboard: [
            [mk('💎 Mana', 'mana'), mk('🃏 Cards', 'card'), mk('🐣 Pokemon', 'pokemon')],
        ],
    };
}

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    category: 'core',
    exp: 1,
    cool: 5,
    react: '🏆',
    usage: '.leaderboard [--mana | --card | --pokemon]',
    description: 'Show the top 10 users by mana, cards, or pokemon.',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const viewerId = String(M.from.id);
            const argText = (arg || '').toLowerCase().trim();

            // Detect requested board
            let type = null;
            if (/--?mana\b/.test(argText) || argText === 'mana') type = 'mana';
            else if (/--?card\b/.test(argText) || argText === 'card' || argText === 'cards') type = 'card';
            else if (/--?pok(e|é)mon\b/.test(argText) || argText === 'pokemon' || argText === 'poke') type = 'pokemon';

            // No flag — show overview with picker buttons
            if (!type) {
                const text =
                    '🏆 *Leaderboards*\n\n' +
                    '`.leaderboard --mana`   — Top mana holders\n' +
                    '`.leaderboard --card`   — Top card collectors\n' +
                    '`.leaderboard --pokemon`— Top pokemon trainers\n\n' +
                    'Or tap a button below ⬇️';
                return client.sendMessage(chatId, text, {
                    parse_mode: 'Markdown',
                    reply_markup: kbForType(),
                });
            }

            let body;
            if (type === 'mana') {
                const rows = await fetchManaLeaderboard();
                body = await renderManaBoard(client, rows, viewerId);
            } else if (type === 'card') {
                const rows = await fetchCardLeaderboard();
                body = await renderCardBoard(client, rows, viewerId);
            } else {
                const rows = await fetchPokemonLeaderboard();
                body = await renderPokemonBoard(client, rows, viewerId);
            }

            return client.sendMessage(chatId, body, {
                parse_mode: 'Markdown',
                reply_markup: kbForType(type),
            });
        } catch (err) {
            console.error('leaderboard error:', err);
            try {
                await client.sendMessage(M.chat.id, '❌ Error loading leaderboard.');
            } catch (_) {}
        }
    },

    // Expose renderers/fetchers for callback usage
    _internal: {
        fetchManaLeaderboard,
        fetchCardLeaderboard,
        fetchPokemonLeaderboard,
        renderManaBoard,
        renderCardBoard,
        renderPokemonBoard,
        kbForType,
    },
};
