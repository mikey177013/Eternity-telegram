const axios = require('axios');

module.exports = {
  name: 'neko',
  aliases: ['catgirl', 'nyaa', 'nya'],
  category: 'weeb',
  exp: 1,
  cool: 20,
  usage: '.neko',
  description: 'Sends random neko images',

  async execute(client, arg, ctx) {
    try {
      const chatId = ctx.chat.id;
      const userName = ctx.from?.first_name || 'Neko Lover';
      
      // Show loading message
      const loadingMsg = await client.sendMessage(chatId, `🐾 Finding a cute neko for ${userName}...`);
      
      // Try multiple APIs for better reliability
      const apis = [
        'https://api.waifu.pics/sfw/neko',
        'https://nekos.best/api/v2/neko',
        'https://nekos.life/api/v2/img/neko'
      ];
      
      let imageUrl = null;
      let error = null;
      
      // Try each API until one works
      for (const api of apis) {
        try {
          const response = await axios.get(api, { timeout: 5000 });
          
          if (api.includes('waifu.pics')) {
            if (response.data?.url) {
              imageUrl = response.data.url;
              break;
            }
          } else if (api.includes('nekos.best')) {
            if (response.data?.results?.[0]?.url) {
              imageUrl = response.data.results[0].url;
              break;
            }
          } else if (api.includes('nekos.life')) {
            if (response.data?.url) {
              imageUrl = response.data.url;
              break;
            }
          }
        } catch (apiError) {
          error = apiError;
          continue; // Try next API
        }
      }
      
      if (!imageUrl) {
        throw new Error('All neko APIs failed');
      }
      
      // Delete loading message
      try {
        await client.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (e) {
        // Ignore deletion errors
      }
      
      // Random neko phrases
      const phrases = [
        "Nyaa~ 😺",
        "Kawaii neko desu! 🐱",
        "Meow~ 💕",
        "Neko power! 🐾",
        "Cats are liquid! 💦",
        "Purrfect! 😻",
        "Senpai noticed me! 🥺",
        "Neko Neko Ni~ 🎶",
        "Cat girl supremacy! ✨",
        "Moe moe kyun! 💖"
      ];
      
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      
      // Send neko image with caption
      await client.sendPhoto(chatId, imageUrl, {
        caption: `${randomPhrase}\n\nFor: ${userName}`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🐱 Get Another Neko', callback_data: 'neko_another' },
              { text: '❤️ Like', callback_data: 'neko_like' }
            ]
          ]
        }
      });
      
    } catch (err) {
      console.error('Error in neko command:', err);
      
      const errorMessage = 
        `❌ *Neko Error!*\n\n` +
        `Failed to fetch neko image.\n` +
        `The cat girls are sleeping right now! 🐱💤\n\n` +
        `Try again in a few moments!`;
      
      await client.sendMessage(ctx.chat.id, errorMessage, { parse_mode: 'Markdown' });
    }
  }
};