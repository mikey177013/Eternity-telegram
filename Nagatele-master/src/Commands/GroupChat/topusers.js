/**
 * src/Commands/GroupChat/topusers.js
 *
 * .topusers — Show the top 10 most active users.
 *
 * Behaviour:
 *   - When invoked in a *group*: shows the top 10 for that group's
 *     all-time message totals (summed across every day stored).
 *   - When invoked in a *private chat*: shows the top 10 across
 *     every group the bot tracks (global all-time).
 *
 * Part of the ChatFight (Group Chat Activity) system.
 */

const chatfightManager = require('../../Database/chatfightManager');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

const MEDAL = ['🥇', '🥈', '🥉'];

// Light promise wrappers around the manager's underlying db.
function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

module.exports = {
    name: 'topusers',
    aliases: ['top10'],
    category: 'groupchat',
    exp: 5,
    cool: 4,
    react: '🏅',
    usage: '.topusers',
    description: 'Show the top 10 most active users (group-wide or global).',

    async execute(client, arg, M) {
        try {
            const chat = M.chat || {};
            const chatType = chat.type;
            const isGroup = chatType === 'group' || chatType === 'supergroup';

            // Reuse the shared sqlite handle from chatfightManager.
            const db = chatfightManager.db;

            let rows;
            let scopeLabel;

            if (isGroup) {
                // All-time top 10 within this group.
                rows = await dbAll(
                    db,
                    `SELECT user_id,
                            MAX(username)        AS username,
                            SUM(message_count)   AS total
                     FROM daily_user_stats
                     WHERE group_id = ?
                     GROUP BY user_id
                     ORDER BY total DESC
                     LIMIT 10`,
                    [String(chat.id)]
                );
                scopeLabel = escMd(chat.title || 'this group');
            } else {
                // Global top 10 across every group.
                rows = await dbAll(
                    db,
                    `SELECT user_id,
                            MAX(username)        AS username,
                            SUM(message_count)   AS total
                     FROM daily_user_stats
                     GROUP BY user_id
                     ORDER BY total DESC
                     LIMIT 10`
                );
                scopeLabel = 'all groups';
            }

            if (!rows.length) {
                return client.sendMessage(
                    chat.id,
                    '🏅 *Top Users*\n\nNo activity recorded yet.',
                    { parse_mode: 'Markdown' }
                );
            }

            const lines = rows.map((row, i) => {
                const rankIcon = MEDAL[i] || `*${i + 1}.*`;
                const name = row.username
                    ? `@${escMd(row.username)}`
                    : `User ${String(row.user_id).slice(-5)}`;
                return `${rankIcon} ${name} — *${Number(row.total).toLocaleString()}* msgs`;
            });

            const header = `🏅 *Top 10 Active Users — ${scopeLabel}*\n\n`;

            await client.sendMessage(chat.id, header + lines.join('\n'), {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } catch (err) {
            console.error('topusers command error:', err);
            try {
                await client.sendMessage(
                    M.chat.id,
                    '❌ Failed to load top users. Please try again.'
                );
            } catch (_) {}
        }
    }
};
