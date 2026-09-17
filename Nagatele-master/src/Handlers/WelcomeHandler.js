const CardGenerator = require('../Helpers/CardGenerator');

class WelcomeHandler {
    constructor(client) {
        this.client = client;
        this.cardGenerator = new CardGenerator(client);
        this.database = client.database;
        
        // Keywords to monitor (case-insensitive)
        this.keywords = ['arise', 'zerotwo', 'bot', 'test'];
        
        console.log('✅ Welcome Handler Created');
    }

    async initialize() {
        console.log('🔧 Initializing Welcome Handler...');
        
        // Create group settings table if not exists
        await this.createGroupSettingsTable();
        
        console.log('✅ Welcome Handler Initialized and Ready');
    }

    async createGroupSettingsTable() {
        return new Promise((resolve, reject) => {
            this.database.db.run(`
                CREATE TABLE IF NOT EXISTS group_settings (
                    chat_id TEXT PRIMARY KEY,
                    welcome_enabled INTEGER DEFAULT 1,
                    goodbye_enabled INTEGER DEFAULT 1,
                    welcome_message TEXT DEFAULT '',
                    goodbye_message TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else {
                    this.database.db.run(`
                        CREATE TABLE IF NOT EXISTS welcome_tracking (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            chat_id TEXT NOT NULL,
                            user_id TEXT NOT NULL,
                            welcomed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(chat_id, user_id)
                        )
                    `, (err2) => {
                        if (err2) reject(err2);
                        else {
                            console.log('✅ Group settings tables created/verified');
                            resolve();
                        }
                    });
                }
            });
        });
    }

    async handleNewMembers(msg) {
        try {
            const chatId = msg.chat.id;
            const chatTitle = msg.chat.title || 'this group';
            const newMembers = msg.new_chat_members || [];

            if (newMembers.length === 0) {
                console.log('⚠️ No new members detected');
                return;
            }

            console.log(`👋 New members detected in "${chatTitle}":`, newMembers.map(m => m.first_name).join(', '));

            // Check if welcome is enabled for this group
            const settings = await this.getGroupSettings(chatId);
            
            if (!settings.welcome_enabled) {
                console.log(`ℹ️ Welcome is disabled for chat ${chatId}`);
                return;
            }

            // Process each new member
            for (const member of newMembers) {
                // Skip if it's the bot itself
                if (member.is_bot && member.id === this.client.bot.id) {
                    console.log('🤖 Skipping bot self-welcome');
                    continue;
                }

                // Check if already welcomed recently (prevent duplicate welcomes)
                const alreadyWelcomed = await this.checkAlreadyWelcomed(chatId, member.id);
                if (alreadyWelcomed) {
                    console.log(`ℹ️ ${member.first_name} already welcomed recently, skipping`);
                    continue;
                }

                console.log(`✨ Creating welcome card for ${member.first_name} (ID: ${member.id})`);

                // Send "processing" message
                const processingMsg = await this.client.sendMessage(chatId, 
                    `✨ Creating welcome card for ${member.first_name}...`,
                    { parse_mode: 'Markdown' }
                );

                try {
                    // Generate welcome card with member card
                    const welcomeData = await this.cardGenerator.generateWelcomeCard(chatId, member, chatTitle);
                    
                    // Send the welcome message with card
                    await this.client.sendPhoto(chatId, welcomeData.imageBuffer, {
                        caption: welcomeData.caption,
                        parse_mode: 'Markdown',
                        reply_markup: welcomeData.reply_markup
                    });

                    // Mark as welcomed
                    await this.markAsWelcomed(chatId, member.id);

                    console.log(`✅ Welcome card sent for ${member.first_name}`);

                } catch (error) {
                    console.error(`❌ Error sending welcome card for ${member.first_name}:`, error);
                    
                    // Fallback to text welcome
                    const fallbackWelcome = `🌸 Welcome ${member.first_name} to ${chatTitle}! 🌸\n\n` +
                                           `I hope you'll have fun here! ✨\n\n` +
                                           `Type \`.menu\` to get started!`;
                    
                    await this.client.sendMessage(chatId, fallbackWelcome, {
                        parse_mode: 'Markdown'
                    });
                    
                    // Mark as welcomed even with fallback
                    await this.markAsWelcomed(chatId, member.id);
                }

                // Delete processing message
                try {
                    await this.client.deleteMessage(chatId, processingMsg.message_id);
                } catch (e) {
                    // Ignore deletion errors
                }

                // Small delay between welcoming multiple members
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error('❌ Error in handleNewMembers:', error);
        }
    }

    async handleLeftMember(msg) {
        try {
            const chatId = msg.chat.id;
            const chatTitle = msg.chat.title || 'this group';
            const leftMember = msg.left_chat_member;

            if (!leftMember) {
                console.log('⚠️ No left member detected');
                return;
            }

            // Skip if it's the bot itself
            if (leftMember.id === this.client.bot.id) {
                console.log('🤖 Skipping bot self-goodbye');
                return;
            }

            // Check if goodbye is enabled for this group
            const settings = await this.getGroupSettings(chatId);
            if (!settings.goodbye_enabled) {
                console.log(`ℹ️ Goodbye is disabled for chat ${chatId}`);
                return;
            }

            console.log(`👋 Member left: ${leftMember.first_name} (${leftMember.id}) from ${chatTitle}`);

            // Create goodbye message
            const goodbyeMessage = settings.goodbye_message || 
                `👋 Goodbye, *${leftMember.first_name}*!\n\n` +
                `We'll miss you in *${chatTitle}*! 😔\n\n` +
                `Hope to see you again soon! 💫`;

            // Send goodbye message
            await this.client.sendMessage(chatId, goodbyeMessage, {
                parse_mode: 'Markdown'
            });

            console.log(`✅ Goodbye sent for ${leftMember.first_name}`);

        } catch (error) {
            console.error('❌ Error handling left member:', error);
        }
    }

    async handleKeywords(msg) {
        try {
            const text = msg.text;
            if (!text) return;

            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const firstName = msg.from.first_name || 'User';
            
            // Convert text to lowercase for case-insensitive matching
            const lowerText = text.toLowerCase().trim();
            
            // Check if message contains any of the keywords
            const matchedKeyword = this.keywords.find(keyword => 
                lowerText === keyword
            );
            
            if (matchedKeyword) {
                console.log(`🔑 Keyword detected: "${matchedKeyword}" by ${firstName} in ${chatId}`);
                
                // Send response
                const response = `✨ I am alive and kicking, *${firstName}*! ✨\n\n` +
                                `Ready to serve you with love~ 💖`;
                
                await this.client.sendMessage(chatId, response, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: msg.message_id
                });
            }
        } catch (error) {
            console.error('❌ Error handling keywords:', error);
        }
    }

