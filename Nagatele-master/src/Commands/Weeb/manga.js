const axios = require('axios');

module.exports = {
  name: 'manga',
  aliases: ['mg', 'mangasearch'],
  category: 'weeb',
  exp: 1,
  cool: 15,
  usage: '.manga <manga_name>',
  description: 'Search for manga information',

  async execute(client, arg, ctx) {
    try {
      const chatId = ctx.chat.id;
      
      if (!arg) {
        return client.sendMessage(chatId,
`📚 *Manga Search* 📚

Search for any manga series!

*Usage:*
\`.manga <name>\`

*Examples:*
• \`.manga One Piece\`
• \`.manga Naruto\`
• \`.manga Attack on Titan\`
• \`.manga Berserk\`

*Aliases:* \`.mg\`, \`.mangasearch\``,
          { parse_mode: 'Markdown' }
        );
      }

      // Show loading message
      const loadingMsg = await client.sendMessage(chatId, `🔍 Searching for "${arg}"...`);
      
      // Search for manga using AniList API
      const query = `
        query ($search: String) {
          Media(search: $search, type: MANGA) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              extraLarge
              large
            }
            bannerImage
            description(asHtml: false)
            status
            chapters
            volumes
            genres
            averageScore
            meanScore
            popularity
            favourites
            rankings {
              rank
              type
            }
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            format
            source
            staff {
              edges {
                node {
                  name {
                    full
                  }
                  role
                }
              }
            }
            siteUrl
            isAdult
          }
        }
      `;
      
      const variables = {
        search: arg
      };

      const response = await axios.post('https://graphql.anilist.co', {
        query,
        variables
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const manga = response.data.data.Media;
      
      if (!manga) {
        await client.sendMessage(chatId, 
          `❌ No manga found for *"${arg}"*\n\nTry a different title!`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Format manga info
      let text = `📚 *${manga.title.romaji}* 📚\n`;
      text += `├─────────────────\n`;
      
      if (manga.title.english) {
        text += `│ *English:* ${manga.title.english}\n`;
      }
      
      if (manga.title.native) {
        text += `│ *Japanese:* ${manga.title.native}\n`;
      }
      
      text += `│ *Format:* ${manga.format}\n`;
      text += `│ *Status:* ${manga.status}\n`;
      
      if (manga.chapters) {
        text += `│ *Chapters:* ${manga.chapters}\n`;
      }
      
      if (manga.volumes) {
        text += `│ *Volumes:* ${manga.volumes}\n`;
      }
      
      if (manga.genres && manga.genres.length > 0) {
        text += `│ *Genres:* ${manga.genres.slice(0, 5).join(', ')}\n`;
      }
      
      if (manga.averageScore) {
        text += `│ *Score:* ⭐ ${manga.averageScore}/100\n`;
      }
      
      if (manga.popularity) {
        text += `│ *Popularity:* #${manga.popularity}\n`;
      }
      
      if (manga.favourites) {
        text += `│ *Favorites:* ${manga.favourites.toLocaleString()} ❤️\n`;
      }
      
      // Find ranking
      const ranking = manga.rankings?.find(r => r.type === 'RATED') || manga.rankings?.[0];
      if (ranking) {
        text += `│ *Rank:* #${ranking.rank}\n`;
      }
      
      // Format dates
      const startDate = manga.startDate;
      const endDate = manga.endDate;
      
      if (startDate.year) {
        let startStr = `${startDate.year}`;
        if (startDate.month) startStr += `-${startDate.month}`;
        if (startDate.day) startStr += `-${startDate.day}`;
        text += `│ *Start:* ${startStr}\n`;
      }
      
      if (endDate.year) {
        let endStr = `${endDate.year}`;
        if (endDate.month) endStr += `-${endDate.month}`;
        if (endDate.day) endStr += `-${endDate.day}`;
        text += `│ *End:* ${endStr}\n`;
      } else if (manga.status === 'RELEASING') {
        text += `│ *End:* Ongoing\n`;
      }
      
      text += `└─────────────────\n\n`;
      
      // Format description
      if (manga.description) {
        let description = manga.description
          .replace(/<br>/g, '\n')
          .replace(/<i>/g, '*')
          .replace(/<\/i>/g, '*')
          .replace(/<b>/g, '**')
          .replace(/<\/b>/g, '**')
          .replace(/<[^>]*>/g, ''); // Remove any remaining HTML
        
        // Truncate if too long
        if (description.length > 800) {
          description = description.substring(0, 800) + '...';
        }
        
        text += `📖 *Synopsis:*\n${description}\n\n`;
      }
      
      // Add warning for adult content
      if (manga.isAdult) {
        text += `⚠️ *Note:* This manga contains adult content\n\n`;
      }
      
      // Add AniList link
      text += `🔗 *AniList:* ${manga.siteUrl}`;
      
      // Delete loading message
      try {
        await client.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (e) {
        // Ignore deletion errors
      }
      
      // Send manga info with cover image
      if (manga.coverImage?.extraLarge || manga.coverImage?.large) {
        const coverUrl = manga.coverImage.extraLarge || manga.coverImage.large;
        
        try {
          await client.sendPhoto(chatId, coverUrl, {
            caption: text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📖 AniList Page', url: manga.siteUrl },
                  { text: '🔍 Search Another', callback_data: 'manga_search' }
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
                  { text: '📖 AniList Page', url: manga.siteUrl }
                ]
              ]
            }
          });
        }
      } else {
        // No cover image available
        await client.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📖 AniList Page', url: manga.siteUrl }
              ]
            ]
          }
        });
      }

    } catch (err) {
      console.error('Error in manga command:', err);
      
      const errorMessage = 
        `❌ *Error!*\n` +
        `Failed to fetch manga information.\n\n` +
        `*Error:* ${err.message || 'Unknown error'}\n\n` +
        `Try again in a few moments!`;
      
      await client.sendMessage(ctx.chat.id, errorMessage, { parse_mode: 'Markdown' });
    }
  }
};