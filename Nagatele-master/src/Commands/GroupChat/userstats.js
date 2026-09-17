/**
 * src/Commands/GroupChat/userstats.js
 *
 * .userstats              -> your own stats for today in this group
 * .userstats @username    -> stats for the mentioned user
 * .userstats (reply)      -> stats for the replied-to user
 *
 * Shows:
 *   - today's message count
 *   - current rank in this group (today)
 *   - contribution percentage (vs. today's group total)
 *
 * Part of the ChatFight (Group Chat Activity) system.
 */

const chatfightManager = require('../../Database/chatfightManager');

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

/**
 * Resolve the target user_id + display info from the command context.
 * Resolution order:
 *   1. reply_to_message.from (most reliable - has full user object)
 *   2. text_mention entity (carries the user object directly)
 *   3. @username entity (look up in our tracking DB)
 *   4. raw @username token in the arg string (look up in our tracking DB)
 *   5. fall back to the caller themselves
 */
async function resolveTarget(M, arg) {
    // 1. Reply
    if (M.reply_to_message?.from?.id && !M.reply_to_message.from.is_bot) {
        return {
            user_id: String(M.reply_to_message.from.id),
            username: M.reply_to_message.from.username || null,
            first_name: M.reply_to_message.from.first_name || null,
            isSelf: false
        };
    }

    // 2/3. Inspect message entities
    const entities = M.entities || M.caption_entities || [];
    const text = M.text || M.caption || '';
    for (const ent of entities) {
        if (ent.type === 'text_mention' && ent.user?.id) {
            return {
                user_id: String(ent.user.id),
                username: ent.user.username || null,
                first_name: ent.user.first_name || null,
                isSelf: false
            };
        }
        if (ent.type === 'mention') {
            const handle = text.substr(ent.offset + 1, ent.length - 1);
            const uid = await chatfightManager.findUserIdByUsername(handle);
            if (uid) {
                return {
                    user_id: String(uid),
                    username: handle.replace(/^@/, ''),
                    first_name: null,
                    isSelf: false
                };
            }
            // Couldn't resolve via DB - keep trying
        }
    }

    // 4. Raw arg string ("@someone")
    const argStr = (arg || '').trim();
    if (argStr.startsWith('@')) {
        const handle = argStr.split(/\s+/)[0].slice(1);
        const uid = await chatfightManager.findUserIdByUsername(handle);
        if (uid) {
            return {
                user_id: String(uid),
                username: handle,
                first_name: null,
                isSelf: false
            };
        }
        return { unresolved: handle };
    }

    // 5. Self
    if (M.from?.id) {
        return {
            user_id: String(M.from.id),
            username: M.from.username || null,
            first_name: M.from.first_name || null,
            isSelf: true
        };
    }

    return null;
}

module.exports = {
    name: 'userstats',
    aliases: ['ustats', 'me'],
    category: 'groupchat',
    exp: 5,
    cool: 4,
    react: '📈',
    usage: '.userstats [@username | reply]',
    description: "Show a user's daily message count, rank, and contribution % in this group.",

    async execute(client, arg, M) {
        try {
            const chat = M.chat || {};
            const chatType = chat.type;

            if (chatType !== 'group' && chatType !== 'supergroup') {
                return client.sendMessage(
                    chat.id,
                    '📈 *.userstats* only works inside a group.',
                    { parse_mode: 'Markdown' }
                );
            }

            const groupId = String(chat.id);
            const date = chatfightManager.todayString();

            const target = await resolveTarget(M, arg);
            if (!target) {
                return client.sendMessage(
                    chat.id,
                    '❌ Could not determine the target user.',
                    { parse_mode: 'Markdown' }
                );
            }
            if (target.unresolved) {
                return client.sendMessage(
                    chat.id,
                    `❌ I don't have any tracked activity for *@${escMd(target.unresolved)}* yet.\n` +
                    `Ask them to send a message in the group first.`,
                    { parse_mode: 'Markdown' }
                );
            }

            // Pull stats
            const [messageCount, groupTotal, rank] = await Promise.all([
                chatfightManager.getUserMessageCount(groupId, target.user_id, date),
                chatfightManager.getGroupTotal(groupId, date),
                chatfightManager.getUserRank(groupId, target.user_id, date)
            ]);

            // Build a display name.
            let displayName;
            if (target.username) {
                displayName = `@${escMd(target.username)}`;
            } else if (target.first_name) {
                displayName = escMd(target.first_name);
            } else {
                // Fallback: latest known username from our DB
                const known = await chatfightManager.getKnownUsername(target.user_id);
                displayName = known
                    ? `@${escMd(known)}`
                    : `User ${String(target.user_id).slice(-5)}`;
            }

            if (!messageCount) {
                return client.sendMessage(
                    chat.id,
                    `📈 *User Stats — ${displayName}*\n` +
                    `📅 ${date}\n\n` +
                    `No messages from this user in *${escMd(chat.title || 'this group')}* today.`,
                    { parse_mode: 'Markdown' }
                );
            }

            const pct = groupTotal > 0
                ? ((messageCount / groupTotal) * 100).toFixed(2)
                : '0.00';

            const text =
                `📈 *User Stats — ${displayName}*\n` +
                `🏷  *Group:* ${escMd(chat.title || 'this group')}\n` +
                `📅 *Date:* ${date}\n\n` +
                `💬 *Messages today:* ${Number(messageCount).toLocaleString()}\n` +
                `🏆 *Rank today:* #${rank || '—'}\n` +
                `📊 *Contribution:* ${pct}% of ${groupTotal.toLocaleString()} total`;

            await client.sendMessage(chat.id, text, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } catch (err) {
            console.error('userstats command error:', err);
            try {
                await client.sendMessage(
                    M.chat.id,
                    '❌ Failed to load user stats. Please try again.'
                );
            } catch (_) {}
        }
    }
};
