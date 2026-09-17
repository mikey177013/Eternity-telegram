const TelegramBot = require('node-telegram-bot-api');
const MessageHandler = require('./MessageHandler');
const Database = require('../../Database/setup');

class TelegramClient {
    constructor(token) {
        // Don't start polling immediately
        this.bot = new TelegramBot(token, {
            polling: false, // Set to false, we'll start manually
            onlyFirstMatch: true,
            request: {
                timeout: 60000
            }
        });

        // Create MessageHandler and link it to this client
        this.handler = new MessageHandler(this);
        this.handler.client = this; // Ensure handler has client reference

        this.database = new Database();
        this.startTime = Date.now();
        this.isPolling = false;
        this.telegram = this.bot; // Add this alias for compatibility
        this.restarting = false;

        // Welcome Handler (will be initialized in start)
        this.welcomeHandler = null;
    }

    async start() {
        console.log('🤖 Starting Telegram Bot...');

        try {
            // First, close any existing webhook (just in case)
            try {
                await this.bot.deleteWebHook();
                console.log('✅ Webhook cleared');
            } catch (e) {
                // Ignore if no webhook
            }

            // Wait a bit to ensure any previous instance is gone
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Now start polling
            this.isPolling = true;
            this.bot.startPolling();
            console.log('✅ Polling started');

        } catch (error) {
            console.error('❌ Failed to start polling:', error.message);
            // Try one more time after delay
            await new Promise(resolve => setTimeout(resolve, 5000));
            this.bot.startPolling();
        }

        // ==================== CRITICAL: REGISTER EVENT LISTENERS FIRST ====================
        await this.registerEventListeners();

        this.bot.on('message', async (msg) => {
            try {
                await this.handler.handle(msg);
            } catch (error) {
                console.error('Unhandled error in message handler:', error);
            }
        });

        this.bot.on('polling_error', (error) => {
            // If it's a 409 conflict, try to restart polling
            if (error.message.includes('409 Conflict')) {
                console.error('⚠️ 409 Conflict detected - restarting polling...');
                this.restartPolling();
            } else {
                console.error('🔴 Telegram polling error:', error.message || error);
            }
        });

        this.bot.on('error', (error) => {
            console.error('🔴 Telegram bot error:', error);
        });

        console.log('✅ Telegram Bot started successfully!');
        console.log(`⏰ Bot started at: ${new Date().toLocaleString()}`);

        // Initialize Welcome Handler
        await this.initializeWelcomeHandler();

        // Initialize any other startup tasks
        await this.initializeBot();
    }

    // ==================== EVENT LISTENERS FOR WELCOME/GOODBYE ====================

    async registerEventListeners() {
        console.log('📝 Registering event listeners...');

        // Listen for new chat members - CRITICAL: Must use proper event name
        this.bot.on('new_chat_members', async (msg) => {
            console.log('👋 New member detected:', msg.new_chat_members?.map(m => m.first_name).join(', '));
            try {
                if (this.welcomeHandler) {
                    await this.welcomeHandler.handleNewMembers(msg);
                } else {
                    console.log('⚠️ Welcome handler not ready yet');
                }
            } catch (error) {
                console.error('❌ Error handling new members:', error);
            }
        });

        // Listen for left chat members
        this.bot.on('left_chat_member', async (msg) => {
            console.log('👋 Member left:', msg.left_chat_member?.first_name);
            try {
                if (this.welcomeHandler) {
                    await this.welcomeHandler.handleLeftMember(msg);
                }
            } catch (error) {
                console.error('❌ Error handling left member:', error);
            }
        });

        // Listen for keywords (Arise, ZeroTwo, Bot, Test)
        this.bot.on('message', async (msg) => {
            try {
                if (this.welcomeHandler && msg.text) {
                    await this.welcomeHandler.handleKeywords(msg);
                }
            } catch (error) {
                console.error('❌ Error handling keywords:', error);
            }
        });

        console.log('✅ Event listeners registered for welcome/goodbye system');
    }

    async initializeWelcomeHandler() {
        try {
            const WelcomeHandler = require('../../Handlers/WelcomeHandler');
            this.welcomeHandler = new WelcomeHandler(this);
            await this.welcomeHandler.initialize();

            // Attach to handler for easy access
            this.handler.welcomeHandler = this.welcomeHandler;

            console.log('✅ Welcome Handler initialized and ready');
        } catch (error) {
            console.error('❌ Failed to initialize Welcome Handler:', error);
        }
    }

