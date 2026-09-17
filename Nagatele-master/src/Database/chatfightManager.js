/**
 * src/Database/chatfightManager.js
 * ---------------------------------------------------------------
 * ChatFight - Group Chat Activity System
 *
 * Self-contained database manager for the Group Chat Activity
 * ("ChatFight") feature. Uses its own sqlite file:
 *     src/Database/chatfight.sqlite
 *
 * This module DOES NOT touch the existing economy/cards/users
 * databases. It only stores per-group / per-user message counts,
 * milestone logs and daily reward records.
 *
 * Tables created:
 *   - daily_group_stats   (group_id, date, total_messages)
 *   - daily_user_stats    (group_id, user_id, username, date, message_count)
 *   - group_rewards       (group_id, date, winner_user_id, reward_given)
 *   - milestone_logs      (group_id, date, milestone, triggered)
 *
 * All write operations are async and safe to fire-and-forget from
 * a message handler (`.catch()` recommended at call site).
 * ---------------------------------------------------------------
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ChatFightManager {
    constructor() {
        // Dedicated sqlite file lives alongside the other DBs.
        this.dbPath = path.join(__dirname, 'chatfight.sqlite');
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ ChatFight DB open error:', err.message);
                return;
            }
            console.log('✅ ChatFight database connected:', this.dbPath);
        });
        // Better concurrency for high-traffic groups.
        try {
            this.db.run('PRAGMA journal_mode = WAL;');
            this.db.run('PRAGMA synchronous = NORMAL;');
        } catch (_) { /* ignore */ }

        this.initDatabase();
    }

    /**
     * Create all required tables + indexes.
     */
    initDatabase() {
        const queries = [
            // ---- daily_group_stats ------------------------------
            // Total messages per group per day.
            `CREATE TABLE IF NOT EXISTS daily_group_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                date TEXT NOT NULL,
                total_messages INTEGER DEFAULT 0,
                updated_at INTEGER DEFAULT (strftime('%s','now')),
                UNIQUE(group_id, date)
            )`,

            // ---- daily_user_stats -------------------------------
            // Per-user message count inside a group for a given day.
            `CREATE TABLE IF NOT EXISTS daily_user_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                username TEXT,
                date TEXT NOT NULL,
                message_count INTEGER DEFAULT 0,
                updated_at INTEGER DEFAULT (strftime('%s','now')),
                UNIQUE(group_id, user_id, date)
            )`,

            // ---- group_rewards ----------------------------------
            // Prevents double daily-rewarding for the same group/day.
            `CREATE TABLE IF NOT EXISTS group_rewards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                date TEXT NOT NULL,
                winner_user_id TEXT,
                reward_given INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s','now')),
                UNIQUE(group_id, date)
            )`,

            // ---- milestone_logs ---------------------------------
            // Tracks which milestone messages have been sent today
            // so we never post the same milestone twice.
            `CREATE TABLE IF NOT EXISTS milestone_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                date TEXT NOT NULL,
                milestone INTEGER NOT NULL,
                triggered INTEGER DEFAULT 1,
                created_at INTEGER DEFAULT (strftime('%s','now')),
                UNIQUE(group_id, date, milestone)
            )`,

            // ---- helpful indexes --------------------------------
            `CREATE INDEX IF NOT EXISTS idx_dus_group_date
                ON daily_user_stats(group_id, date)`,
            `CREATE INDEX IF NOT EXISTS idx_dus_user
                ON daily_user_stats(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_dgs_group_date
                ON daily_group_stats(group_id, date)`,
            `CREATE INDEX IF NOT EXISTS idx_ml_group_date
                ON milestone_logs(group_id, date)`
        ];

        // Run sequentially so indexes are created *after* their tables.
        // sqlite3 actually serialises by default on a single connection, but
        // we wrap in db.serialize() to make the ordering explicit & safe.
        this.db.serialize(() => {
            queries.forEach((q, i) => {
                this.db.run(q, (err) => {
                    if (err) {
                        console.error(`❌ ChatFight init query ${i + 1} failed:`, err.message);
                    }
                });
            });
        });

        console.log('✅ ChatFight tables ready');
    }

    // ===================================================
    //  HELPERS
    // ===================================================

    /**
     * Today's date as YYYY-MM-DD (server local time).
     * Centralising this keeps every query consistent.
     */
    todayString(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // ===================================================
    //  WRITE: track a message
    // ===================================================

    /**
     * Atomically increment both:
     *   - per-user counter for (group, user, today)
     *   - group total counter for (group, today)
     *
     * @param {string|number} groupId
     * @param {string|number} userId
     * @param {string|null}   username   - Telegram @handle (no @), optional.
     * @returns {Promise<{userCount:number, groupTotal:number}>}
     */
    async incrementMessage(groupId, userId, username = null) {
        const date = this.todayString();
        const gid = String(groupId);
        const uid = String(userId);
        const uname = username ? String(username) : null;

        // Use UPSERTs so we never crash on a missing row.
        // sqlite3's ON CONFLICT requires the UNIQUE constraint we declared above.

        await this._run(
            `INSERT INTO daily_user_stats (group_id, user_id, username, date, message_count, updated_at)
             VALUES (?, ?, ?, ?, 1, strftime('%s','now'))
             ON CONFLICT(group_id, user_id, date)
             DO UPDATE SET
                message_count = message_count + 1,
                username      = COALESCE(excluded.username, username),
                updated_at    = strftime('%s','now')`,
            [gid, uid, uname, date]
        );

        await this._run(
            `INSERT INTO daily_group_stats (group_id, date, total_messages, updated_at)
             VALUES (?, ?, 1, strftime('%s','now'))
             ON CONFLICT(group_id, date)
             DO UPDATE SET
                total_messages = total_messages + 1,
                updated_at     = strftime('%s','now')`,
            [gid, date]
        );

        // Return the fresh counters - useful for milestone checks.
        const userCount = await this.getUserMessageCount(gid, uid, date);
        const groupTotal = await this.getGroupTotal(gid, date);
        return { userCount, groupTotal };
    }

    // ===================================================
    //  READ: counters
    // ===================================================

    async getGroupTotal(groupId, date = null) {
        const d = date || this.todayString();
        const row = await this._get(
            `SELECT total_messages FROM daily_group_stats
             WHERE group_id = ? AND date = ?`,
            [String(groupId), d]
        );
        return row ? Number(row.total_messages) : 0;
    }

    async getUserMessageCount(groupId, userId, date = null) {
        const d = date || this.todayString();
        const row = await this._get(
            `SELECT message_count FROM daily_user_stats
             WHERE group_id = ? AND user_id = ? AND date = ?`,
            [String(groupId), String(userId), d]
        );
        return row ? Number(row.message_count) : 0;
    }

    /**
     * Top N users for a group on a given date (default: today).
     * Returns: [{ user_id, username, message_count }, ...]
     */
    async getTopUsers(groupId, limit = 10, date = null) {
        const d = date || this.todayString();
        return this._all(
            `SELECT user_id, username, message_count
             FROM daily_user_stats
             WHERE group_id = ? AND date = ?
             ORDER BY message_count DESC, updated_at ASC
             LIMIT ?`,
            [String(groupId), d, limit]
        );
    }

    /**
     * User's rank inside a group for a given date.
     * Returns rank (1-based) or null if no messages.
     */
    async getUserRank(groupId, userId, date = null) {
        const d = date || this.todayString();
        const row = await this._get(
            `SELECT message_count FROM daily_user_stats
             WHERE group_id = ? AND user_id = ? AND date = ?`,
            [String(groupId), String(userId), d]
        );
        if (!row) return null;

        const better = await this._get(
            `SELECT COUNT(*) AS cnt FROM daily_user_stats
             WHERE group_id = ? AND date = ? AND message_count > ?`,
            [String(groupId), d, row.message_count]
        );
        return (better ? Number(better.cnt) : 0) + 1;
    }

    /**
     * For .mytop - top N groups for a given user, sorted by
     * total messages the user has ever sent across all dates.
     */
    async getUserTopGroups(userId, limit = 5) {
        return this._all(
            `SELECT group_id,
                    SUM(message_count) AS total
             FROM daily_user_stats
             WHERE user_id = ?
             GROUP BY group_id
             ORDER BY total DESC
             LIMIT ?`,
            [String(userId), limit]
        );
    }

    /**
     * Look up the most recent stored username for a user_id.
     * Used as a fallback to display nicely.
     */
    async getKnownUsername(userId) {
        const row = await this._get(
            `SELECT username FROM daily_user_stats
             WHERE user_id = ? AND username IS NOT NULL AND username != ''
             ORDER BY updated_at DESC
             LIMIT 1`,
            [String(userId)]
        );
        return row ? row.username : null;
    }

    /**
     * Look up a user_id given an @username (case-insensitive).
     * Used by .userstats @username.
     */
    async findUserIdByUsername(username) {
        if (!username) return null;
        const clean = String(username).replace(/^@/, '').toLowerCase();
        const row = await this._get(
            `SELECT user_id FROM daily_user_stats
             WHERE LOWER(username) = ?
             ORDER BY updated_at DESC
             LIMIT 1`,
            [clean]
        );
        return row ? row.user_id : null;
    }

    // ===================================================
    //  MILESTONES
    // ===================================================

    /**
     * Returns true if this milestone was successfully *just* logged
     * (i.e. it hadn't been triggered yet for this group/day).
     * Returns false if it was already logged (idempotent).
     */
    async tryMarkMilestone(groupId, milestone, date = null) {
        const d = date || this.todayString();
        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR IGNORE INTO milestone_logs
                    (group_id, date, milestone, triggered)
                 VALUES (?, ?, ?, 1)`,
                [String(groupId), d, Number(milestone)],
                function (err) {
                    if (err) {
                        console.error('milestone insert error:', err.message);
                        return resolve(false);
                    }
                    // this.changes === 1 => inserted (first time)
                    // this.changes === 0 => ignored  (already existed)
                    resolve(this.changes === 1);
                }
            );
        });
    }

    // ===================================================
    //  DAILY REWARD
    // ===================================================

    /**
     * Have we already given a reward for this group on this date?
     */
    async wasRewardGiven(groupId, date) {
        const row = await this._get(
            `SELECT reward_given FROM group_rewards
             WHERE group_id = ? AND date = ?`,
            [String(groupId), date]
        );
        return !!(row && row.reward_given);
    }

    /**
     * Atomically claim the "reward slot" for (group, date). Returns
     * true if THIS call won the race (and the caller must now actually
     * grant the mana / send announcement). If it returns false, someone
     * else already claimed it (or it was claimed earlier) - do nothing.
     */
    async claimRewardSlot(groupId, date, winnerUserId) {
        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR IGNORE INTO group_rewards
                    (group_id, date, winner_user_id, reward_given)
                 VALUES (?, ?, ?, 1)`,
                [String(groupId), date, String(winnerUserId)],
                function (err) {
                    if (err) {
                        console.error('claim reward slot error:', err.message);
                        return resolve(false);
                    }
                    resolve(this.changes === 1);
                }
            );
        });
    }

    /**
     * List of group_ids that have any activity for a given date.
     * Used by the daily reward scheduler.
     */
    async getActiveGroupsForDate(date) {
        const rows = await this._all(
            `SELECT DISTINCT group_id
             FROM daily_group_stats
             WHERE date = ? AND total_messages > 0`,
            [date]
        );
        return rows.map((r) => r.group_id);
    }

    /**
     * Pick the top user for a group/date, EXCLUDING any user IDs
     * supplied in `excludeIds` (used to ignore bots).
     * Returns { user_id, username, message_count } or null.
     */
    async getTopUserForDate(groupId, date, excludeIds = []) {
        const placeholders = excludeIds.length
            ? excludeIds.map(() => '?').join(',')
            : null;

        const sql = placeholders
            ? `SELECT user_id, username, message_count
               FROM daily_user_stats
               WHERE group_id = ? AND date = ?
                 AND user_id NOT IN (${placeholders})
               ORDER BY message_count DESC, updated_at ASC
               LIMIT 1`
            : `SELECT user_id, username, message_count
               FROM daily_user_stats
               WHERE group_id = ? AND date = ?
               ORDER BY message_count DESC, updated_at ASC
               LIMIT 1`;

        const params = placeholders
            ? [String(groupId), date, ...excludeIds.map(String)]
            : [String(groupId), date];

        return this._get(sql, params);
    }

    // ===================================================
    //  PROMISE WRAPPERS
    // ===================================================

    _run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    _get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    _all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    close() {
        try { this.db.close(); } catch (_) {}
    }
}

// Export a singleton so all handlers/commands share the same connection.
const chatfightManager = new ChatFightManager();
module.exports = chatfightManager;
