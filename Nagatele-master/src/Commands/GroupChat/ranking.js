/**
 * src/Commands/GroupChat/ranking.js
 *
 * .ranking — Show today's top 10 most active users in the
 * *current* group (group-scoped, today only).
 *
 * Part of the ChatFight (Group Chat Activity) system.
 * Uses chatfightManager (sqlite) — does not touch any other DB.
 */

const chatfightManager = require('../../Database/chatfightManager');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

const MEDAL = ['🥇', '🥈', '🥉'];

module.exports = {
    name: 'ranking',
    aliases: ['rankings'],
    category: 'groupchat',
    exp: 5,
    cool: 4,
    react: '📊',
    usage: '.ranking',
    description: "Show today's top 10 most active users in this group.",

    async execute(client, arg, M) {
        try {
            const chat = M.chat || {};
            const chatType = chat.type;

            // Group-only command.
            if (chatType !== 'group' && chatType !== 'supergroup') {
                return client.sendMessage(
                    chat.id,
                    '📊 *.ranking* only works inside a group.',
                    { parse_mode: 'Markdown' }
                );
            }

            const groupId = String(chat.id);
            const date = chatfightManager.todayString();

            const top = await chatfightManager.getTopUsers(groupId, 10, date);
            const total = await chatfightManager.getGroupTotal(groupId, date);

            if (!top.length) {
                return client.sendMessage(
                    chat.id,
                    "📊 *Today's Ranking*\n\nNo activity recorded yet today. Start chatting!",
                    { parse_mode: 'Markdown' }
                );
            }

            // Build the leaderboard text.
            const lines = [];
            for (let i = 0; i < top.length; i++) {
                const row = top[i];
                const rankIcon = MEDAL[i] || `*${i + 1}.*`;
                const name = row.username
                    ? `@${escMd(row.username)}`
                    : `User ${String(row.user_id).slice(-5)}`;
                const pct = total > 0
                    ? ((row.message_count / total) * 100).toFixed(1)
                    : '0.0';
                lines.push(
                    `${rankIcon} ${name} — *${Number(row.message_count).toLocaleString()}* msgs (${pct}%)`
                );
            }

            const groupTitle = escMd(chat.title || 'this group');
            const header =
                `📊 *Today's Ranking — ${groupTitle}*\n` +
                `📅 ${date}\n` +
                `💬 Total messages today: *${total.toLocaleString()}*\n\n`;

            await client.sendMessage(chat.id, header + lines.join('\n'), {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } catch (err) {
            console.error('ranking command error:', err);
            try {
                await client.sendMessage(
                    M.chat.id,
                    '❌ Failed to load ranking. Please try again.'
                );
            } catch (_) {}
        }
    }
};
