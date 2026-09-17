/**
 * src/Handlers/ChatFightHandler.js
 * ---------------------------------------------------------------
 * ChatFight - Group Chat Activity Handler
 *
 * Responsibilities:
 *   1. Track every group message (NOT private chats, NOT bots) and
 *      increment per-group / per-user counters via chatfightManager.
 *   2. Emit milestone announcements as the group's daily total
 *      crosses 2500, 10000, 15000, then every +5000 (20k, 25k, ...).
 *   3. At 23:59:59 each day, compute the daily chat champion for
 *      each active group, award 15,000 Mana Crystals via the existing
 *      economy system (econManager.addBalance), and post a Daily
 *      Chat Champion announcement. Duplicate rewards are prevented
 *      via the group_rewards table.
 *
 * This file is auto-loaded by MessageHandler.loadHandlers() because:
 *   - it lives in src/Handlers/
 *   - it is not in the excluded list (card.js / Clan.js / poke.js / AutoDownloader.js)
 *   - it exports a function with signature `async (client) => {}`.
 *
 * It does NOT modify the command router, MessageHandler, or any
 * existing economy logic. It only:
 *   - Attaches an additional `bot.on('message', ...)` listener.
 *   - Stores its own data in src/Database/chatfight.sqlite.
 *   - Calls the *existing* econManager.addBalance(...) for rewards
 *     (which is the canonical "Mana Crystals" balance, exposed in
 *     the user-facing .mana command).
 * ---------------------------------------------------------------
 */

const chatfightManager = require('../Database/chatfightManager');
const econManager      = require('../Database/econManager');

// ---------------- CONFIG ----------------

// First milestones to fire on the way up.
const FIXED_MILESTONES = [2500, 10000, 15000];
// After the last fixed milestone, fire one every +STEP messages.
const MILESTONE_STEP   = 5000;

// Daily reward amount (Mana Crystals).
const DAILY_REWARD     = 15000;

// Messages keyed by milestone value. Anything not listed falls
// back to a generic template.
const MILESTONE_MESSAGES = {
    2500:  'The group is active today. Keep chatting.',
    10000: '10,000 messages today. Incredible activity.',
    15000: '15,000 messages today. Chaos level unlocked.'
};

function milestoneMessageFor(value) {
    if (MILESTONE_MESSAGES[value]) return MILESTONE_MESSAGES[value];
    return `${value.toLocaleString()} messages today. The group is on fire.`;
}

/**
 * Build the ordered list of milestones we should *potentially*
 * fire for any given daily total. The handler will then ask the
 * DB to atomically claim each one (so it only sends once).
 */
function milestonesUpTo(total) {
    const list = [];
    for (const m of FIXED_MILESTONES) {
        if (total >= m) list.push(m);
    }
    // After the last fixed milestone, step every +MILESTONE_STEP.
    const lastFixed = FIXED_MILESTONES[FIXED_MILESTONES.length - 1];
    let next = lastFixed + MILESTONE_STEP;
    while (total >= next) {
        list.push(next);
        next += MILESTONE_STEP;
    }
    return list;
}

function escMd(s) {
    return String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');
}

// ---------------- HANDLER ----------------

