// src/Commands/Moderation/unmute.js
module.exports = {
    name: 'unmute',
    aliases: ['unsilence', 'unrestrict'],
    category: 'moderation',
    description: 'Unmute a user in the group',
    usage: '.unmute [@user/ID] or reply .unmute\nExample: .unmute, .unmute @user, .unmute 123456789',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const adminId = M.from.id;
            const handler = M.handler || client.handler;
            
            // Check if in a group
            if (!['group', 'supergroup'].includes(M.chat.type)) {
                return client.sendMessage(chatId, 
                    '❌ This command can only be used in groups.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Check if user is admin
            let isAdmin = false;
            try {
                if (handler && handler.isAdminOrOwner) {
                    isAdmin = await handler.isAdminOrOwner(chatId, adminId);
                } else {
                    isAdmin = await this.isAdminDirect(client, chatId, adminId);
                }
            } catch (error) {
                console.error('Admin check error:', error);
                return client.sendMessage(chatId,
                    '❌ Error checking admin status.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            if (!isAdmin) {
                return client.sendMessage(chatId,
                    '❌ Only group admins can use this command.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Parse arguments
            const args = arg.trim().split(/\s+/);
            
            // Extract target user
            let targetUserId;
            
            // Check if reply to a message
            if (M.reply_to_message && M.reply_to_message.from) {
                targetUserId = M.reply_to_message.from.id;
            } 
            // Check if mentioned user
            else if (args[0] && (args[0].includes('@') || args[0].startsWith('-'))) {
                return client.sendMessage(chatId,
                    '❌ Please reply to a user\'s message to unmute them.\n' +
                    'Or use their numeric ID: `.unmute 123456789`',
                    { parse_mode: 'Markdown' }
                );
            }
            // Check if user ID is provided
            else if (args[0] && !isNaN(args[0])) {
                targetUserId = parseInt(args[0]);
            }
            else {
                return client.sendMessage(chatId,
                    '❌ Usage:\n' +
                    '• `.unmute` (reply to user message)\n' +
                    '• `.unmute USER_ID`',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Get target user info
            let targetName = 'User';
            try {
                const chatMember = await client.bot.getChatMember(chatId, targetUserId);
                targetName = chatMember.user.first_name || 'User';
            } catch (e) {
                if (M.reply_to_message && M.reply_to_message.from) {
                    targetName = M.reply_to_message.from.first_name || 'User';
                }
            }
            
            // Check if user is already unmuted
            if (handler && handler.isUserMuted) {
                const isMuted = handler.isUserMuted(chatId, targetUserId);
                if (!isMuted) {
                    return client.sendMessage(chatId,
                        `⚠️ *${targetName}* is not muted!`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }
            
            // Unmute the user using MessageHandler's method
            if (handler && handler.unmuteUser) {
                const result = await handler.unmuteUser(chatId, targetUserId, adminId);
                
                if (result.success) {
                    // Handler already sends the unmute message to the group
                    // Just confirm to the admin
                    await client.sendMessage(chatId,
                        `✅ *${targetName}* has been unmuted successfully!`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    // Auto-delete admin confirmation
                    setTimeout(async () => {
                        try {
                            await client.deleteMessage(chatId, M.message_id);
                        } catch (e) {}
                    }, 5000);
                    
                } else if (result.notMuted) {
                    await client.sendMessage(chatId,
                        `⚠️ *${targetName}* is not muted!`,
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    await client.sendMessage(chatId,
                        `❌ Failed to unmute *${targetName}*.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            } else {
                return client.sendMessage(chatId,
                    '❌ Unmute system not available.',
                    { parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            console.error('Unmute command error:', error);
            await client.sendMessage(M.chat.id,
                `❌ Error: ${error.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    },
    
    async isAdminDirect(client, chatId, userId) {
        try {
            // Check if user is bot owner
            const ownerId = process.env.OWNER_ID;
            if (ownerId && String(userId) === String(ownerId)) {
                return true;
            }
            
            // Get chat administrators
            const chatAdmins = await client.bot.getChatAdministrators(chatId);
            
            // Check if user is admin
            return chatAdmins.some(admin => {
                const adminId = admin.user.id;
                return String(adminId) === String(userId);
            });
        } catch (error) {
            console.error('Direct admin check error:', error);
            return false;
        }
    }
};