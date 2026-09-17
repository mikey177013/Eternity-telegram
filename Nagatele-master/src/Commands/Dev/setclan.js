// src/Commands/Dev/setclan.js
// Force-set a user's clan (or clear it).
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let clanDb = null;
function getClanDb() {
    if (clanDb) return clanDb;
    clanDb = new sqlite3.Database(path.join(__dirname, '../../Database/clans.sqlite'));
    return clanDb;
}

module.exports = {
    name: 'setclan',
    category: 'dev',
    description: "Force-set a user's clan",
    usage: '.setclan (reply) <clan_name|none>   OR   .setclan <user_id> <clan_name|none>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const tokens = (arg || '').trim().split(/\s+/).filter(Boolean);

        let targetId = null;
        let clanName = null;

        if (M.reply_to_message && M.reply_to_message.from) {
            targetId = M.reply_to_message.from.id;
            clanName = tokens.join(' ');
        } else if (tokens.length >= 2 && /^\d{5,}$/.test(tokens[0])) {
            targetId = tokens.shift();
            clanName = tokens.join(' ');
        }

        if (!targetId || !clanName) {
            return client.sendMessage(chatId,
                '❌ Usage: `.setclan (reply) <clan_name|none>` or `.setclan <user_id> <clan_name|none>`',
                { parse_mode: 'Markdown' }
            );
        }

        const db = getClanDb();
        const clear = clanName.toLowerCase() === 'none';
        const finalClan = clear ? null : clanName;

        db.run(
            `CREATE TABLE IF NOT EXISTS user_clans (user_id TEXT PRIMARY KEY, clan TEXT)`,
            () => {
                db.run(
                    `INSERT INTO user_clans (user_id, clan) VALUES (?, ?)
                     ON CONFLICT(user_id) DO UPDATE SET clan = excluded.clan`,
                    [String(targetId), finalClan],
                    async (err) => {
                        if (err) {
                            return client.sendMessage(chatId, `❌ DB error: ${err.message}`);
                        }
                        await client.sendMessage(chatId,
                            clear
                                ? `✅ Cleared clan for \`${targetId}\`.`
                                : `✅ Set clan of \`${targetId}\` to *${finalClan}*.`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                );
            }
        );
    }
};
