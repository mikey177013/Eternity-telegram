// src/Commands/Core/afk.js
// AFK (Away From Keyboard) command
// Usage:
//   /afk
//   /afk <reason>
// Auto-removal and mention notifications are handled in MessageHandler.handleAfk()

const AfkManager = require('../../Database/afkManager');

module.exports = {
  name: 'afk',
  aliases: ['away'],
  category: 'core',
  exp: 5,
  cool: 4,
  description: 'Mark yourself as Away From Keyboard (AFK)',
  usage: '.afk [reason]',

  async execute(client, arg, M) {
    try {
      const userId = M.from?.id;
      const chatId = M.chat?.id;
      if (!userId || !chatId) return;

      const reason = (arg || '').trim() || 'No reason given';
      const userInfo = {
        username: M.from?.username || null,
        first_name: M.from?.first_name || 'User',
      };

      // Check if already AFK in this chat
      const existing = await AfkManager.getAfk(userId, chatId);

      // Save AFK status
      await AfkManager.setAfk(userId, chatId, reason, userInfo);

      const displayName = userInfo.first_name;
      const action = existing ? '✏️ *AFK Updated*' : '💤 *Now AFK*';

      const text =
        `${action}\n\n` +
        `👤 *User:* ${escapeMd(displayName)}\n` +
        `📝 *Reason:* ${escapeMd(reason)}\n` +
        `⏰ *Since:* just now\n\n` +
        `_Send any message to remove your AFK status._`;

      try {
        await client.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_to_message_id: M.message_id,
        });
      } catch (e) {
        // Fallback without markdown
        await client.sendMessage(
          chatId,
          `${existing ? 'AFK updated' : 'You are now AFK'} — ${displayName}\nReason: ${reason}`,
          { reply_to_message_id: M.message_id }
        );
      }
    } catch (err) {
      console.error('AFK command error:', err);
      try {
        await client.sendMessage(M.chat.id, `❌ Failed to set AFK: ${err.message || 'Unknown error'}`);
      } catch (_) {}
    }
  },
};

function escapeMd(text) {
  if (!text) return '';
  return String(text).replace(/([_*\[\]`])/g, '\\$1');
}
