const fs = require('fs');
const path = require('path');
const { parseCommand } = require('./Parser');
const AutoDownloader = require('../../Handlers/AutoDownloader');
const AfkManager = require('../../Database/afkManager');

class MessageHandler {
  constructor(client) {
    this.client = client;
    this.commands = new Map();
    this.prefix = '.';
    this.handlersLoaded = false;

    // ==================== COOLDOWN SYSTEM ====================
    // User cooldowns: {userId: lastCommandTime}
    this.userCooldowns = new Map();
    this.globalCooldown = 9000; // CHANGED: 9 seconds (from 15 seconds)

    // ==================== ANTI-SPAM SYSTEM ====================
    // CHAT-SCOPED anti-spam tracking  
    this.userMessageTimestamps = new Map(); // {chatId_userId: [timestamp1, timestamp2, ...]}  
    this.mutedUsers = new Map(); // {chatId_userId: {userId, chatId, unmuteTime, reason, isSilent}}  

    // Anti-spam configuration  
    this.antiSpamConfig = {  
      maxMessages: 5, // Max 5 messages  
      timeWindow: 3000, // Within 3 seconds  
      autoMuteDuration: 5 * 60 * 1000, // CHANGED: 5 minutes for link spam
      silentAutoMute: false, // Show mute notifications
      exemptCommands: ['start', 'help', 'menu', 'rules', 'support'] // Commands exempt from spam check
    };

    // ==================== ACTIVE MEMBERS CACHE (for @all) ====================
    // chatId -> Map<userId, {id, first_name, username}>
    this.activeMembers = new Map();
    this.activeMembersMax = 200; // per chat, LRU style

    // ==================== ALLOWED LINKS CONFIGURATION ====================
    // Links from these domains are NOT treated as spam/anti-link violations.
    // They are also automatically downloaded by AutoDownloader.
    this.allowedDomains = [
      'instagram.com', 'instagr.am', 'www.instagram.com',
      'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com',
      'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
      'open.spotify.com', 'spotify.com', 'play.spotify.com',
      'pinterest.com', 'pinterest.fr', 'pinterest.de', 'pinterest.co.uk',
      'pinterest.jp', 'pinterest.ru', 'pinterest.ca', 'pinterest.it',
      'pinterest.com.au', 'pinterest.com.mx', 'pinterest.com.br',
      'pinterest.es', 'pinterest.pl', 'pin.it',
      'github.com', 'www.github.com',
      'mediafire.com', 'www.mediafire.com',
      'twitter.com', 'x.com', 'www.twitter.com', 'www.x.com',
      'threads.net', 'threads.com', 'www.threads.net', 'www.threads.com',
      'mega.nz', 'www.mega.nz',
      'soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com'
    ];

    // CHANGED: Updated link regex to detect all links
    this.linkRegex = /(https?:\/\/|www\.)[^\s]+/gi;

    // ==================== CASINO GROUP RESTRICTION ====================
    // CHANGED: Casino commands only work in this specific group
    this.casinoGroupId = -1003690528879; // eternity games group ID
    this.casinoGroupLink = 'https://t.me/+4XZhf-OcEfFmNjM0';

    // Load handlers first  
    this.loadHandlers();  

    // Load commands dynamically  
    this.loadCommands();  

    // Setup callback query handler  
    this.setupCallbacks();  

    // Start cleanup interval for muted users  
    this.startMuteCleanup();

    // Start cooldown cleanup interval
    this.startCooldownCleanup();

    // NOTE: Help pagination callback is handled in setupCallbacks() to avoid duplicate handlers
  }

  // ==================== COOLDOWN METHODS ====================

  /**
   * Check if user is in cooldown
   * @param {number} userId - User ID
   * @returns {number|false} - Remaining cooldown in seconds or false if no cooldown
   */
  checkCooldown(userId) {
    const now = Date.now();
    const lastCommandTime = this.userCooldowns.get(userId);

    if (!lastCommandTime) return false;

    const elapsed = now - lastCommandTime;
    const remaining = this.globalCooldown - elapsed;

    if (remaining <= 0) {
      // Cooldown expired, remove it
      this.userCooldowns.delete(userId);
      return false;
    }

    return remaining;
  }

  /**
   * Set cooldown for user
   * @param {number} userId - User ID
   */
  setCooldown(userId) {
    this.userCooldowns.set(userId, Date.now());
  }

  /**
   * Format remaining time for display
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string} - Formatted time (e.g., "9.5 seconds")
   */
  formatRemainingTime(milliseconds) {
    const seconds = milliseconds / 1000;

    if (seconds >= 1) {
      // Show with 1 decimal place if less than 10 seconds
      if (seconds < 10) {
        return seconds.toFixed(1) + ' seconds';
      } else {
        return Math.ceil(seconds) + ' seconds';
      }
    } else {
      // Less than 1 second
      return '1 second';
    }
  }

  /**
   * Start cleanup interval for expired cooldowns
   */
  startCooldownCleanup() {
    setInterval(() => {
      const now = Date.now();
      const toRemove = [];

      for (const [userId, lastCommandTime] of this.userCooldowns.entries()) {
        const elapsed = now - lastCommandTime;
        if (elapsed >= this.globalCooldown) {
          toRemove.push(userId);
        }
      }

      // Remove expired cooldowns
      for (const userId of toRemove) {
        this.userCooldowns.delete(userId);
      }
    }, 60000); // Check every minute
  }

  // ==================== COMMAND SUGGESTION METHODS ====================

  /**
   * Find the closest command using Levenshtein distance
   */
  findClosestCommand(input, commands) {
    if (!input || input.trim() === '' || commands.length === 0) return null;

    let minDistance = Infinity;
    let closestCommand = null;

    const cleanInput = input.toLowerCase();

    for (const cmd of commands) {
      if (!cmd) continue;

      // Skip if command is too short
      if (cmd.length < 2) continue;

      const cmdLower = cmd.toLowerCase();
      const distance = this.levenshteinDistance(cleanInput, cmdLower);

      if (distance < minDistance) {
        minDistance = distance;
        closestCommand = cmd;
      }
    }

    // Only return if the distance is reasonably close
    // For short inputs (1-2 chars), require exact or close match
    if (input.length <= 2) {
      return minDistance <= 1 ? closestCommand : null;
    }

    return minDistance <= 3 ? closestCommand : null;
  }

