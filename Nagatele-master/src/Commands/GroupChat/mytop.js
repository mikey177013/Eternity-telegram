/**
 * src/Commands/GroupChat/mytop.js
 *
 * .mytop — Show the caller's top 5 most-active groups (by all-time
 * message count across every day stored in chatfight.sqlite).
 *
 * Part of the ChatFight (Group Chat Activity) system.
 */

const chatfightManager = require('../../Database/chatfightManager');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

const MEDAL = ['🥇', '🥈', '🥉', '🏅', '🏅'];

module.exports = {
    name: 'mytop',
    aliases: ['mygroups'],
    category: 'groupchat',
    exp: 5,
    cool: 4,
    react: '🏠',
    usage: '.mytop',
    description: 'Show your top 5 most-active groups.',

    async execute(client, arg, M) {
        try {
            const chat = M.chat || {};
            const userId = String(M.from?.id || '');
            if (!userId) {
                return client.sendMessage(
                    chat.id,
                    '❌ Could not identify you. Try again.'
                );
            }

            // Top 5 groups, aggregated across all dates.
            const rows = await chatfightManager.getUserTopGroups(userId, 5);

            if (!rows.length) {
                return client.sendMessage(
                    chat.id,
                    "🏠 *Your Top Groups*\n\nI haven't recorded any group activity from you yet. " +
                    "Once you send messages in groups that have me, they'll appear here.",
                    { parse_mode: 'Markdown' }
                );
            }

            // Resolve each group_id to a readable title via Telegram (best-effort).
            // We do this in parallel but never let one failure block the rest.
            const titles = await Promise.all(
                rows.map(async (r) => {
                    try {
                        const info = await client.bot.getChat(r.group_id);
                        return info?.title || `Group ${String(r.group_id).slice(-5)}`;
                    } catch (_) {
                        return `Group ${String(r.group_id).slice(-5)}`;
                    }
                })
            );

            const userName =
                M.from?.username ? `@${escMd(M.from.username)}` :
                M.from?.first_name ? escMd(M.from.first_name) :
                'You';

            const lines = rows.map((r, i) => {
                const icon = MEDAL[i] || `*${i + 1}.*`;
                return `${icon} *${escMd(titles[i])}* — ${Number(r.total).toLocaleString()} msgs`;
            });

            const header = `🏠 *${userName}'s Top 5 Groups*\n\n`;

            await client.sendMessage(chat.id, header + lines.join('\n'), {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } catch (err) {
            console.error('mytop command error:', err);
            try {
                await client.sendMessage(
                    M.chat.id,
                    '❌ Failed to load your top groups. Please try again.'
                );
            } catch (_) {}
        }
    }
};
