const axios = require('axios');
const moment = require('moment-timezone');

module.exports = {
  name: 'help',
  aliases: ['menu', 'h', 'cmds', 'commands'],
  category: 'core',
  cool: 10,
  exp: 5,
  description: 'Displays command menu with pagination',

  async execute(client, arg, M, isEdit = false) {
    try {
      const userId = M.from?.id || M.from;
      const userTag = M.from?.username ? `@${M.from.username}` : `User_${userId}`;
      const prefix = client.handler?.prefix || '.';

      // Get all commands
      const allCommands = Array.from(client.handler?.commands?.values() || []);
      const uniqueCommands = [];
      const seen = new Set();
      const isOwner = userId.toString() === process.env.OWNER_ID;

      for (const cmd of allCommands) {
        if (cmd.category === 'dev' && !isOwner) continue;
        if (!seen.has(cmd.name)) {
          seen.add(cmd.name);
          uniqueCommands.push(cmd);
        }
      }

      // Group commands by category
      const categories = {};
      uniqueCommands.forEach(cmd => {
        const category = cmd.category || 'uncategorized';
        if (!categories[category]) categories[category] = [];
        categories[category].push(cmd);
      });

      // Runtime
      const startTime = client.startTime || Date.now();
      const runtime = Date.now() - startTime;
      const days = Math.floor(runtime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((runtime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((runtime % (1000 * 60 * 60)) / (1000 * 60));
      const runtimeStr = `${days}d ${hours}h ${minutes}m`;

      // Category emojis
      const categoryEmojis = {
        ai: '👾', cards: '🃏', clan: '🏰', converter: '🔮', core: '💠',
        economy: '📈', casino: '🎰', pokemon: '🐣', fun: '🎭', media: '📷',
        moderation: '🔐', utils: '🛠️', events: '✨', relation: '💘', weeb: '🏮'
      };

      // Define category pages
      const categoryPages = [
        ['core', 'cards', 'economy'],        // Page 1
        ['fun', 'media', 'moderation'],      // Page 2
        ['utils', 'weeb']                    // Page 3
      ];

      // Auto-add any new categories into last page
      const allCategoryKeys = Object.keys(categories);
      const listedCategories = categoryPages.flat();
      const extraCategories = allCategoryKeys.filter(c => !listedCategories.includes(c));
      if (extraCategories.length) {
        if (!categoryPages[categoryPages.length - 1]) categoryPages.push([]);
        categoryPages[categoryPages.length - 1].push(...extraCategories);
      }

      // Determine page number
      let page = 1;
      const pageMatch = arg?.match(/page\s*(\d+)/i);
      if (pageMatch) page = parseInt(pageMatch[1]);
      else if (arg && !isNaN(arg)) page = parseInt(arg);
      page = Math.max(1, Math.min(page, categoryPages.length));

      const pageCategories = categoryPages[page - 1];

      // Build menu text
      let menuText = `╭─────────────┈\n`;
      menuText += `│● USER: ${userTag}\n`;
      menuText += `│● NAME: Eternity\n`;
      menuText += `│● PREFIX: ${prefix}\n`;
      menuText += `│● OWNER: phoenix\n`;
      menuText += `│● COMMANDS: ${uniqueCommands.length}\n`;
      menuText += `│● TOTAL USERS: [To be implemented]\n`;
      menuText += `│● RUNTIME: ${runtimeStr}\n\n`;
      menuText += `┈──┈─── Eternity ───┈──\n\n`;

      pageCategories.forEach(category => {
        const emoji = categoryEmojis[category] || '•';
        const commands = categories[category] || [];
        if (!commands.length) return;

        menuText += `╭ ${emoji}「${category.toUpperCase()}」${emoji}\n`;
        const cmdNames = commands.map(cmd => cmd.name.toLowerCase()).join(', ');
        menuText += `${cmdNames}\n\n`;
      });

      menuText += `📄 Page ${page} of ${categoryPages.length}\n`;
      menuText += `┌────────────┈❅\n`;
      menuText += `│   🎴 ZeroTwo\n`;
      menuText += `│   ㉿ ETERNITY-BOTS\n`;
      menuText += `└────────────┈⁂\n`;
      menuText += `❅┈ HAVE A GREAT DAY ┈❅`;

      // Buttons
      const buttons = [];
      if (page > 1) buttons.push({ text: '◀️ Previous', callback_data: `help_page_${page - 1}` });
      if (page < categoryPages.length) buttons.push({ text: 'Next ▶️', callback_data: `help_page_${page + 1}` });
      const inline_keyboard = [];
      if (buttons.length) inline_keyboard.push(buttons);

      // GIF for every page
      const gifUrl = 'https://files.catbox.moe/446g58.gif';
      
      if (isEdit && M.message_id) {
        // Edit existing message (pagination)
        try {
          await client.bot.editMessageCaption(menuText, {
            chat_id: M.chat.id,
            message_id: M.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
          });
        } catch {
          // Fallback if message has no media
          await client.bot.editMessageText(menuText, {
            chat_id: M.chat.id,
            message_id: M.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
          });
        }
      } else {
        // First help message
        try {
          await client.sendAnimation(M.chat.id, gifUrl, {
            caption: menuText,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
          });
        } catch (error) {
          // fallback text only
          await client.sendMessage(M.chat.id, menuText, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
          });
        }
      }

      if (!client.startTime) client.startTime = Date.now();

    } catch (err) {
      console.error('Help command error:', err);
      await client.sendMessage(M.chat.id, `❌ Error loading help menu: ${err.message || 'Unknown error'}`);
    }
  }
};
