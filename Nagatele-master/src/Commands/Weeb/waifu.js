const axios = require('axios');

module.exports = {
  name: 'waifu',
  aliases: ['wifu', 'bestgirl', 'waifus'],
  category: 'weeb',
  exp: 1,
  cool: 15,
  usage: '.waifu',
  description: 'Get a random waifu image',

  async execute(client, arg, ctx) {
    try {
      const chatId = ctx.chat.id;
      const userName = ctx.from?.first_name || 'Senpai';
      
      // Show loading message
      const loadingMsg = await client.sendMessage(chatId, 
        `💖 Finding the perfect waifu for ${userName}...`
      );

      // Cute captions
      const captions = [
        `💖 Your perfect waifu has arrived, ${userName}!`,
        `🌸 Kawaii waifu for ${userName}~`,
        `✨ She's the one for you, ${userName}!`,
        `💕 Best girl material for ${userName}!`,
        `😍 Waifu detected for ${userName}!`,
        `🎀 Ultimate waifu power for ${userName}!`,
        `💫 The perfect match for ${userName}!`,
        `🌟 Divine beauty for ${userName}!`,
        `🫶 Your waifu awaits, ${userName}!`,
        `🎐 A precious waifu for ${userName}!`
      ];

      const randomCaption = captions[Math.floor(Math.random() * captions.length)];

      // Try multiple reliable APIs
      const apiAttempts = [
        {
          url: 'https://api.waifu.pics/sfw/waifu',
          parser: (data) => data.url
        },
        {
          url: 'https://nekos.best/api/v2/waifu',
          parser: (data) => data.results?.[0]?.url
        },
        {
          url: 'https://waifu.pics/api/sfw/waifu',
          parser: (data) => data.url
        },
        {
          url: 'https://api.catboys.com/img',
          parser: (data) => data.url
        }
      ];

      let imageUrl = null;
      let lastError = null;

      // Try each API in order
      for (const attempt of apiAttempts) {
        try {
          const response = await axios.get(attempt.url, { timeout: 5000 });
          
          if (response.status === 200) {
            imageUrl = attempt.parser(response.data);
            if (imageUrl) break;
          }
        } catch (error) {
          lastError = error;
          continue;
        }
      }

      if (!imageUrl) {
        throw new Error('All waifu APIs failed');
      }

      // Delete loading message
      try {
        await client.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (e) {
        // Ignore deletion errors
      }

      // Send the waifu image
      await client.sendPhoto(chatId, imageUrl, {
        caption: randomCaption,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💖 Another Waifu', callback_data: 'waifu_another' },
              { text: '⭐ Rate', callback_data: 'waifu_rate' }
            ]
          ]
        }
      });

    } catch (err) {
      console.error('Error in waifu command:', err);
      
      // Clean error message
      const errorMessage = 
        `❌ *Waifu Error!*\n\n` +
        `Failed to fetch waifu image.\n` +
        `The waifus are shy today! 💖🌸\n\n` +
        `Try again in a moment!`;
      
      await client.sendMessage(ctx.chat.id, errorMessage, { parse_mode: 'Markdown' });
    }
  }
};