    async restartPolling() {
        if (this.restarting) return;

        this.restarting = true;
        console.log('🔄 Restarting polling...');

        try {
            // Stop current polling
            this.bot.stopPolling();
            this.isPolling = false;

            // Wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Start polling again
            this.bot.startPolling();
            this.isPolling = true;
            console.log('✅ Polling restarted successfully');

        } catch (error) {
            console.error('❌ Failed to restart polling:', error);
        } finally {
            this.restarting = false;
        }
    }

    async initializeBot() {
        try {
            // Wait a bit before starting spawner
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Start card spawner if available
            if (this.handler.client?.startCardSpawner) {
                await this.handler.client.startCardSpawner(15);
            }

            // Set bot commands for Telegram menu
            await this.setBotCommands();

            // Show total registered users
            const totalUsers = await this.database.getTotalUsers();
            console.log(`👥 Total registered users: ${totalUsers}`);

            console.log('✅ Bot initialization complete');
        } catch (error) {
            console.error('❌ Bot initialization error:', error);
        }
    }

    async setBotCommands() {
        try {
            const commands = [
                { command: 'start', description: 'Start the bot' },
                { command: 'help', description: 'Show command list' },
                { command: 'menu', description: 'Show command menu' },
                { command: 'mute', description: 'Mute a user in group' },
                { command: 'unmute', description: 'Unmute a user in group' },
                { command: 'setwelcome', description: 'Configure welcome messages' },
                { command: 'setgoodbye', description: 'Configure goodbye messages' }
            ];

            await this.bot.setMyCommands(commands);
            console.log('✅ Bot commands set (including welcome/goodbye commands)');
        } catch (error) {
            console.error('❌ Failed to set bot commands:', error);
        }
    }

    // ================= USER PROFILE METHODS =================

    async getUserProfilePhotos(userId, options = { offset: 0, limit: 1 }) {
        try {
            return await this.bot.getUserProfilePhotos(userId, options);
        } catch (error) {
            console.error('Error getting user profile photos:', error.message);
            return { total_count: 0, photos: [] };
        }
    }

    async getFile(fileId) {
        try {
            return await this.bot.getFile(fileId);
        } catch (error) {
            console.error('Error getting file:', error.message);
            return null;
        }
    }