module.exports = async function ChatFightHandler(client) {
    if (!client || !client.bot) {
        console.log('⚠️ ChatFightHandler: client/bot not ready, skipping.');
        return;
    }

    // Cache: bot's own ID (so we can skip self even if is_bot somehow missing)
    let selfBotId = null;
    try {
        const me = await client.bot.getMe();
        selfBotId = me?.id || null;
    } catch (_) { /* will fall back to is_bot flag */ }

    // -----------------------------------------------------------
    // 1) MESSAGE TRACKER
    // -----------------------------------------------------------
    // Attached as an *additional* listener. The main MessageHandler
    // already has its own `on('message')` for command dispatch — these
    // two listeners co-exist without conflict.
    client.bot.on('message', async (msg) => {
        try {
            if (!msg || !msg.chat || !msg.from) return;

            // -- Filter 1: ignore private chats --------------------
            const chatType = msg.chat.type;
            if (chatType !== 'group' && chatType !== 'supergroup') return;

            // -- Filter 2: ignore bots -----------------------------
            if (msg.from.is_bot) return;
            if (selfBotId && msg.from.id === selfBotId) return;

            const groupId  = String(msg.chat.id);
            const userId   = String(msg.from.id);
            const username = msg.from.username || null;

            // Increment counters atomically.
            const { groupTotal } =
                await chatfightManager.incrementMessage(groupId, userId, username);

            // -- Milestone check -----------------------------------
            // Quick gate: nothing to do until the first milestone.
            if (groupTotal < FIXED_MILESTONES[0]) return;

            const candidates = milestonesUpTo(groupTotal);
            for (const m of candidates) {
                // Atomic claim - returns true ONLY the first time per group/day.
                const fresh = await chatfightManager.tryMarkMilestone(groupId, m);
                if (!fresh) continue;

                try {
                    await client.sendMessage(
                        msg.chat.id,
                        milestoneMessageFor(m),
                        { parse_mode: 'Markdown' }
                    );
                } catch (sendErr) {
                    // Don't let a single send-error break the tracker.
                    console.error(
                        `[ChatFight] milestone send failed (${groupId}, ${m}):`,
                        sendErr.message
                    );
                }
            }
        } catch (err) {
            console.error('[ChatFight] tracker error:', err.message);
        }
    });

    console.log('✅ ChatFight tracker attached to message stream');

    // -----------------------------------------------------------
    // 2) DAILY REWARD SCHEDULER (runs at 23:59:59 local time)
    // -----------------------------------------------------------
    // We use a single timeout that re-arms itself. This avoids the
    // O(n) cost of `setInterval(1000)` and keeps drift bounded.

    function msUntilEndOfDay() {
        const now = new Date();
        const eod = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23, 59, 59, 0
        );
        let diff = eod.getTime() - now.getTime();
        // If we missed today's 23:59:59 (e.g. bot started at 23:59:59.5),
        // schedule for tomorrow's 23:59:59 instead.
        if (diff <= 0) diff += 24 * 60 * 60 * 1000;
        return diff;
    }

    function scheduleNextRewardRun() {
        const delay = msUntilEndOfDay();
        const eta = new Date(Date.now() + delay).toLocaleString();
        console.log(`⏳ ChatFight daily reward scheduled for ${eta}`);

        setTimeout(async () => {
            try {
                await runDailyRewards(client);
            } catch (e) {
                console.error('[ChatFight] daily reward run error:', e.message);
            } finally {
                // Re-arm for the next day (always).
                scheduleNextRewardRun();
            }
        }, delay).unref?.();  // .unref() so it never blocks process shutdown
    }

    scheduleNextRewardRun();
};

// ---------------- DAILY REWARD LOGIC ----------------

/**
 * For every group that had activity today:
 *   - pick the top user (excluding bots — see below)
 *   - if not already rewarded today (group_rewards table), claim the
 *     slot, grant 15,000 Mana Crystals, and post the announcement.
 *
 * Bots are filtered at two layers:
 *   (a) The tracker never inserts bot messages in the first place
 *       (msg.from.is_bot check above).
 *   (b) As an extra safety net, we re-check `getChatMember(...).user.is_bot`
 *       and skip them here. If a "winner" turns out to be a bot, we ask
 *       the DB for the next best, etc., up to MAX_BOT_RETRIES.
 */
