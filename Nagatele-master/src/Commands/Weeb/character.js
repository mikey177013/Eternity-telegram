const axios = require('axios');

module.exports = {
  name: 'character',
  aliases: ['char', 'chara'],
  category: 'weeb',
  exp: 1,
  cool: 20,
  usage: '.character <character_name>',
  description: 'Get information about anime characters',

  async execute(client, arg, ctx) {
    try {
      const chatId = ctx.chat.id;
      
      if (!arg) {
        return client.sendMessage(chatId,
`🌸 *Anime Character Search* 🌸

Search for any anime character!

*Usage:*
\`.character <name>\`

*Examples:*
• \`.character Naruto Uzumaki\`
• \`.character Luffy\`
• \`.character Goku\`
• \`.character Mikasa\`

*Aliases:* \`.char\`, \`.chara\``,
          { parse_mode: 'Markdown' }
        );
      }

      // Show loading message
      const loadingMsg = await client.sendMessage(chatId, `🔍 Searching for "${arg}"...`);
      
      // Search for character using AniList API
      const query = `
        query ($search: String) {
          Character(search: $search) {
            id
            name {
              full
              native
            }
            image {
              large
            }
            description(asHtml: false)
            age
            gender
            bloodType
            dateOfBirth {
              year
              month
              day
            }
            media {
              nodes {
                title {
                  romaji
                  english
                }
              }
            }
            favourites
            siteUrl
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

      const character = response.data.data.Character;
      
      if (!character) {
        await client.sendMessage(chatId, 
          `❌ No character found for *"${arg}"*\n\nTry a different name!`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Format character info
      let text = `🎭 *${character.name.full}* 🎭\n`;
      text += `├─────────────────\n`;
      
      if (character.name.native) {
        text += `│ *Native Name:* ${character.name.native}\n`;
      }
      
      if (character.age) {
        text += `│ *Age:* ${character.age}\n`;
      }
      
      if (character.gender) {
        text += `│ *Gender:* ${character.gender}\n`;
      }
      
      if (character.bloodType) {
        text += `│ *Blood Type:* ${character.bloodType}\n`;
      }
      
      if (character.dateOfBirth) {
        const { year, month, day } = character.dateOfBirth;
        if (month && day) {
          text += `│ *Birthday:* ${month}/${day}${year ? `/${year}` : ''}\n`;
        }
      }
      
      if (character.favourites) {
        text += `│ *Favorites:* ${character.favourites.toLocaleString()} ❤️\n`;
      }
      
      if (character.media?.nodes?.length > 0) {
        const animeNames = character.media.nodes
          .slice(0, 3)
          .map(m => m.title.romaji || m.title.english)
          .filter(Boolean);
        if (animeNames.length > 0) {
          text += `│ *Anime:* ${animeNames.join(', ')}\n`;
        }
      }
      
      text += `└─────────────────\n\n`;
      
      // Format description
      if (character.description) {
        let description = character.description
          .replace(/<br>/g, '\n')
          .replace(/<i>/g, '*')
          .replace(/<\/i>/g, '*')
          .replace(/<b>/g, '**')
          .replace(/<\/b>/g, '**');
        
        // Truncate if too long
        if (description.length > 800) {
          description = description.substring(0, 800) + '...';
        }
        
        text += `📖 *Description:*\n${description}\n\n`;
      }
      
      // Add AniList link
      if (character.siteUrl) {
        text += `🔗 *AniList:* ${character.siteUrl}`;
      }
      
      // Delete loading message
      try {
        await client.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (e) {
        // Ignore deletion errors
      }
      
      // Send character info with image
      if (character.image?.large) {
        try {
          await client.sendPhoto(chatId, character.image.large, {
            caption: text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📖 AniList Page', url: character.siteUrl },
                  { text: '🔍 Search Another', callback_data: 'character_search' }
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
                  { text: '📖 AniList Page', url: character.siteUrl }
                ]
              ]
            }
          });
        }
      } else {
        // No image available
        await client.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📖 AniList Page', url: character.siteUrl }
              ]
            ]
          }
        });
      }

    } catch (err) {
      console.error('Error in character command:', err);
      
      const errorMessage = 
        `❌ *Error!*\n` +
        `Failed to fetch character information.\n\n` +
        `*Possible reasons:*\n` +
        `• Character not found\n` +
        `• API is temporarily unavailable\n` +
        `• Network issues\n\n` +
        `Try again in a few moments!`;
      
      await client.sendMessage(ctx.chat.id, errorMessage, { parse_mode: 'Markdown' });
    }
  }
};