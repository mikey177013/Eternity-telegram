module.exports = {
    name: 'setwelcome',
    aliases: ['welcome'],
    category: 'moderation',
    description: 'Configure welcome settings for the group',
    usage: '.setwelcome [on/off] or .setwelcome message <your custom message>',
    exp: 10,
    cool: 30,
    react: '🎉',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const chatType = M.chat.type;
            
            // Check if it's a group
            if (!['group', 'supergroup'].includes(chatType)) {
                return client.sendMessage(chatId,
                    '❌ This command can only be used in groups!',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Check if user is admin
            const isAdmin = await client.handler.isAdminOrOwner(chatId, M.from.id);
            if (!isAdmin) {
                return client.sendMessage(chatId,
                    '❌ Only admins can configure welcome settings!',
                    { parse_mode: 'Markdown' }
                );
            }
            
            const args = arg.trim().split(' ');
            const subcommand = args[0]?.toLowerCase();
            
            // Get welcome handler
            const welcomeHandler = client.handler.welcomeHandler;
            if (!welcomeHandler) {
                return client.sendMessage(chatId,
                    '❌ Welcome system is not initialized. Please contact bot owner.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Get current settings first
            const currentSettings = await client.getGroupSettings(chatId);
            
            if (!subcommand) {
                // Show current settings
                const statusEmoji = currentSettings.welcome_enabled ? '✅' : '❌';
                const messagePreview = currentSettings.welcome_message 
                    ? `\n📝 Custom Message: ${currentSettings.welcome_message.substring(0, 50)}${currentSettings.welcome_message.length > 50 ? '...' : ''}`
                    : '\n📝 Using default welcome message';
                
                return client.sendMessage(chatId,
                    `🎉 *Welcome Settings for ${M.chat.title || 'this group'}*\n\n` +
                    `Status: ${statusEmoji} ${currentSettings.welcome_enabled ? 'ENABLED' : 'DISABLED'}${messagePreview}\n\n` +
                    `*Usage:*\n` +
                    `• \`.setwelcome on\` - Enable welcome messages\n` +
                    `• \`.setwelcome off\` - Disable welcome messages\n` +
                    `• \`.setwelcome message <your message>\` - Set custom welcome message\n` +
                    `• \`.setwelcome clear\` - Clear custom message\n` +
                    `• \`.setwelcome reset\` - Reset all welcome history\n\n` +
                    `*Variables in custom message:*\n` +
                    `• {name} - User's first name\n` +
                    `• {username} - @username (or first name)\n` +
                    `• {group} - Group name\n` +
                    `• {mention} - Mentions the user`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            switch (subcommand) {
                case 'on':
                case 'enable':
                    // Check if already enabled
                    if (currentSettings.welcome_enabled === 1) {
                        return client.sendMessage(chatId,
                            'ℹ️ Welcome messages are already **ENABLED** for this group!',
                            { parse_mode: 'Markdown' }
                        );
                    }
                    
                    await client.updateGroupSettings(chatId, { welcome_enabled: 1 });
                    return client.sendMessage(chatId,
                        '✅ Welcome messages have been **ENABLED** for this group!\n\n' +
                        'New members will now receive welcome cards with their profile pictures.',
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'off':
                case 'disable':
                    // Check if already disabled
                    if (currentSettings.welcome_enabled === 0) {
                        return client.sendMessage(chatId,
                            'ℹ️ Welcome messages are already **DISABLED** for this group!',
                            { parse_mode: 'Markdown' }
                        );
                    }
                    
                    await client.updateGroupSettings(chatId, { welcome_enabled: 0 });
                    return client.sendMessage(chatId,
                        '❌ Welcome messages have been **DISABLED** for this group!\n\n' +
                        'New members will no longer receive welcome messages.',
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'message':
                    const message = args.slice(1).join(' ');
                    if (!message) {
                        return client.sendMessage(chatId,
                            '❌ Please provide a welcome message!\n' +
                            'Example: `.setwelcome message Welcome {name} to {group}!`',
                            { parse_mode: 'Markdown' }
                        );
                    }
                    
                    await client.updateGroupSettings(chatId, { welcome_message: message });
                    return client.sendMessage(chatId,
                        '✅ Custom welcome message has been set!\n\n' +
                        `*Preview:* ${message.replace(/{name}/g, 'User').replace(/{username}/g, '@user').replace(/{group}/g, M.chat.title || 'Group').replace(/{mention}/g, '[User](tg://user?id=123)')}`,
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'clear':
                    await client.updateGroupSettings(chatId, { welcome_message: '' });
                    return client.sendMessage(chatId,
                        '✅ Custom welcome message has been cleared!\n' +
                        'Default welcome message will be used.',
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'reset':
                    await client.clearWelcomeHistory(chatId);
                    return client.sendMessage(chatId,
                        '✅ Welcome history has been reset!\n' +
                        'All previous members will be welcomed again if they rejoin.',
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'test':
                    // Test welcome with current user
                    try {
                        const welcomeData = await welcomeHandler.cardGenerator.generateWelcomeCard(
                            chatId, 
                            M.from, 
                            M.chat.title || 'Test Group'
                        );
                        
                        await client.sendPhoto(chatId, welcomeData.imageBuffer, {
                            caption: `🎉 *Test Welcome Message*\n\nThis is how welcome messages will look for new members!`,
                            parse_mode: 'Markdown',
                            reply_markup: welcomeData.reply_markup
                        });
                    } catch (error) {
                        console.error('Test welcome error:', error);
                        return client.sendMessage(chatId,
                            '❌ Error testing welcome: ' + error.message,
                            { parse_mode: 'Markdown' }
                        );
                    }
                    break;
                    
                default:
                    return client.sendMessage(chatId,
                        '❌ Invalid subcommand!\n' +
                        'Use `.setwelcome` to see available options.',
                        { parse_mode: 'Markdown' }
                    );
            }
            
        } catch (err) {
            console.error('Setwelcome error:', err);
            return client.sendMessage(M.chat.id,
                `❌ Error configuring welcome: ${err.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
};