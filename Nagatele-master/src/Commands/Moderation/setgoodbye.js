module.exports = {
    name: 'setgoodbye',
    aliases: ['goodbye'],
    category: 'moderation',
    description: 'Configure goodbye settings for the group',
    usage: '.setgoodbye [on/off] or .setgoodbye message <your custom message>',
    exp: 10,
    cool: 30,
    react: '👋',
    
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
                    '❌ Only admins can configure goodbye settings!',
                    { parse_mode: 'Markdown' }
                );
            }
            
            const args = arg.trim().split(' ');
            const subcommand = args[0]?.toLowerCase();
            
            // Get current settings first
            const currentSettings = await client.getGroupSettings(chatId);
            
            if (!subcommand) {
                // Show current settings
                const statusEmoji = currentSettings.goodbye_enabled ? '✅' : '❌';
                const messagePreview = currentSettings.goodbye_message 
                    ? `\n📝 Custom Message: ${currentSettings.goodbye_message.substring(0, 50)}${currentSettings.goodbye_message.length > 50 ? '...' : ''}`
                    : '\n📝 Using default goodbye message';
                
                return client.sendMessage(chatId,
                    `👋 *Goodbye Settings for ${M.chat.title || 'this group'}*\n\n` +
                    `Status: ${statusEmoji} ${currentSettings.goodbye_enabled ? 'ENABLED' : 'DISABLED'}${messagePreview}\n\n` +
                    `*Usage:*\n` +
                    `• \`.setgoodbye on\` - Enable goodbye messages\n` +
                    `• \`.setgoodbye off\` - Disable goodbye messages\n` +
                    `• \`.setgoodbye message <your message>\` - Set custom goodbye message\n` +
                    `• \`.setgoodbye clear\` - Clear custom message\n\n` +
                    `*Variables in custom message:*\n` +
                    `• {name} - User's first name\n` +
                    `• {username} - @username (or first name)\n` +
                    `• {group} - Group name`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            switch (subcommand) {
                case 'on':
                case 'enable':
                    // Check if already enabled
                    if (currentSettings.goodbye_enabled === 1) {
                        return client.sendMessage(chatId,
                            'ℹ️ Goodbye messages are already **ENABLED** for this group!',
                            { parse_mode: 'Markdown' }
                        );
                    }
                    
                    await client.updateGroupSettings(chatId, { goodbye_enabled: 1 });
                    return client.sendMessage(chatId,
                        '✅ Goodbye messages have been **ENABLED** for this group!\n\n' +
                        'Members will receive goodbye messages when they leave.',
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'off':
                case 'disable':
                    // Check if already disabled
                    if (currentSettings.goodbye_enabled === 0) {
                        return client.sendMessage(chatId,
                            'ℹ️ Goodbye messages are already **DISABLED** for this group!',
                            { parse_mode: 'Markdown' }
                        );
                    }
                    
                    await client.updateGroupSettings(chatId, { goodbye_enabled: 0 });
                    return client.sendMessage(chatId,
                        '❌ Goodbye messages have been **DISABLED** for this group!\n\n' +
                        'Members will no longer receive goodbye messages.',
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'message':
                    const message = args.slice(1).join(' ');
                    if (!message) {
                        return client.sendMessage(chatId,
                            '❌ Please provide a goodbye message!\n' +
                            'Example: `.setgoodbye message Goodbye {name}! We\'ll miss you in {group}.`',
                            { parse_mode: 'Markdown' }
                        );
                    }
                    
                    await client.updateGroupSettings(chatId, { goodbye_message: message });
                    return client.sendMessage(chatId,
                        '✅ Custom goodbye message has been set!\n\n' +
                        `*Preview:* ${message.replace(/{name}/g, 'User').replace(/{username}/g, '@user').replace(/{group}/g, M.chat.title || 'Group')}`,
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'clear':
                    await client.updateGroupSettings(chatId, { goodbye_message: '' });
                    return client.sendMessage(chatId,
                        '✅ Custom goodbye message has been cleared!\n' +
                        'Default goodbye message will be used.',
                        { parse_mode: 'Markdown' }
                    );
                    
                case 'test':
                    // Test goodbye with current user
                    const testGoodbye = currentSettings.goodbye_message || 
                        `👋 Goodbye, *${M.from.first_name || 'User'}*!\n\n` +
                        `We'll miss you in *${M.chat.title || 'this group'}*! 😔\n\n` +
                        `Hope to see you again soon! 💫`;
                    
                    return client.sendMessage(chatId,
                        `🎭 *Test Goodbye Message*\n\n${testGoodbye}`,
                        { parse_mode: 'Markdown' }
                    );
                    
                default:
                    return client.sendMessage(chatId,
                        '❌ Invalid subcommand!\n' +
                        'Use `.setgoodbye` to see available options.',
                        { parse_mode: 'Markdown' }
                    );
            }
            
        } catch (err) {
            console.error('Setgoodbye error:', err);
            return client.sendMessage(M.chat.id,
                `❌ Error configuring goodbye: ${err.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
};