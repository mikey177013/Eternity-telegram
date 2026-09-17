module.exports = {
  name: 'start',
  category: 'core',
  aliases: ['startbot', 'register'],
  description: 'Start the bot and register',

  async execute(client, arg, ctx) {
    const chatId = ctx.chat.id;
    const userId = ctx.from?.id;
    const chatType = ctx.chat.type;
    
    if (!userId) {
      return client.sendMessage(chatId, '❌ Unable to identify user.');
    }

    // Check if user is already registered
    const isRegistered = await client.checkUserRegistration(userId);

    if (isRegistered) {
      const userInfo = await client.getUserInfo(userId);
      const userName = userInfo?.full_name || userInfo?.username || 'User';

      return client.sendMessage(chatId,
        `💘 *Welcome back, ${userName}!*\n\n` +
        `You are already registered to our bot!\n\n` +
        `Type \`.help\` to see available commands.\n\n` +
        `*Join our official group:*\n` +
        `https://t.me/+fN1T0C9BdZ45YTU0`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📢 Join ETERNITY-BOTS',
                  url: 'https://t.me/+fN1T0C9BdZ45YTU0'
                }
              ]
            ]
          }
        }
      );
    }

    // If user is not registered and in group chat
    if (chatType !== 'private') {
      return client.sendMessage(chatId,
        `❌ *Registration Required!*\n\n` +
        `You need to register to use bot commands.\n\n` +
        `*Please message me privately to register:*\n` +
        `[@ZeroTwo_1bot](https://t.me/ZeroTwo_1bot)\n\n` +
        `*Join our official group:*\n` +
        `https://t.me/+fN1T0C9BdZ45YTU0`,
        { 
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '💠 REGISTER HERE',
                  url: 'https://t.me/ZeroTwo_1bot?start=register'
                }
              ],
              [
                {
                  text: '👾 Join ETERNITY-BOTS',
                  url: 'https://t.me/+fN1T0C9BdZ45YTU0'
                }
              ]
            ]
          }
        }
      );
    }

    // New user in private chat - show welcome with image
    await client.sendPhoto(chatId, 'https://files.catbox.moe/8zq8g9.jpg', {
      caption: `🌷 *Hello~ Welcome aboard!* 🌷\n\n` +
               `(｡•̀ᴗ-)✧ We're really glad you're here!\n` +
               `First time here? Just tap *Register New Account* ⭐\n` +
               `It only takes a moment—super simple!\n` +
               `No worries, take your time 🌼\n\n` +
               `*Join our official group:*\n` +
               `https://t.me/+fN1T0C9BdZ45YTU0`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '👾 Join ETERNITY-BOTS',
              url: 'https://t.me/+fN1T0C9BdZ45YTU0'
            }
          ]
        ]
      }
    });
  }
};