    async getUserProfilePhotoUrl(userId) {
        try {
            const photos = await this.getUserProfilePhotos(userId, { offset: 0, limit: 1 });

            if (photos.total_count > 0) {
                const photo = photos.photos[0];
                const largestPhoto = photo[photo.length - 1];
                const file = await this.getFile(largestPhoto.file_id);

                if (file && file.file_path) {
                    return `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting profile photo URL:', error.message);
            return null;
        }
    }

    // ================= DATABASE METHODS =================

    async checkUserRegistration(userId) {
        try {
            return await this.database.isUserRegistered(userId);
        } catch (error) {
            console.error('Error checking user registration:', error);
            return false;
        }
    }

    async registerUser(userId, username, phoneNumber, fullName) {
        try {
            return await this.database.registerUser(userId, username, phoneNumber, fullName);
        } catch (error) {
            console.error('Error registering user:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserInfo(userId) {
        try {
            return await this.database.getUser(userId);
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }

    async updateUserLastSeen(userId) {
        try {
            await this.database.updateLastSeen(userId);
        } catch (error) {
            console.error('Error updating last seen:', error);
        }
    }

    // ================= GROUP SETTINGS METHODS =================

    async getGroupSettings(chatId) {
        try {
            return await this.database.getGroupSettings(chatId);
        } catch (error) {
            console.error('Error getting group settings:', error);
            return null;
        }
    }

    async updateGroupSettings(chatId, updates) {
        try {
            return await this.database.updateGroupSettings(chatId, updates);
        } catch (error) {
            console.error('Error updating group settings:', error);
            return false;
        }
    }

    async checkAlreadyWelcomed(chatId, userId) {
        try {
            return await this.database.checkAlreadyWelcomed(chatId, userId);
        } catch (error) {
            console.error('Error checking welcome status:', error);
            return false;
        }
    }

    async markAsWelcomed(chatId, userId) {
        try {
            return await this.database.markAsWelcomed(chatId, userId);
        } catch (error) {
            console.error('Error marking as welcomed:', error);
            return false;
        }
    }

    async clearWelcomeHistory(chatId, userId = null) {
        try {
            return await this.database.clearWelcomeHistory(chatId, userId);
        } catch (error) {
            console.error('Error clearing welcome history:', error);
            return false;
        }
    }

    // ================= MESSAGE METHODS =================

    async sendMessage(chatId, text, options = {}) {
        try {
            const defaultOptions = {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                ...options
            };
            return await this.bot.sendMessage(chatId, text, defaultOptions);
        } catch (error) {
            console.error('Send message error:', error);
            throw error;
        }
    }

    async sendPhoto(chatId, photo, options = {}) {
        try {
            const defaultOptions = {
                parse_mode: 'Markdown',
                ...options
            };
            return await this.bot.sendPhoto(chatId, photo, defaultOptions);
        } catch (error) {
            console.error('Send photo error:', error);
            throw error;
        }
    }

    async sendVideo(chatId, video, options = {}) {
        try {
            const defaultOptions = {
                parse_mode: 'Markdown',
                supports_streaming: true,
                ...options
            };
            return await this.bot.sendVideo(chatId, video, defaultOptions);
        } catch (error) {
            console.error('Send video error:', error);
            throw error;
        }
    }

    async sendAnimation(chatId, animation, options = {}) {
        try {
            const defaultOptions = {
                parse_mode: 'Markdown',
                ...options
            };
            return await this.bot.sendAnimation(chatId, animation, defaultOptions);
        } catch (error) {
            console.error('Send animation error:', error);
            throw error;
        }
    }

    async sendAudio(chatId, audio, options = {}) {
        try {
            return await this.bot.sendAudio(chatId, audio, options);
        } catch (error) {
            console.error('Send audio error:', error);
            throw error;
        }
    }

    async sendVoice(chatId, voice, options = {}) {
        try {
            return await this.bot.sendVoice(chatId, voice, options);
        } catch (error) {
            console.error('Send voice error:', error);
            throw error;
        }
    }

    async sendSticker(chatId, sticker, options = {}) {
        try {
            return await this.bot.sendSticker(chatId, sticker, options);
        } catch (error) {
            console.error('Send sticker error:', error);
            throw error;
        }
    }

    async sendDocument(chatId, document, options = {}) {
        try {
            return await this.bot.sendDocument(chatId, document, options);
        } catch (error) {
            console.error('Send document error:', error);
            throw error;
        }
    }

    async deleteMessage(chatId, messageId) {
        try {
            return await this.bot.deleteMessage(chatId, messageId);
        } catch (error) {
            console.error('Delete message error:', error);
            return false;
        }
    }
    // Add this method to your TelegramClient class in TelegramClient.js
async editMessageText(chatId, messageId, text, options = {}) {
    try {
        return await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: options.parse_mode || 'Markdown',
            disable_web_page_preview: true,
            reply_markup: options.reply_markup || null
        });
    } catch (error) {
        console.error('Edit message text error:', error);
        throw error;
    }
}

    async forwardMessage(chatId, fromChatId, messageId, options = {}) {
        try {
            return await this.bot.forwardMessage(chatId, fromChatId, messageId, options);
        } catch (error) {
            console.error('Forward message error:', error);
            throw error;
        }
    }

    async sendChatAction(chatId, action) {
        try {
            return await this.bot.sendChatAction(chatId, action);
        } catch (error) {
            console.error('Send chat action error:', error);
            throw error;
        }
    }

    async answerCallbackQuery(callbackQueryId, options = {}) {
        try {
            return await this.bot.answerCallbackQuery(callbackQueryId, options);
        } catch (error) {
            console.error('Answer callback query error:', error);
            throw error;
        }
    }

    async getBotInfo() {
        try {
            return await this.bot.getMe();
        } catch (error) {
            console.error('Get bot info error:', error);
            return null;
        }
    }

    /**
     * Mute a user in chat
     */
    async muteUser(chatId, userId, durationMs, reason, originalMsg = null) {
        if (this.handler && this.handler.muteUser) {
            return await this.handler.muteUser(chatId, userId, durationMs, reason, originalMsg);
        }
        return { success: false, error: 'Handler not available' };
    }

    /**
     * Unmute a user in chat
     */
    async unmuteUser(chatId, userId, adminId) {
        if (this.handler && this.handler.unmuteUser) {
            return await this.handler.unmuteUser(chatId, userId, adminId);
        }
        return { success: false, message: 'Handler not available' };
    }

    /**
     * Check if user is muted
     */
    isUserMuted(chatId, userId) {
        if (this.handler && this.handler.isUserMuted) {
            return this.handler.isUserMuted(chatId, userId);
        }
        return false;
    }

    /**
     * Get the MessageHandler instance
     */
    getHandler() {
        return this.handler;
    }

    /**
     * Check if a user is admin or owner
     */
    async isAdminOrOwner(chatId, userId) {
        if (this.handler && this.handler.isAdminOrOwner) {
            return await this.handler.isAdminOrOwner(chatId, userId);
        }
        return false;
    }
}

module.exports = { TelegramClient };