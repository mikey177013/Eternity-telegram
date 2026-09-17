// src/Commands/Moderation/tagall.js
// Tag every member of the group.
//
// Telegram API limitation: there is NO official "get all members" endpoint for
// regular groups/supergroups. Bots can only enumerate admins via
// getChatAdministrators. To work around this, we maintain an "active members"
// LRU cache in MessageHandler (this.activeMembers), populated as users send
// messages. The tagall command tags everyone in that cache (plus admins).

module.exports = {
  name: 'tagall',
  aliases: ['all', 'everyone', 'mentionall'],
  category: 'moderation',
  exp: 5,
  cool: 30,
  description: 'Mention every active member of the group',
  usage: '.tagall [message]',

  /**
   * Programmatic entry for triggers like "@all" in plain text (called from MessageHandler).
   */
  async runTagAll(client, M, message = '') {
    return runTagAllImpl(client, M, message);
  },

  async execute(client, args, M) {
    const message = (args || '').trim();
    return runTagAllImpl(client, M, message);
  },
};

async function runTagAllImpl(client, M, message) {
  const chatId = M.chat.id;
  const chatType = M.chat.type;

  // Group only
  if (!['group', 'supergroup'].includes(chatType)) {
    try {
      await client.sendMessage(chatId, '❌ This command can only be used in groups.', {
        reply_to_message_id: M.message_id,
      });
    } catch (_) {}
    return;
  }

  // Admin / owner check (mods + group admins allowed)
  let isAdmin = false;
  try {
    const handler = client.handler;
    if (handler?.isAdminOrOwner) {
      isAdmin = await handler.isAdminOrOwner(chatId, M.from.id);
    }
  } catch (_) {}

  if (!isAdmin) {
    try {
      await client.sendMessage(chatId, '❌ Only admins can use this command.', {
        reply_to_message_id: M.message_id,
      });
    } catch (_) {}
    return;
  }

  // ---- Build target list ----
  const targets = new Map(); // id -> { id, first_name, username }
  let totalCount = 0;

  // 1) Active members cache from MessageHandler
  try {
    const handler = client.handler;
    if (handler?.activeMembers) {
      const cKey = String(chatId);
      const cache = handler.activeMembers.get(cKey);
      if (cache) {
        for (const [id, info] of cache.entries()) {
          if (info && id && !targets.has(String(id))) {
            targets.set(String(id), info);
          }
        }
      }
    }
  } catch (_) {}

  // 2) Add chat administrators (always reachable via API)
  try {
    const admins = await client.bot.getChatAdministrators(chatId);
    for (const admin of admins || []) {
      const u = admin.user;
      if (!u || u.is_bot) continue;
      if (!targets.has(String(u.id))) {
        targets.set(String(u.id), {
          id: u.id,
          first_name: u.first_name || 'Admin',
          username: u.username || null,
        });
      }
    }
  } catch (e) {
    console.log('tagall: getChatAdministrators failed:', e.message);
  }

  try {
    totalCount = await client.bot.getChatMemberCount(chatId);
  } catch (_) { totalCount = targets.size; }

  if (targets.size === 0) {
    try {
      await client.sendMessage(
        chatId,
        '⚠️ I do not have any members cached yet. Please wait until people send messages, then try again.',
        { reply_to_message_id: M.message_id }
      );
    } catch (_) {}
    return;
  }

  // ---- Build tag message ----
  const senderName = M.from?.first_name || 'Admin';
  const header =
    `📢 *Tagging all active members*\n` +
    `👤 *By:* ${escapeMd(senderName)}\n` +
    `👥 *Tagged:* ${targets.size}${totalCount ? ` / ${totalCount}` : ''}\n` +
    (message ? `📝 *Message:* ${escapeMd(message)}\n` : '') +
    `\n`;

  // Telegram message length limit: ~4096 chars. Send in chunks of ~50 mentions.
  const allTargets = Array.from(targets.values());
  const CHUNK_SIZE = 50;

  // Reply to the replied-to message if any, otherwise to the trigger
  const replyTargetId = M.reply_to_message?.message_id || M.message_id;

  for (let i = 0; i < allTargets.length; i += CHUNK_SIZE) {
    const chunk = allTargets.slice(i, i + CHUNK_SIZE);
    const mentions = chunk
      .map(u => formatMention(u))
      .join(' ');

    const body = (i === 0 ? header : '') + mentions;

    try {
      await client.bot.sendMessage(chatId, body, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_to_message_id: i === 0 ? replyTargetId : undefined,
      });
    } catch (e) {
      // Fallback: plain text (no markdown), no reply
      try {
        const plain = (i === 0 ? `Tagging all (${allTargets.length}) by ${senderName}${message ? ': ' + message : ''}\n\n` : '')
          + chunk.map(u => u.username ? `@${u.username}` : `${u.first_name}`).join(' ');
        await client.bot.sendMessage(chatId, plain);
      } catch (_) {}
    }

    // Small delay to avoid Telegram flood limits
    await new Promise(r => setTimeout(r, 600));
  }
}

function formatMention(u) {
  if (!u || !u.id) return '';
  if (u.username) return `@${u.username}`;
  const name = (u.first_name || 'User').replace(/[\[\]]/g, '').slice(0, 20);
  // tg:// inline mention works even without a username
  return `[${escapeMd(name)}](tg://user?id=${u.id})`;
}

function escapeMd(text) {
  if (!text) return '';
  return String(text).replace(/([_*\[\]`])/g, '\\$1');
}