    // Database methods for group settings
    async getGroupSettings(chatId) {
        return new Promise((resolve, reject) => {
            this.database.db.get(
                'SELECT * FROM group_settings WHERE chat_id = ?',
                [chatId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve(row);
                    } else {
                        // Create default settings
                        const defaultSettings = {
                            chat_id: chatId,
                            welcome_enabled: 1, // Default: enabled
                            goodbye_enabled: 1, // Default: enabled
                            welcome_message: '',
                            goodbye_message: ''
                        };
                        
                        this.database.db.run(
                            'INSERT INTO group_settings (chat_id) VALUES (?)',
                            [chatId],
                            (err2) => {
                                if (err2) reject(err2);
                                else resolve(defaultSettings);
                            }
                        );
                    }
                }
            );
        });
    }

    async updateGroupSettings(chatId, updates) {
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        
        values.push(chatId);
        
        return new Promise((resolve, reject) => {
            this.database.db.run(
                `UPDATE group_settings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    async checkAlreadyWelcomed(chatId, userId) {
        return new Promise((resolve, reject) => {
            this.database.db.get(
                'SELECT COUNT(*) as count FROM welcome_tracking WHERE chat_id = ? AND user_id = ?',
                [chatId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count > 0);
                }
            );
        });
    }

    async markAsWelcomed(chatId, userId) {
        return new Promise((resolve, reject) => {
            this.database.db.run(
                'INSERT OR REPLACE INTO welcome_tracking (chat_id, user_id) VALUES (?, ?)',
                [chatId, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    async clearWelcomeHistory(chatId, userId = null) {
        if (userId) {
            return new Promise((resolve, reject) => {
                this.database.db.run(
                    'DELETE FROM welcome_tracking WHERE chat_id = ? AND user_id = ?',
                    [chatId, userId],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes > 0);
                    }
                );
            });
        } else {
            return new Promise((resolve, reject) => {
                this.database.db.run(
                    'DELETE FROM welcome_tracking WHERE chat_id = ?',
                    [chatId],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });
        }
    }
}

module.exports = WelcomeHandler;