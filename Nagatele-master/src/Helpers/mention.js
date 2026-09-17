// src/Helpers/mention.js
// Resolve the "target user" of a command from:
//   1. A reply to a user message
//   2. A @username / text_mention entity
//   3. A numeric user id passed in `arg`
//
// Returns { id, first_name, last_name, username } or null.

async function resolveTargetUser(client, M, arg) {
    try {
        // 1) Reply takes priority
        if (M?.reply_to_message?.from) {
            const u = M.reply_to_message.from;
            return {
                id: String(u.id),
                first_name: u.first_name || 'User',
                last_name: u.last_name || '',
                username: u.username || null,
                _source: 'reply',
            };
        }

        const text = M?.text || M?.caption || '';
        const entities = M?.entities || M?.caption_entities || [];

        // 2) text_mention (user object embedded)
        for (const e of entities) {
            if (e.type === 'text_mention' && e.user) {
                const u = e.user;
                return {
                    id: String(u.id),
                    first_name: u.first_name || 'User',
                    last_name: u.last_name || '',
                    username: u.username || null,
                    _source: 'text_mention',
                };
            }
        }

        // 3) @username plain mention — try to resolve via DB
        for (const e of entities) {
            if (e.type === 'mention') {
                const handle = text.substr(e.offset, e.length).replace(/^@/, '');
                if (!handle) continue;

                // Try our own users database
                try {
                    if (client?.database?.db) {
                        const u = await new Promise((resolve) => {
                            client.database.db.get(
                                'SELECT user_id, username, full_name FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
                                [handle],
                                (err, row) => resolve(row || null)
                            );
                        });
                        if (u) {
                            const [fn, ...rest] = (u.full_name || handle).split(' ');
                            return {
                                id: String(u.user_id),
                                first_name: fn || handle,
                                last_name: rest.join(' ') || '',
                                username: u.username || handle,
                                _source: 'db',
                            };
                        }
                    }
                } catch (_) { /* ignore */ }

                // Could not resolve via DB
                return {
                    id: null,
                    username: handle,
                    first_name: handle,
                    last_name: '',
                    _unresolved: true,
                    _source: 'mention',
                };
            }
        }

        // 4) Argument: @username
        const argText = String(arg || '').trim();
        const handleMatch = argText.match(/^@([a-zA-Z0-9_]{3,})/);
        if (handleMatch) {
            const handle = handleMatch[1];
            try {
                if (client?.database?.db) {
                    const u = await new Promise((resolve) => {
                        client.database.db.get(
                            'SELECT user_id, username, full_name FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
                            [handle],
                            (err, row) => resolve(row || null)
                        );
                    });
                    if (u) {
                        const [fn, ...rest] = (u.full_name || handle).split(' ');
                        return {
                            id: String(u.user_id),
                            first_name: fn || handle,
                            last_name: rest.join(' ') || '',
                            username: u.username || handle,
                            _source: 'db',
                        };
                    }
                }
            } catch (_) { /* ignore */ }
            return {
                id: null,
                username: handle,
                first_name: handle,
                last_name: '',
                _unresolved: true,
                _source: 'arg',
            };
        }

        // 5) Numeric id
        const numMatch = argText.match(/^(\d{5,})/);
        if (numMatch) {
            const id = numMatch[1];
            // Try getChatMember to flesh out details
            try {
                const member = await client.bot.getChatMember(M.chat.id, Number(id));
                if (member?.user) {
                    return {
                        id: String(member.user.id),
                        first_name: member.user.first_name || 'User',
                        last_name: member.user.last_name || '',
                        username: member.user.username || null,
                        _source: 'numeric',
                    };
                }
            } catch (_) { /* ignore */ }
            return {
                id,
                first_name: 'User',
                last_name: '',
                username: null,
                _source: 'numeric',
            };
        }

        return null;
    } catch (err) {
        console.error('resolveTargetUser error:', err.message);
        return null;
    }
}

/**
 * Strip the resolved mention/handle/id token from the start of `arg`
 * so the remaining text can be parsed by command logic.
 */
function stripMentionFromArg(arg) {
    if (!arg) return '';
    return String(arg)
        .replace(/^@[a-zA-Z0-9_]{3,}\s*/, '')
        .replace(/^\d{5,}\s*/, '')
        .trim();
}

module.exports = { resolveTargetUser, stripMentionFromArg };
