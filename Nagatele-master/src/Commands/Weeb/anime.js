const axios = require('axios');

module.exports = {
  name: 'anime',
  aliases: ['ani', 'searchanime'],
  category: 'weeb',
  exp: 1,
  cool: 15,
  usage: '.anime <anime_name>',
  description: 'Get information about any anime',

  async execute(client, arg, ctx) {
    try {
      const chatId = ctx.chat.id;
      
      if (!arg) {
        return client.sendMessage(chatId,
`🌸 *Anime Search* 🌸

Please provide an anime name!

*Usage:* 
\`.anime <anime_name>\`

*Examples:*
• \`.anime One Piece\`
• \`.anime Naruto\`
• \`.anime Attack on Titan\`

*Available Aliases:* 
\`.ani\`, \`.searchanime\``,
          { parse_mode: 'Markdown' }
        );
      }

      // Show loading message
      const loadingMsg = await client.sendMessage(chatId, `🔍 Searching for "${arg}"...`);

      // Search for anime using Jikan API (MyAnimeList)
      const searchUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(arg)}&limit=1`;
      
      const response = await axios.get(searchUrl);
      const data = response.data;

      if (!data.data || data.data.length === 0) {
        await client.sendMessage(chatId, 
          `❌ No anime found for *"${arg}"*\n\nTry searching with a different name!`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const anime = data.data[0];
      
      // Format the anime info
      let text = `🌸 *${anime.title}* 🌸\n`;
      text += `├─────────────────\n`;
      text += `│ *English:* ${anime.title_english || 'N/A'}\n`;
      text += `│ *Japanese:* ${anime.title_japanese || 'N/A'}\n`;
      text += `│ *Type:* ${anime.type}\n`;
      text += `│ *Episodes:* ${anime.episodes || '?'}\n`;
      text += `│ *Status:* ${anime.status}\n`;
      text += `│ *Aired:* ${anime.aired.string}\n`;
      text += `│ *Score:* ⭐ ${anime.score || 'N/A'} (${anime.scored_by || 0} users)\n`;
      text += `│ *Rank:* #${anime.rank || 'N/A'}\n`;
      text += `│ *Popularity:* #${anime.popularity || 'N/A'}\n`;
      text += `│ *Rating:* ${anime.rating || 'N/A'}\n`;
      text += `│ *Source:* ${anime.source || 'N/A'}\n`;
      text += `│ *Season:* ${anime.season || 'N/A'} ${anime.year || ''}\n`;
      text += `│ *Duration:* ${anime.duration}\n`;
      
      if (anime.genres && anime.genres.length > 0) {
        const genres = anime.genres.map(g => g.name).join(', ');
        text += `│ *Genres:* ${genres}\n`;
      }
      
      if (anime.studios && anime.studios.length > 0) {
        const studios = anime.studios.map(s => s.name).join(', ');
        text += `│ *Studios:* ${studios}\n`;
      }
      
      text += `└─────────────────\n\n`;
      
      // Truncate synopsis if too long
      let synopsis = anime.synopsis || 'No synopsis available.';
      if (synopsis.length > 500) {
        synopsis = synopsis.substring(0, 500) + '...';
      }
      text += `📖 *Synopsis:*\n${synopsis}\n\n`;
      
      // Add MyAnimeList link
      text += `🔗 *MyAnimeList:* ${anime.url}`;
      
      // Delete loading message
      try {
        await client.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (e) {
        console.log('Could not delete loading message:', e.message);
      }
      
      // Send anime info with image
      if (anime.images?.jpg?.large_image_url) {
        const imageUrl = anime.images.jpg.large_image_url;
        
        try {
          await client.sendPhoto(chatId, imageUrl, {
            caption: text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🎬 Trailer', url: anime.trailer?.url || anime.url },
                  { text: '📖 MAL Page', url: anime.url }
                ],
                [
                  { text: '🔍 Search Another', callback_data: 'anime_search_another' }
                ]
              ]
            }
          });
        } catch (photoError) {
          // If photo fails, send text only
          await client.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🎬 Trailer', url: anime.trailer?.url || anime.url },
                  { text: '📖 MAL Page', url: anime.url }
                ]
              ]
            }
          });
        }
      } else {
        // No image available
        await client.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }

    } catch (err) {
      console.error('Error in anime command:', err);
      
      // Check if chatId is available
      const chatId = ctx?.chat?.id;
      if (chatId) {
        await client.sendMessage(chatId, 
          `❌ *Error!*\n` +
          `Failed to fetch anime information.\n` +
          `Error: ${err.message || 'API not responding'}\n\n` +
          `Try again later or check the anime name.`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }
};