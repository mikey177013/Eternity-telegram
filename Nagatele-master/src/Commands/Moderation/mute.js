// src/Commands/Moderation/mute.js
module.exports = {
    name: 'mute',
    aliases: ['silence', 'restrict'],
    category: 'moderation',
    description: 'Mute a user in the group',
    usage: '.mute [@user/ID] [duration] (m=minutes, h=hours, d=days)\nExample: .mute 30m, .mute @user 2h, .mute (reply) 1d',
    
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
            let durationStr = '10m'; // Default 10 minutes
            
            // Check if reply to a message
            if (M.reply_to_message && M.reply_to_message.from) {
                targetUserId = M.reply_to_message.from.id;
                durationStr = args[0] || '10m';
            } 
            // Check if mentioned user
            else if (args[0] && (args[0].includes('@') || args[0].startsWith('-'))) {
                // Extract user ID from mention or get from database
                return client.sendMessage(chatId,
                    '❌ Please reply to a user\'s message to mute them.\n' +
                    'Or use their numeric ID: `.mute 123456789 30m`',
                    { parse_mode: 'Markdown' }
                );
            }
            // Check if user ID is provided
            else if (args[0] && !isNaN(args[0])) {
                targetUserId = parseInt(args[0]);
                durationStr = args[1] || '10m';
            }
            else {
                return client.sendMessage(chatId,
                    '❌ Usage:\n' +
                    '• `.mute` (reply to user message)\n' +
                    '• `.mute USER_ID 30m`\n\n' +
                    'Duration: m=minutes, h=hours, d=days\n' +
                    'Examples: 30m, 2h, 1d',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Check if trying to mute self
            if (targetUserId === adminId) {
                return client.sendMessage(chatId,
                    '❌ You cannot mute yourself!',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Check if target is already muted
            if (handler && handler.isUserMuted && handler.isUserMuted(chatId, targetUserId)) {
                // Get user info
                let targetName = 'User';
                try {
                    const chatMember = await client.bot.getChatMember(chatId, targetUserId);
                    targetName = chatMember.user.first_name || 'User';
                } catch (e) {
                    if (M.reply_to_message && M.reply_to_message.from) {
                        targetName = M.reply_to_message.from.first_name || 'User';
                    }
                }
                
                return client.sendMessage(chatId,
                    `⚠️ *${targetName}* is already muted!`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Check if target is admin
            let targetIsAdmin = false;
            try {
                if (handler && handler.isAdminOrOwner) {
                    targetIsAdmin = await handler.isAdminOrOwner(chatId, targetUserId);
                } else {
                    targetIsAdmin = await this.isAdminDirect(client, chatId, targetUserId);
                }
            } catch (error) {
                console.error('Target admin check error:', error);
            }
            
            if (targetIsAdmin) {
                return client.sendMessage(chatId,
                    '❌ You cannot mute other admins!',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Parse duration
            let durationMs;
            if (handler && handler.parseMuteDuration) {
                durationMs = handler.parseMuteDuration(durationStr);
            } else {
                durationMs = this.parseDuration(durationStr);
            }
            
            if (!durationMs) {
                return client.sendMessage(chatId,
                    '❌ Invalid duration format!\n\n' +
                    'Use: m=minutes, h=hours, d=days\n' +
                    'Examples:\n' +
                    '• `.mute 30m` (30 minutes)\n' +
                    '• `.mute 2h` (2 hours)\n' +
                    '• `.mute 1d` (1 day)',
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
            
            // Mute the user
            if (handler && handler.muteUser) {
                const result = await handler.muteUser(
                    chatId, 
                    targetUserId, 
                    durationMs, 
                    `muted by admin`, 
                    M.reply_to_message || M,
                    false // Not silent
                );
                
                if (result.success) {
                    // FIXED: NO DUPLICATE MESSAGE - Handler already sent the mute message
                    // We just need to confirm to the admin
                    await client.sendMessage(chatId,
                        `✅ *${targetName}* has been muted for ${result.durationText || this.formatDuration(durationMs)}!`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    // Auto-delete admin confirmation
                    setTimeout(async () => {
                        try {
                            await client.deleteMessage(chatId, M.message_id);
                        } catch (e) {}
                    }, 5000);
                    
                } else if (result.alreadyMuted) {
                    await client.sendMessage(chatId,
                        `⚠️ *${targetName}* is already muted!`,
                        { parse_mode: 'Markdown' }
                    );
                } else if (result.isAdmin) {
                    await client.sendMessage(chatId,
                        `❌ Cannot mute *${targetName}* - they are an admin!`,
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    await client.sendMessage(chatId,
                        '❌ Failed to mute user. Bot may lack permissions.',
                        { parse_mode: 'Markdown' }
                    );
                }
            } else {
                return client.sendMessage(chatId,
                    '❌ Mute system not available.',
                    { parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            console.error('Mute command error:', error);
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
    },
    
    parseDuration(durationStr) {
        const regex = /^(\d+)([mhd])$/i;
        const match = durationStr.match(regex);
        
        if (!match) {
            // Check if it's just a number (default to minutes)
            const numMatch = durationStr.match(/^(\d+)$/);
            if (numMatch) {
                return parseInt(numMatch[1]) * 60 * 1000; // Default to minutes
            }
            return null;
        }
        
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        switch (unit) {
            case 'm': return value * 60 * 1000; // minutes
            case 'h': return value * 60 * 60 * 1000; // hours
            case 'd': return value * 24 * 60 * 60 * 1000; // days
            default: return null;
        }
    },
    
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
};