async function runDailyRewards(client) {
    const date = chatfightManager.todayString();
    console.log(`🏆 Running ChatFight daily reward run for ${date}`);

    const groups = await chatfightManager.getActiveGroupsForDate(date);
    if (!groups.length) {
        console.log('   (no active groups today)');
        return;
    }

    const MAX_BOT_RETRIES = 5;

    for (const groupId of groups) {
        try {
            // Already rewarded? (idempotent / restart-safe)
            if (await chatfightManager.wasRewardGiven(groupId, date)) {
                continue;
            }

            // Pick the top non-bot user, retrying past bot detection.
            const excluded = [];
            let winner = null;
            for (let i = 0; i < MAX_BOT_RETRIES; i++) {
                winner = await chatfightManager.getTopUserForDate(
                    groupId, date, excluded
                );
                if (!winner) break;

                // Live check: is this user actually a bot in this chat?
                let isBot = false;
                try {
                    const member = await client.bot.getChatMember(
                        groupId, winner.user_id
                    );
                    isBot = !!(member && member.user && member.user.is_bot);
                    // Refresh username while we have the data.
                    if (member?.user?.username && !winner.username) {
                        winner.username = member.user.username;
                    }
                } catch (_) {
                    // If we can't fetch the member (left the group, etc.)
                    // assume not-a-bot and proceed.
                }

                if (!isBot) break;
                excluded.push(winner.user_id);
                winner = null;
            }

            if (!winner) {
                console.log(`   - group ${groupId}: no eligible winner`);
                continue;
            }

            // Atomic claim. If this returns false we lost a race and
            // someone else already wrote the row — bail out cleanly.
            const claimed = await chatfightManager.claimRewardSlot(
                groupId, date, winner.user_id
            );
            if (!claimed) {
                console.log(`   - group ${groupId}: already claimed (race), skip`);
                continue;
            }

            // ---- Grant the reward via the EXISTING economy --------
            // econManager.addBalance is the canonical "Mana Crystals" /
            // wallet balance shown by .mana. We are NOT modifying the
            // economy module — only calling its public method.
            try {
                await econManager.addBalance(winner.user_id, DAILY_REWARD);
            } catch (e) {
                console.error(
                    `[ChatFight] addBalance failed for ${winner.user_id}:`,
                    e.message
                );
                // We already claimed the slot; don't double-grant. Just continue.
            }

            // ---- Build the announcement ---------------------------
            const displayName = await resolveDisplayName(
                client, winner.user_id, winner.username
            );

            const text =
                `🏆 *Daily Chat Champion*\n\n` +
                `👑 *Username:* ${displayName}\n` +
                `💬 *Message Count:* ${Number(winner.message_count).toLocaleString()}\n` +
                `💎 *Reward:* +${DAILY_REWARD.toLocaleString()} Mana Crystals\n\n` +
                `Congratulations on being today's most active member!`;

            try {
                await client.sendMessage(groupId, text, { parse_mode: 'Markdown' });
            } catch (sendErr) {
                console.error(
                    `[ChatFight] announce failed in ${groupId}:`,
                    sendErr.message
                );
            }

            console.log(
                `   ✅ group ${groupId} -> winner ${winner.user_id} ` +
                `(${winner.message_count} msgs) +${DAILY_REWARD} mana`
            );

        } catch (gerr) {
            console.error(
                `[ChatFight] error processing group ${groupId}:`,
                gerr.message
            );
        }
    }

    console.log('🏆 ChatFight daily reward run complete');
}

/**
 * Best-effort display name resolution:
 *   1. Telegram username from message DB.
 *   2. Telegram username from chat member lookup.
 *   3. full_name from the bot's `users` registration DB.
 *   4. Short fallback.
 */
async function resolveDisplayName(client, userId, knownUsername) {
    if (knownUsername) return `@${escMd(knownUsername)}`;

    // Try the bot's registration DB (set up in src/Database/setup.js).
    try {
        if (client?.database?.db) {
            const row = await new Promise((resolve) => {
                client.database.db.get(
                    'SELECT username, full_name FROM users WHERE user_id = ?',
                    [userId],
                    (err, r) => resolve(r || null)
                );
            });
            if (row?.username) return `@${escMd(row.username)}`;
            if (row?.full_name) return escMd(row.full_name);
        }
    } catch (_) { /* ignore */ }

    return `User ${String(userId).slice(-5)}`;
}