  /**
   * Levenshtein distance algorithm for string similarity
   */
  levenshteinDistance(a, b) {
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Start interval to clean up expired mutes
   */
  startMuteCleanup() {
    setInterval(async () => {
      const now = Date.now();
      const toRemove = [];

      for (const [key, muteData] of this.mutedUsers.entries()) {
        if (muteData.unmuteTime && now > muteData.unmuteTime) {
          toRemove.push({ key, muteData });
        }
      }

      // Remove expired mutes
      for (const { key, muteData } of toRemove) {
        await this.actuallyUnmuteUser(muteData.chatId, muteData.userId, 'auto-unmute');
        this.mutedUsers.delete(key);
        console.log(`🔄 Auto-unmuted user ${muteData.userId} in chat ${muteData.chatId}`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Check if user is admin or owner
   */
  async isAdminOrOwner(chatId, userId) {
    try {
      const userIdStr = String(userId);

      // Owner (supports comma-separated list)
      const { isOwner, isMod } = require('../../core/permissions');
      if (isOwner(userIdStr)) return true;
      // Mods configured via .env (MODS=...) are treated like staff
      if (isMod(userIdStr)) return true;

      // Get chat administrators
      const chatAdmins = await this.client.bot.getChatAdministrators(chatId);

      // Check if user is admin
      const isAdmin = chatAdmins.some(admin => {
        const adminId = String(admin.user.id);
        return adminId === userIdStr;
      });

      return isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error.message);
      return false;
    }
  }

  /**
   * Check if a link is allowed (Instagram, TikTok, YouTube, Spotify only)
   * @param {string} url - The URL to check
   * @returns {boolean} - True if allowed, false if not allowed
   */
  isLinkAllowed(url) {
    try {
      // Convert to lowercase for comparison
      const lowerUrl = url.toLowerCase();
      
      // Check if it's any of the allowed domains
      for (const domain of this.allowedDomains) {
        if (lowerUrl.includes(domain.toLowerCase())) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking link:', error);
      return false;
    }
  }

  /**
   * Extract all links from a message
   * @param {string} text - The message text
   * @returns {Array} - Array of found links
   */
  extractLinks(text) {
    if (!text) return [];
    
    const links = [];
    let match;
    
    // Use the link regex to find all URLs
    while ((match = this.linkRegex.exec(text)) !== null) {
      links.push(match[0]);
    }
    
    return links;
  }

  /**
   * Check if message contains disallowed links
   * @param {string} text - The message text
   * @returns {boolean} - True if disallowed links found
   */
  hasDisallowedLinks(text) {
    const links = this.extractLinks(text);
    
    if (links.length === 0) {
      return false; // No links found
    }
    
    // Check each link
    for (const link of links) {
      if (!this.isLinkAllowed(link)) {
        return true; // Found at least one disallowed link
      }
    }
    
    return false; // All links are allowed
  }

  /**
   * FIXED: Check for spam - CHAT-SCOPED
   * Now exempts commands from spam check
   */
  checkSpam(chatId, userId, text) {
    // Check if it's a command (exempt from spam check)
    const isCommand = text.startsWith(this.prefix) || text.startsWith('/');
    if (isCommand) return false;

    const now = Date.now();
    const key = `${chatId}_${userId}`;

    if (!this.userMessageTimestamps.has(key)) {
      this.userMessageTimestamps.set(key, []);
    }

    const timestamps = this.userMessageTimestamps.get(key);

    // Add current timestamp
    timestamps.push(now);

    // Keep only timestamps within the time window
    const recentTimestamps = timestamps.filter(ts => now - ts <= this.antiSpamConfig.timeWindow);
    this.userMessageTimestamps.set(key, recentTimestamps);

    // Check if exceeds limit
    if (recentTimestamps.length >= this.antiSpamConfig.maxMessages) {
      // Clear timestamps after detecting spam
      this.userMessageTimestamps.delete(key);
      return true;
    }

    return false;
  }

  /**
   * Check if message contains spam link (blocks all except allowed domains)
   */
  hasSpamLink(text) {
    if (!text) return false;
    return this.hasDisallowedLinks(text);
  }

  /**
   * Check if user is muted
   */
  isUserMuted(chatId, userId) {
    const key = `${chatId}_${userId}`;
    const muteData = this.mutedUsers.get(key);

    if (!muteData) return false;

    // Check if mute has expired
    if (muteData.unmuteTime && Date.now() > muteData.unmuteTime) {
      // Auto-unmute expired mutes
      this.mutedUsers.delete(key);
      this.actuallyUnmuteUser(chatId, userId, 'auto-expired');
      return false;
    }

    return true;
  }

  /**
   * Check if command is a casino command
   * @param {string} cmdName - Command name
   * @returns {boolean} - True if casino command
   */
  isCasinoCommand(cmdName) {
    const casinoCommands = [
      'blackjack', 'bj', '21',
      'gamble', 'bet', 'roll',
      'slot', 'slots',
      'dice',
      'mine',
      'egg'
    ];
    
    return casinoCommands.includes(cmdName.toLowerCase());
  }

  /**
   * Check if casino command can be used in current chat
   * @param {string} chatId - Chat ID
   * @param {string} cmdName - Command name
   * @returns {Object} - {allowed: boolean, message: string}
   */
  checkCasinoRestriction(chatId, cmdName) {
    // Convert chatId to number for comparison
    const chatIdNum = Number(chatId);
    
    if (this.isCasinoCommand(cmdName)) {
      if (chatIdNum !== this.casinoGroupId) {
        return {
          allowed: false,
          message: `🎰 *Casino Commands Restricted*\n\n` +
                  `Casino commands like \`${cmdName}\` can only be used in our official casino group.\n\n` +
                  `Join here to play: ${this.casinoGroupLink}`
        };
      }
    }
    
    return { allowed: true, message: '' };
  }

  /**
   * FIXED: Actually unmute user (proper permission restoration)
   */
  async actuallyUnmuteUser(chatId, userId, reason = 'manual') {
    try {
      console.log(`🔓 Actually unmuting ${userId} in ${chatId} (${reason})`);

      // FIXED: Use modern Telegram API permissions
      await this.client.bot.restrictChatMember(chatId, userId, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      });

      return true;
    } catch (error) {
      console.error(`❌ Error in actuallyUnmuteUser: ${error.message}`);
      // Try simplified approach if detailed fails
      try {
        await this.client.bot.restrictChatMember(chatId, userId, {
          can_send_messages: true
        });
        return true;
      } catch (simpleError) {
        console.error(`❌ Even simple unmute failed: ${simpleError.message}`);
        return false;
      }
    }
  }

  /**
   * FIXED: Mute user with proper error handling and state management
   */
  async muteUser(chatId, userId, durationMs, reason, originalMsg = null, isSilent = false) {
    try {
      const key = `${chatId}_${userId}`;

      // Check if user is already muted
      if (this.isUserMuted(chatId, userId)) {
        console.log(`⚠️ User ${userId} is already muted in ${chatId}`);
        return { success: false, alreadyMuted: true };
      }

      // First check if target is admin (don't mute admins)
      const targetIsAdmin = await this.isAdminOrOwner(chatId, userId);
      if (targetIsAdmin) {
        console.log(`⚠️ Cannot mute user ${userId} - they are an admin!`);
        return { success: false, isAdmin: true };
      }

      const now = Date.now();
      const unmuteTime = now + durationMs;

      // Store mute data
      const muteData = {
        userId,
        chatId,
        unmuteTime,
        reason,
        mutedAt: now,
        isSilent: isSilent || this.antiSpamConfig.silentAutoMute
      };

      this.mutedUsers.set(key, muteData);

      // FIXED: Use modern Telegram API permissions
      try {
        await this.client.bot.restrictChatMember(chatId, userId, {
          until_date: Math.floor(unmuteTime / 1000),
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        });
      } catch (restrictError) {
        console.error(`❌ Restrict error: ${restrictError.message}`);
        // Try simplified
        try {
          await this.client.bot.restrictChatMember(chatId, userId, {
            until_date: Math.floor(unmuteTime / 1000),
            can_send_messages: false
          });
        } catch (simpleError) {
          console.error(`❌ Even simple mute failed: ${simpleError.message}`);
          // Remove from muted users if we couldn't restrict
          this.mutedUsers.delete(key);
          return { success: false, error: 'No bot permissions' };
        }
      }

      // Get user info for message
      let userName = 'User';
      try {
        const chatMember = await this.client.bot.getChatMember(chatId, userId);
        userName = chatMember.user.first_name || 'User';
      } catch (e) {
        if (originalMsg && originalMsg.from) {
          userName = originalMsg.from.first_name || 'User';
        }
      }

      // Format duration
      const durationMinutes = Math.floor(durationMs / 1000 / 60);
      const durationText = durationMinutes > 0 ? 
        `${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}` : 
        `${Math.floor(durationMs / 1000)} seconds`;

      // Only send mute message if not silent
      let muteMessage = null;
      if (!muteData.isSilent) {
        muteMessage = await this.client.bot.sendMessage(chatId, 
          `🔇 *${userName}* has been muted!\n\n` +
          `Reason: ${reason}\n` +
          `Duration: ${durationText}\n\n` +
          `⏰ Mute will auto-remove in ${durationText}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🔓 Unmute Now',
                  callback_data: `unmute_${userId}`
                }
              ]]
            }
          }
        );

        // Auto-delete mute message after some time
        setTimeout(async () => {
          try {
            await this.client.bot.deleteMessage(chatId, muteMessage.message_id);
          } catch (e) {
            // Ignore deletion errors
          }
        }, 30000);
      }

      console.log(`✅ Muted ${userName} (${userId}) for ${durationText} in ${chatId}`);
      return { 
        success: true, 
        muted: true,
        userName,
        durationText,
        messageId: muteMessage?.message_id
      };

    } catch (error) {
      console.error('Error in muteUser:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * FIXED: Unmute user with proper state clearing
   */
  async unmuteUser(chatId, userId, adminId) {
    try {
      const key = `${chatId}_${userId}`;

      // Check if user is actually muted
      if (!this.mutedUsers.has(key)) {
        console.log(`⚠️ User ${userId} is not muted in chat ${chatId}`);
        return { success: false, message: 'User is not muted.', notMuted: true };
      }

      // Get mute data before removing
      const muteData = this.mutedUsers.get(key);

      // Remove from muted users map FIRST
      this.mutedUsers.delete(key);

      // Actually unmute the user
      const unmuteSuccess = await this.actuallyUnmuteUser(chatId, userId, `by admin ${adminId}`);

      if (!unmuteSuccess) {
        console.error(`❌ Failed to actually unmute ${userId}`);
        return { success: false, message: 'Failed to remove restrictions.' };
      }

      // Get user info
      let userName = 'User';
      try {
        const chatMember = await this.client.bot.getChatMember(chatId, userId);
        userName = chatMember.user.first_name || 'User';
      } catch (e) {
        // Ignore
      }

      // Get admin info
      let adminName = 'Admin';
      try {
        const adminMember = await this.client.bot.getChatMember(chatId, adminId);
        adminName = adminMember.user.first_name || 'Admin';
      } catch (e) {
        // Ignore
      }

      console.log(`🔊 Successfully unmuted ${userName} (${userId}) by ${adminName} (${adminId})`);

      return { 
        success: true, 
        message: `🔊 *${userName}* has been unmuted by *${adminName}*!`,
        userName
      };

    } catch (error) {
      console.error('Error in unmuteUser:', error);
      return { success: false, message: 'Failed to unmute user.' };
    }
  }

  /**
   * Parse mute duration from string
   */
  parseMuteDuration(durationStr) {
    if (!durationStr) return this.antiSpamConfig.autoMuteDuration;

    const regex = /^(\d+)([mhd])$/i;
    const match = durationStr.match(regex);

    if (!match) {
      // Check if it's just a number (default to minutes)
      const numMatch = durationStr.match(/^(\d+)$/);
      if (numMatch) {
        return parseInt(numMatch[1]) * 60 * 1000; // Default to minutes
      }
      return this.antiSpamConfig.autoMuteDuration;
    }

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      default: return this.antiSpamConfig.autoMuteDuration;
    }
  }

  async loadHandlers() {
    try {
      console.log('🔄 Loading handlers...');

      // Load Card Handler
      try {
        const cardHandler = require('../../Handlers/card.js');
        if (typeof cardHandler === 'function') {
          await cardHandler(this.client);
          console.log('✅ Card handler loaded');
        } else {
          console.log('⚠️ card.js handler is empty/not a function — skipped');
        }
      } catch (e) {
        console.error('❌ Error loading card handler:', e.message);
      }

      // Load Clan Handler
      try {
        const clanHandler = require('../../Handlers/Clan.js');
        if (typeof clanHandler === 'function') {
          await clanHandler(this.client);
          console.log('✅ Clan handler loaded');
        } else {
          console.log('⚠️ Clan.js handler is empty/not a function — skipped');
        }
      } catch (e) {
        console.error('❌ Error loading clan handler:', e.message);
      }

      // Load Pokemon Handler explicitly (required for .enable --wild)
      try {
        const pokeHandler = require('../../Handlers/poke.js');
        if (typeof pokeHandler === 'function') {
          await pokeHandler(this.client);
          console.log('✅ Pokemon handler loaded');
        } else {
          console.log('⚠️ poke.js handler is empty/not a function — skipped');
        }
      } catch (e) {
        console.error('❌ Error loading pokemon handler:', e.message);
      }

      // Load any other handlers
      const handlersPath = path.join(__dirname, '../../Handlers');
      const handlerFiles = fs.readdirSync(handlersPath).filter(f =>
        f.endsWith('.js') && !['card.js', 'Clan.js', 'poke.js', 'AutoDownloader.js'].includes(f)
      );

      for (const file of handlerFiles) {
        try {
          const handler = require(path.join(handlersPath, file));
          if (typeof handler === 'function') {
            await handler(this.client);
            console.log(`✅ ${file.replace('.js', '')} handler loaded`);
          } else {
            console.log(`⚠️ ${file} is empty/not a function — skipped`);
          }
        } catch (error) {
          console.error(`❌ Error loading handler ${file}:`, error.message);
        }
      }

      this.handlersLoaded = true;
      console.log('✅ All handlers loaded successfully');

    } catch (error) {
      console.error('❌ Error loading handlers:', error);
    }
  }

  setupCallbacks() {
    this.client.bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;
        const chatId = msg.chat.id;

        try {
            // Handle unmute callback
            if (data.startsWith('unmute_')) {
                const targetUserId = Number(data.split('_')[1]);

                // Check if user is admin
                const isAdmin = await this.isAdminOrOwner(chatId, userId);

                if (isAdmin) {
                    const result = await this.unmuteUser(chatId, targetUserId, userId);

                    // Answer callback query
                    await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                        text: result.success ? 'User unmuted!' : 'Failed to unmute',
                        show_alert: true
                    });

                    // Send unmute message
                    if (result.success) {
                        const unmuteMsg = await this.client.bot.sendMessage(chatId, result.message, {
                            parse_mode: 'Markdown'
                        });

                        // Try to delete the original mute message
                        try {
                            await this.client.bot.deleteMessage(chatId, msg.message_id);
                        } catch (e) {
                            // Ignore
                        }

                        // Auto-delete unmute message
                        setTimeout(async () => {
                            try {
                                await this.client.bot.deleteMessage(chatId, unmuteMsg.message_id);
                            } catch (e) {
                                // Ignore
                            }
                        }, 10000);
                    }
                } else {
                    await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                        text: 'Only admins can unmute users!',
                        show_alert: true
                    });
                }
                return;
            }

            // Handle registration callback
            else if (data === 'register_callback') {
                await this.handleRegistrationCallback(chatId, userId);
                await this.client.bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            // Handle help pagination callback
            else if (data.startsWith('help_page_')) {
                const page = parseInt(data.replace('help_page_', ''));
                if (isNaN(page)) return;

                await this.client.bot.answerCallbackQuery(callbackQuery.id);

                // Fake arg so existing help logic works
                const fakeMessage = callbackQuery.message;
                fakeMessage.from = callbackQuery.from;

                const helpCommand = this.commands.get('help');
                if (helpCommand) {
                    await helpCommand.execute(this.client, `${page}`, fakeMessage, true);
                }
                return;
            }

            // =========== NEW: Handle collection pagination ===========
            else if (data.startsWith('collection_page_')) {
                await this.handleCollectionCallback(callbackQuery);
                return;
            }

            // =========== Handle leaderboard switching ===========
            else if (data.startsWith('lb_')) {
                await this.handleLeaderboardCallback(callbackQuery);
                return;
            }

            // =========== Handle premium menu pagination ===========
            else if (data.startsWith('menu_')) {
                await this.handleMenuCallback(callbackQuery);
                return;
            }

            // =========== Handle trade accept/cancel ===========
            else if (data.startsWith('trade_accept_') || data.startsWith('trade_cancel_')) {
                await this.handleTradeCallback(callbackQuery);
                return;
            }

            // Handle other callbacks...
            else if (data.startsWith('card_')) {
                const action = data.split('_')[1];
                const cardId = data.split('_')[2];

                if (action === 'deck') {
                    // Toggle card in deck
                    const result = await this.client.toggleCardInDeck?.(cardId, userId);
                    if (result?.success) {
                        await this.client.bot.sendMessage(chatId,
                            result.added ? 
                            '✅ Card added to your deck!' : 
                            '✅ Card removed from your deck!',
                            { parse_mode: 'Markdown' }
                        );
                    }
                }
            }
            else if (data === 'waifu_another') {
                const waifuCommand = this.commands.get('waifu');
                if (waifuCommand) {
                    const ctx = {
                        ...msg,
                        from: callbackQuery.from,
                        chat: { id: chatId }
                    };
                    await waifuCommand.execute(this.client, '', ctx);
                }
            }
            else if (data === 'neko_another') {
                const nekoCommand = this.commands.get('neko');
                if (nekoCommand) {
                    const ctx = {
                        ...msg,
                        from: callbackQuery.from,
                        chat: { id: chatId }
                    };
                    await nekoCommand.execute(this.client, '', ctx);
                }
            }
            else if (data.startsWith('anime_')) {
                const action = data.split('_')[1];
                if (action === 'search_another') {
                    await this.client.bot.sendMessage(chatId,
                        '🔍 *Send me the anime name you want to search:*',
                        { parse_mode: 'Markdown' }
                    );
                }
            }
            else if (data.startsWith('idn_')) {
                if (data.startsWith('idn_ban_')) {
                    const parts = data.split('_');
                    const targetUserId = parts[2];
                    const requesterId = parts[3];

                    const TARGET_ADMIN_ID = 7888844624;

                    if (userId !== TARGET_ADMIN_ID) {
                        await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                            text: '❌ Only specific admin can use this!',
                            show_alert: true
                        });
                        return;
                    }

                    await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                        text: `🚫 Ban user ${targetUserId}? Use .ban command in group.`,
                        show_alert: true
                    });
                }
                else if (data.startsWith('idn_warn_')) {
                    const parts = data.split('_');
                    const targetUserId = parts[2];
                    const requesterId = parts[3];

                    const TARGET_ADMIN_ID = 7888844624;

                    if (userId !== TARGET_ADMIN_ID) {
                        await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                            text: '❌ Only specific admin can use this!',
                            show_alert: true
                        });
                        return;
                    }

                    await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                        text: `⚠️ Warn user ${targetUserId}? Use .warn command in group.`,
                        show_alert: true
                    });
                }
            }

            // Answer all callback queries
            await this.client.bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            console.error('Callback handler error:', error);
            await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                text: '❌ Error processing request',
                show_alert: false
            });
        }
    });
  }

  /**
   * Handle trade accept/cancel inline button callbacks
   */
  async handleTradeCallback(callbackQuery) {
    try {
      const cardManager = require('../../Database/cardManager');
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id.toString();

      const isAccept = data.startsWith('trade_accept_');
      const tradeId = data.replace(isAccept ? 'trade_accept_' : 'trade_cancel_', '');

      const trade = await cardManager.getTrade(tradeId);
      if (!trade) {
        return await this.client.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Trade not found or expired',
          show_alert: true
        });
      }

      if (trade.status !== 'pending') {
        return await this.client.bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ Trade is already ${trade.status}`,
          show_alert: true
        });
      }

      if (isAccept) {
        if (String(trade.target_id) !== userId) {
          return await this.client.bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Only the trade recipient can accept this trade',
            show_alert: true
          });
        }
        const ok = await cardManager.acceptTrade(tradeId);
        if (ok) {
          await this.client.bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Trade accepted!' });
          await this.client.sendMessage(chatId,
            `✅ *Trade Confirmed!*\n\n*Trade ID:* \`${tradeId}\`\n\n🔄 Cards have been swapped successfully!`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await this.client.bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Failed to accept trade. Cards may no longer be available.',
            show_alert: true
          });
        }
      } else {
        // Cancel
        if (String(trade.proposer_id) !== userId && String(trade.target_id) !== userId) {
          return await this.client.bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Only the proposer or target can cancel',
            show_alert: true
          });
        }
        const ok = await cardManager.cancelTrade(tradeId);
        if (ok) {
          await this.client.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Trade cancelled' });
          await this.client.sendMessage(chatId, `❌ Trade \`${tradeId}\` has been cancelled.`, { parse_mode: 'Markdown' });
        } else {
          await this.client.bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Failed to cancel trade',
            show_alert: true
          });
        }
      }
    } catch (err) {
      console.error('Trade callback error:', err);
      try {
        await this.client.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Error processing trade',
          show_alert: true
        });
      } catch (_) {}
    }
  }

  /**
   * Handle leaderboard switching callback (lb_mana, lb_card, lb_pokemon)
   */
  async handleLeaderboardCallback(callbackQuery) {
    try {
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const viewerId = String(callbackQuery.from.id);

      const lbCmd = this.commands.get('leaderboard');
      if (!lbCmd?._internal) {
        await this.client.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Leaderboard module unavailable',
          show_alert: false,
        });
        return;
      }

      const type = data.replace('lb_', '');
      const {
        fetchManaLeaderboard,
        fetchCardLeaderboard,
        fetchPokemonLeaderboard,
        renderManaBoard,
        renderCardBoard,
        renderPokemonBoard,
        kbForType,
      } = lbCmd._internal;

      let body;
      if (type === 'mana') {
        body = await renderManaBoard(this.client, await fetchManaLeaderboard(), viewerId);
      } else if (type === 'card') {
        body = await renderCardBoard(this.client, await fetchCardLeaderboard(), viewerId);
      } else if (type === 'pokemon') {
        body = await renderPokemonBoard(this.client, await fetchPokemonLeaderboard(), viewerId);
      } else {
        await this.client.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Unknown board' });
        return;
      }

      try {
        await this.client.bot.editMessageText(body, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: kbForType(type),
        });
      } catch (e) {
        if (!(e.message || '').includes('message is not modified')) {
          console.log('lb edit error:', e.message);
        }
      }
      await this.client.bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error('Leaderboard callback error:', err);
      try {
        await this.client.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Error',
          show_alert: false,
        });
      } catch (_) {}
    }
  }

  /**
   * Handle premium menu pagination callback (menu_page_N, menu_close)
   */
  async handleMenuCallback(callbackQuery) {
    try {
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      if (data === 'menu_close') {
        try { await this.client.deleteMessage(chatId, messageId); } catch (_) {}
        await this.client.bot.answerCallbackQuery(callbackQuery.id, { text: 'Closed' });
        return;
      }

      const m = data.match(/^menu_page_(\d+)$/);
      if (!m) {
        await this.client.bot.answerCallbackQuery(callbackQuery.id);
        return;
      }
      const page = parseInt(m[1], 10);

      const helpCmd = this.commands.get('help');
      if (!helpCmd) {
        await this.client.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Menu not found' });
        return;
      }

      const fake = callbackQuery.message;
      fake.from = callbackQuery.from;

      await helpCmd.execute(this.client, String(page), fake, true);
      await this.client.bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error('Menu callback error:', err);
      try {
        await this.client.bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Error',
          show_alert: false,
        });
      } catch (_) {}
    }
  }

  /**
   * Handle collection pagination callback
   */
  async handleCollectionCallback(callbackQuery) {
    try {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;
        const fromName = callbackQuery.from.first_name || 'User';

        console.log(`Collection callback: ${data} from ${userId}`);

        if (data.startsWith('collection_page_')) {
            // Format: collection_page_targetUserId_pageNumber
            const parts = data.split('_');
            if (parts.length < 4) {
                await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                    text: "❌ Invalid callback data",
                    show_alert: false
                });
                return;
            }

            const targetUserId = parts[2];
            const page = parseInt(parts[3]);

            // Only allow the collection owner to use the buttons
            if (userId.toString() !== targetUserId) {
                await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                    text: "❌ This is not your collection!",
                    show_alert: true
                });
                return;
            }

            if (isNaN(page) || page < 1) {
                await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                    text: "❌ Invalid page number",
                    show_alert: false
                });
                return;
            }

            // Get the collection command
            const collectionCmd = this.commands.get('collection');
            if (!collectionCmd) {
                await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                    text: "❌ Collection command not found",
                    show_alert: false
                });
                return;
            }

            // Create a fake M object for the command
            const fakeM = {
                from: { 
                    id: targetUserId,
                    first_name: fromName,
                    username: callbackQuery.from.username
                },
                chat: { id: chatId },
                message_id: messageId
            };

            // Execute collection command in edit mode
            await collectionCmd.execute(this.client, page.toString(), fakeM, true);

            // Answer the callback query
            await this.client.bot.answerCallbackQuery(callbackQuery.id);

        } else {
            await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                text: "❌ Unknown callback",
                show_alert: false
            });
        }

    } catch (err) {
        console.error('Collection callback error:', err);
        try {
            await this.client.bot.answerCallbackQuery(callbackQuery.id, {
                text: "❌ Error processing request",
                show_alert: false
            });
        } catch (e) {
            // Ignore
        }
    }
  }

  loadCommands() {
    const basePath = path.join(__dirname, '../../Commands');

    if (!fs.existsSync(basePath)) {
      console.error('Commands directory not found:', basePath);
      return;
    }

    const commandFolders = fs.readdirSync(basePath);

    for (const folder of commandFolders) {
      const folderPath = path.join(basePath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

      for (const file of files) {
        try {
          const commandPath = path.join(folderPath, file);

          // Clear cache to ensure fresh load
          delete require.cache[require.resolve(commandPath)];

          const command = require(commandPath);

          if (command.name) {
            command.category = folder.toLowerCase();
            this.commands.set(command.name, command);

            // Register aliases
            if (command.aliases && Array.isArray(command.aliases)) {
              command.aliases.forEach(alias => {
                this.commands.set(alias, command);
              });
            }

            console.log(`✅ Loaded command: ${command.name} (${command.category})`);
          }
        } catch (error) {
          console.error(`❌ Error loading command ${file}:`, error.message);
        }
      }
    }
    console.log(`✅ Total loaded commands: ${this.commands.size}`);
  }

  async handle(ctx) {
    const msg = ctx.message || ctx;
    const text = msg.text || '';
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const messageId = msg.message_id;
    const chatType = msg.chat.type;

    // ============================================
    // CHECK IF IT'S A COMMAND
    // ============================================
    const isCommand = text.startsWith(this.prefix) || text.startsWith('/');

    // ============================================
    // COOLDOWN CHECK (EXEMPT /start, OWNERS and MODS)
    // ============================================
    if (isCommand && userId) {
      // Get command name to check if it's /start (exempt from cooldown)
      let cmdNameForCheck = '';
      if (text.startsWith(this.prefix)) {
        cmdNameForCheck = text.slice(this.prefix.length).trim().split(/ +/)[0].toLowerCase();
      } else if (text.startsWith('/')) {
        cmdNameForCheck = text.slice(1).trim().split(/ +/)[0].toLowerCase();
      }

      // Owners and mods bypass cooldown entirely
      let isStaffUser = false;
      try {
        const { isStaff } = require('../../core/permissions');
        isStaffUser = isStaff(String(userId));
      } catch (_) { /* ignore */ }

      // Only check cooldown if it's NOT the /start command AND user is not staff
      if (cmdNameForCheck !== 'start' && !isStaffUser) {
        try {
          const isRegistered = await this.client.checkUserRegistration(userId);

          if (isRegistered) {
            const remainingCooldown = this.checkCooldown(userId);
            if (remainingCooldown) {
              const timeLeft = this.formatRemainingTime(remainingCooldown);
              await this.client.sendMessage(chatId,
                `⏳ Please wait ${timeLeft} before using commands again.`,
                { parse_mode: 'Markdown' }
              );
              return; // Stop processing this command
            }
          }
        } catch (error) {
          console.error('Cooldown check error:', error);
          // Continue even if cooldown check fails
        }
      }
    }

    // ============================================
    // ANTI-LINK CHECK (GROUPS ONLY)
    // ============================================
    if (['group', 'supergroup'].includes(chatType) && userId && text) {
      // Check if user is admin/owner
      const isAdmin = await this.isAdminOrOwner(chatId, userId);

      // Staff (owner/mods) bypass all anti-link/anti-spam checks
      let isStaffUser = false;
      try {
        const { isStaff } = require('../../core/permissions');
        isStaffUser = isStaff(String(userId));
      } catch (_) { /* ignore */ }

      if (!isAdmin && !isStaffUser) {
        // FIXED: Check if user is muted FIRST
        if (this.isUserMuted(chatId, userId)) {
          try {
            await this.client.bot.deleteMessage(chatId, messageId);
          } catch (e) {
            // Ignore deletion errors
          }
          return;
        }

        // Check for disallowed links (allowed list includes
        // instagram, tiktok, youtube, spotify, pinterest, github,
        // mediafire, twitter/x, threads, mega, soundcloud — these are
        // auto-downloaded below and exempt from anti-link punishment)
        if (this.hasDisallowedLinks(text)) {
          try {
            await this.client.bot.deleteMessage(chatId, messageId);
            console.log(`🗑️ Deleted message with disallowed link from ${userId} in ${chatId}`);
          } catch (e) {
            // Ignore deletion errors
          }
          
          // Mute user for 5 minutes
          await this.muteUser(chatId, userId, 5 * 60 * 1000, 'sending disallowed links', msg, false);
          return;
        }

        // FIXED: Chat-scoped spam check (exempts commands)
        if (this.checkSpam(chatId, userId, text)) {
          await this.muteUser(chatId, userId, this.antiSpamConfig.autoMuteDuration, 'spamming (5+ messages in 3 seconds)', msg, true);
          return;
        }
      }
    }

    // ============================================
    // AUTO-DOWNLOAD FOR SUPPORTED LINKS (no prefix needed)
    // Triggered for: TikTok, Instagram, Pinterest, YouTube, GitHub,
    // MediaFire, Twitter/X, Threads, Mega, SoundCloud, Spotify, Facebook
    // ============================================
    if (!isCommand && text && userId) {
      try {
        const linkInfo = AutoDownloader.extractLink(text);
        if (linkInfo) {
          // Run auto-download asynchronously (don't block other handlers like AFK)
          AutoDownloader.processMessage(this.client, msg).catch(err => {
            console.error('AutoDownloader async error:', err.message);
          });
          // Continue processing (we still want AFK detection below)
        }
      } catch (e) {
        console.error('AutoDownloader trigger error:', e.message);
      }
    }

    // ============================================
    // AFK SYSTEM - check before further command processing
    // ============================================
    try {
      if (userId && chatId) {
        await this.handleAfk(msg, chatId, userId, text, isCommand);
      }
    } catch (e) {
      console.error('AFK handler error:', e.message);
    }

    // Log message for debugging
    if (isCommand) {
      console.log(`📩 Command: "${text}" | User: ${userId} | Chat: ${chatId} | Type: ${chatType}`);
    }

    // ============================================
    // TRACK ACTIVE MEMBERS (for @all tagging)
    // ============================================
    try {
      if (['group', 'supergroup'].includes(chatType) && userId && !msg.from?.is_bot) {
        const cKey = String(chatId);
        if (!this.activeMembers.has(cKey)) this.activeMembers.set(cKey, new Map());
        const cache = this.activeMembers.get(cKey);
        // delete-and-set so newest are last (LRU)
        cache.delete(String(userId));
        cache.set(String(userId), {
          id: userId,
          first_name: msg.from.first_name || 'User',
          username: msg.from.username || null,
        });
        if (cache.size > this.activeMembersMax) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
      }
    } catch (_) { /* ignore */ }

    // ============================================
    // GLOBAL @all TRIGGER (group owner only)
    // ============================================
    if (text && /(^|\s)@all(\s|$)/i.test(text) && ['group', 'supergroup'].includes(chatType)) {
      try {
        const tagAll = this.commands.get('all');
        if (tagAll?.runTagAll) {
          await tagAll.runTagAll(this.client, msg);
          return;
        }
      } catch (e) {
        console.log('@all trigger error:', e.message);
      }
    }

    // Update user last seen if user exists
    if (userId) {
      await this.client.updateUserLastSeen(userId);
    }

    // Handle contact message (registration) - ONLY for private chats
    if (msg.contact && chatType === 'private') {
      await this.handleContactRegistration(msg, userId, chatId, messageId);
      return;
    }

    // ============================================
    // REGISTRATION CHECK FOR ALL COMMANDS
    // ============================================

    if (isCommand) {
      // Get the command name
      let cmdName = '';
      if (text.startsWith(this.prefix)) {
        cmdName = text.slice(this.prefix.length).trim().split(/ +/)[0].toLowerCase();
      } else if (text.startsWith('/')) {
        cmdName = text.slice(1).trim().split(/ +/)[0].toLowerCase();
      }

      // Special handling for /start and .start - NO registration check and NO cooldown
      if (cmdName === 'start') {
        await this.handleStartCommand(chatId, userId, ctx);
        return;
      }

      // ============================================
      // CASINO COMMAND RESTRICTION CHECK
      // ============================================
      const casinoCheck = this.checkCasinoRestriction(chatId, cmdName);
      if (!casinoCheck.allowed) {
        await this.client.sendMessage(chatId, casinoCheck.message, {
          parse_mode: 'Markdown'
        });
        return;
      }

      // ============================================
      // REGISTRATION CHECK FOR ALL OTHER COMMANDS
      // ============================================
      try {
        const isRegistered = await this.client.checkUserRegistration(userId);

        if (!isRegistered) {
          // User is NOT registered - show registration message
          const registrationMessage = await this.client.sendMessage(chatId, 
            `⚠️ *Registration Required!*\n\n` +
            `You need to register to use bot commands.\n\n` +
            `Click the button below to register:`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { 
                    text: '📝 Register Here', 
                    url: 'https://t.me/ZeroTwo_1bot?start=register'
                  }
                ]]
              }
            }
          );

          // Auto-delete registration message after 30 seconds
          setTimeout(async () => {
            try {
              await this.client.deleteMessage(chatId, registrationMessage.message_id);
            } catch (e) {
              // Ignore
            }
          }, 30000);

          return;
        }
      } catch (error) {
        console.error('Registration check error:', error);
        // Continue execution even if registration check fails
      }
    }

    // ============================================
    // NORMAL COMMAND PROCESSING
    // ============================================

    // Parse the command with prefix
    const parsed = parseCommand(text, this.prefix);
    if (!parsed) return; // Not a command

    const { command: cmdName, args } = parsed;
    const command = this.commands.get(cmdName.toLowerCase());

    // ==================== OWNER / MOD PERMISSION CHECK ====================
    if (command && (command.category === 'dev' || command.category === 'owner' || command.category === 'casino')) {
        const { isOwner, isMod, getOwnerIds, getModIds } = require('../../core/permissions');
        const userIdStr = String(msg.from?.id || '');

        // Commands that mods are also allowed to use.
        // Mods can manage moderation actions AND gamble / casino commands.
        const modAllowed = new Set([
            'ban', 'unban', 'mute', 'unmute',
            'gamble', 'bet', 'roll', 'blackjack', 'bj',
            'dice', 'egg', 'mine', 'mines', 'slot', 'slots'
        ]);

        const cmdNameLc = (command.name || '').toLowerCase();
        const cmdAliases = Array.isArray(command.aliases)
            ? command.aliases.map(a => String(a).toLowerCase())
            : [];
        const allowMod =
            command.category === 'casino' ||
            modAllowed.has(cmdNameLc) ||
            cmdAliases.some(a => modAllowed.has(a));

        const ownerOk = isOwner(userIdStr);
        const modOk = allowMod && isMod(userIdStr);

        // For casino commands: ANY registered user can play; we only gate
        // dev/owner-only commands. So if it's a casino command and not a
        // dev/owner command, do NOT block normal users.
        const isDevOrOwner = command.category === 'dev' || command.category === 'owner';

        console.log(
            `[TG-PERM] cmd=${cmdName} cat=${command.category} user=${userIdStr} owners=${getOwnerIds().join(',')} mods=${getModIds().join(',')} ownerOk=${ownerOk} modOk=${modOk}`
        );

        if (isDevOrOwner && !(ownerOk || modOk)) {
            await this.client.sendMessage(
                chatId,
                '❌ This command can only be used by the bot owner or a mod.',
                { reply_to_message_id: messageId }
            );
            return;
        }
    }
    // ==================== END OWNER PERMISSION CHECK ====================

    if (!command) {
      // Find closest command (only 1 suggestion)
      const allCommands = Array.from(this.commands.keys());
      const closestCommand = this.findClosestCommand(cmdName, allCommands);

      if (closestCommand) {
        await this.client.sendMessage(chatId,
          `💡Did you mean: .<b>${closestCommand}</b>?`,
          { parse_mode: 'HTML' }
        );
      } else {
        await this.client.sendMessage(chatId,
          `❌ Command \`${cmdName}\` not found.`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // ============================================
    // SET COOLDOWN AFTER COMMAND VALIDATION (EXEMPT /start, OWNERS, MODS)
    // ============================================
    if (userId && cmdName !== 'start') {
      let _isStaff = false;
      try {
        const { isStaff } = require('../../core/permissions');
        _isStaff = isStaff(String(userId));
      } catch (_) { /* ignore */ }
      if (!_isStaff) this.setCooldown(userId);
    }

    // NOTE: dev / owner permission is already enforced above (see OWNER / MOD
    // PERMISSION CHECK). The old block here did a strict `userId !== ownerId`
    // comparison between a number and a string from .env which ALWAYS failed
    // in groups and produced the "only owner can use dev commands" bug for
    // the actual owner. It has been removed intentionally.

    // Execute the command with error handling
    try {
      console.log(`🚀 Executing: ${command.name} by ${userId}`);
      const enhancedCtx = {
        ...ctx,
        handler: this // Pass handler to command
      };
      await command.execute(this.client, args.join(' '), enhancedCtx);

    } catch (error) {
      console.error(`❌ Error executing ${cmdName}:`, error);

      const errorMessage = 
        `❌ *Command Error*\n\n` +
        `Command: \`${command.name}\`\n` +
        `Error: ${error.message || 'Unknown error'}\n\n` +
        `Please try again later or contact support if the issue persists.`;

      await this.client.sendMessage(chatId, errorMessage, {
        parse_mode: 'Markdown'
      });
    }
  }

  // ==================== AFK SYSTEM HANDLER ====================
  /**
   * Handle AFK detection on incoming messages:
   * 1. If sender is AFK, remove their AFK status and send welcome-back message.
   * 2. If message replies-to or mentions any AFK user, send AFK info (with cooldown).
   */
  async handleAfk(msg, chatId, userId, text, isCommand) {
    // Skip if this is the /afk command itself (handled by afk command)
    if (isCommand) {
      const cmdName = text.startsWith('/')
        ? text.slice(1).trim().split(/ +/)[0].toLowerCase()
        : text.startsWith(this.prefix)
          ? text.slice(this.prefix.length).trim().split(/ +/)[0].toLowerCase()
          : '';
      if (cmdName === 'afk') return;
    }

    // ---------- 1. Auto remove AFK if sender is AFK ----------
    try {
      const senderAfk = await AfkManager.getAfk(userId, chatId);
      if (senderAfk) {
        const removed = await AfkManager.removeAfk(userId, chatId);
        if (removed) {
          const duration = AfkManager.humanDuration(Date.now() - senderAfk.since_timestamp);
          const senderName = msg.from?.first_name || 'User';
          try {
            await this.client.bot.sendMessage(
              chatId,
              `👋 *Welcome back, ${this._escapeMd(senderName)}!*\n\n` +
              `⏰ *AFK Duration:* ${duration}\n` +
              `📩 *Mentions while AFK:* ${senderAfk.mention_count}\n` +
              `📝 *Reason:* ${senderAfk.reason || 'No reason given'}`,
              {
                parse_mode: 'Markdown',
                reply_to_message_id: msg.message_id,
              }
            );
          } catch (e) {
            // Fallback without markdown
            try {
              await this.client.bot.sendMessage(
                chatId,
                `Welcome back, ${senderName}! AFK Duration: ${duration}, Mentions: ${senderAfk.mention_count}`,
                { reply_to_message_id: msg.message_id }
              );
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.error('AFK remove error:', e.message);
    }

    // ---------- 2. Notify if user mentions or replies to AFK users ----------
    try {
      const mentionedAfkUsers = await this._getMentionedAfkUsers(msg, chatId);

      for (const afkUser of mentionedAfkUsers) {
        // Cooldown - don't spam the same AFK user mention notifications
        if (!this._afkMentionCooldown) this._afkMentionCooldown = new Map();
        const cdKey = `${chatId}_${afkUser.user_id}_${userId}`;
        const last = this._afkMentionCooldown.get(cdKey) || 0;
        if (Date.now() - last < 30 * 1000) continue; // 30s cooldown per (chat, target, mentioner)
        this._afkMentionCooldown.set(cdKey, Date.now());

        // Increment mention count
        await AfkManager.incrementMention(afkUser.user_id, chatId);

        const duration = AfkManager.humanDuration(Date.now() - afkUser.since_timestamp);
        const displayName = afkUser.first_name || `User_${afkUser.user_id}`;

        try {
          await this.client.bot.sendMessage(
            chatId,
            `💤 *${this._escapeMd(displayName)} is currently AFK*\n\n` +
            `📝 *Reason:* ${this._escapeMd(afkUser.reason || 'No reason given')}\n` +
            `⏰ *Duration:* ${duration}\n` +
            `📩 *Total Mentions:* ${afkUser.mention_count + 1}`,
            {
              parse_mode: 'Markdown',
              reply_to_message_id: msg.message_id,
            }
          );
        } catch (e) {
          try {
            await this.client.bot.sendMessage(
              chatId,
              `${displayName} is AFK. Reason: ${afkUser.reason || 'none'}. Duration: ${duration}.`,
              { reply_to_message_id: msg.message_id }
            );
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('AFK mention check error:', e.message);
    }
  }

  /**
   * Resolve which AFK users (in this chat) are addressed by msg:
   *  - reply_to_message.from.id is AFK, or
   *  - message text @username or text_mention entity matches an AFK user.
   */
  async _getMentionedAfkUsers(msg, chatId) {
    const result = [];
    const seen = new Set();

    // (a) Reply target
    const replyUserId = msg.reply_to_message?.from?.id;
    if (replyUserId) {
      const afk = await AfkManager.getAfk(replyUserId, chatId);
      if (afk && !seen.has(String(replyUserId))) {
        seen.add(String(replyUserId));
        result.push(afk);
      }
    }

    // (b) Text mentions (entities) - text_mention (no @) carries full user object
    const entities = msg.entities || msg.caption_entities || [];
    const text = msg.text || msg.caption || '';
    for (const ent of entities) {
      if (ent.type === 'text_mention' && ent.user?.id) {
        const afk = await AfkManager.getAfk(ent.user.id, chatId);
        if (afk && !seen.has(String(ent.user.id))) {
          seen.add(String(ent.user.id));
          result.push(afk);
        }
      } else if (ent.type === 'mention') {
        // @username mention
        const username = text.substr(ent.offset + 1, ent.length - 1).toLowerCase();
        if (username) {
          const afk = await AfkManager.getAfkByUsername(username, chatId);
          if (afk && !seen.has(String(afk.user_id))) {
            seen.add(String(afk.user_id));
            result.push(afk);
          }
        }
      }
    }

    return result;
  }

  _escapeMd(text) {
    if (!text) return '';
    return String(text).replace(/([_*\[\]`])/g, '\\$1');
  }

  async handleStartCommand(chatId, userId, ctx) {
    const isRegistered = await this.client.checkUserRegistration(userId);

    if (isRegistered) {
      const userInfo = await this.client.getUserInfo(userId);
      const userName = userInfo?.full_name || userInfo?.username || 'User';

      await this.client.sendMessage(chatId, 
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
    } else {
      await this.showWelcomeMessage(chatId);
    }
  }

  async showWelcomeMessage(chatId) {
    await this.client.sendPhoto(chatId, 'https://files.catbox.moe/8zq8g9.jpg', {
      caption: `🌷 *Hello~ Welcome aboard!* 🌷\n\n` +
               `(｡•̀ᴗ-)✧ We're really glad you're here!\n` +
               `First time here? Just tap *Register New Account* ⭐\n` +
               `It only takes a moment—super simple!\n` +
               `No worries, take your time 🌼`,
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: '📱 Register New Account', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  async handleContactRegistration(msg, userId, chatId, messageId) {
    try {
      const userName = msg.contact.first_name;
      const userPhone = msg.contact.phone_number;
      const userLastName = msg.contact.last_name || '';
      const fullName = userLastName ? `${userName} ${userLastName}` : userName;
      const username = msg.from?.username || null;

      // Check if already registered
      const isRegistered = await this.client.checkUserRegistration(userId);

      if (isRegistered) {
        await this.client.sendMessage(chatId,
          '💘 You are already registered! No need to register again.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Register user in database
      const registration = await this.client.registerUser(userId, username, userPhone, fullName);

      if (registration.success) {
        // Try to delete contact message for privacy
        try {
          await this.client.deleteMessage(chatId, messageId);
        } catch (deleteError) {
          // Ignore
        }

        // Send welcome message with group invite
        await this.client.sendMessage(chatId,
          `🎉 *Registration Successful!*\n\n` +
          `Welcome *${userName}* to the community! ✨\n\n` +
          `You can now use all bot commands.\n` +
          `Type \`.help\` to see available commands.\n\n` +
          `*Join our official group:*\n` +
          `https://t.me/+fN1T0C9BdZ45YTU0`,
          {
            parse_mode: 'Markdown',
            reply_markup: { 
              remove_keyboard: true,
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

      } else {
        await this.client.sendMessage(chatId,
          '❌ Registration failed. Please try again or contact support.'
        );
      }
    } catch (error) {
      console.error('❌ Registration error:', error);
      await this.client.sendMessage(chatId,
        '❌ An error occurred during registration. Please try again.'
      );
    }
  }

  async handleRegistrationCallback(chatId, userId) {
    const isRegistered = await this.client.checkUserRegistration(userId);

    if (isRegistered) {
      await this.client.sendMessage(chatId,
        '💘 You are already registered! You can start using commands.'
      );
    } else {
      await this.showWelcomeMessage(chatId);
    }
  }

  // Reload commands (for development)
  async reloadCommands() {
    console.log('🔄 Reloading commands...');
    this.commands.clear();
    this.loadCommands();
    console.log(`✅ Commands reloaded. Total: ${this.commands.size}`);
  }

  // Get command info
  getCommand(name) {
    return this.commands.get(name.toLowerCase());
  }

  // Get all commands by category
  getCommandsByCategory(category) {
    const result = [];
    for (const [name, cmd] of this.commands) {
      if (cmd.category === category && cmd.name === name) {
        result.push(cmd);
      }
    }
    return result;
  }
}

module.exports = MessageHandler;