module.exports = {
  name: 'rule',
  aliases: ['rules', 'constitution'],
  category: 'core',
  description: 'Show bot rules and constitution',

  async execute(client, arg, M) {
    const chatId = M.chat.id;

    const rulesText =
      `*⚖️ BOT RULES & CONSTITUTION*\n\n` +
      `*Please read and follow these rules carefully:*\n\n` +
      `1️⃣ *Do not spam* the bot with repeated commands\n` +
      `2️⃣ *Do not abuse or exploit* any bot feature\n` +
      `3️⃣ *Respect other users* while using the bot in groups\n` +
      `4️⃣ *No illegal activities* using this bot\n` +
      `5️⃣ *Do not attempt to break, crash, or bypass* the bot\n` +
      `6️⃣ *No NSFW, hate, or toxic behavior*\n` +
      `7️⃣ *Follow Telegram Terms of Service* at all times\n` +
      `8️⃣ *Admins & Owner decisions are final*\n\n` +
      `*Violation of rules may result in ban or blacklist.*\n\n` +
      `~Regards,\n*ZeroTwo* 💮`;

    const gifUrl = 'https://files.catbox.moe/dy4xxs.gif';

    try {
      await client.sendAnimation(
        chatId,
        gifUrl,
        {
          caption: rulesText,
          parse_mode: 'Markdown'
        }
      );
    } catch (err) {
      console.error('RULE CMD ERROR:', err);

      // Fallback (in case Telegram blocks animation)
      await client.sendMessage(chatId, rulesText, {
        parse_mode: 'Markdown'
      });
    }
  }
};