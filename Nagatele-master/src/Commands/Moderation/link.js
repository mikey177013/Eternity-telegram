module.exports = {
    name: 'link',
    aliases: ['invite', 'grouplink', 'invitelink'],
    category: 'moderation',
    description: 'Get group invite link',
    usage: '.link',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const chatType = M.chat.type;
            
            // Check if it's a group
            if (!['group', 'supergroup'].includes(chatType)) {
                return client.sendMessage(chatId, 
                    '❌ This command only works in groups!', 
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Get chat information
            const chat = await client.bot.getChat(chatId);
            
            let inviteLink = '';
            
            // Try to get existing invite link first
            if (chat.invite_link) {
                inviteLink = chat.invite_link;
            } 
            // If bot is admin, try to create new link
            else if (chat.permissions && chat.permissions.can_invite_users) {
                const newLink = await client.bot.createChatInviteLink(chatId, {
                    member_limit: 100
                });
                inviteLink = newLink.invite_link;
            }
            // For public groups with username
            else if (chat.username) {
                inviteLink = `https://t.me/${chat.username}`;
            }
            // Fallback for private groups
            else {
                // Try to export invite link
                try {
                    const exportedLink = await client.bot.exportChatInviteLink(chatId);
                    inviteLink = exportedLink;
                } catch (error) {
                    return client.sendMessage(chatId,
                        '❌ No invite link available. Bot needs admin rights to get/create links.',
                        { parse_mode: 'Markdown' }
                    );
                }
            }
            
            // Send the link
            return client.sendMessage(chatId,
                `🔗 *Group Invite Link*\n\n` +
                `${inviteLink}\n\n` +
                `_Share this link to invite members!_`,
                { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true 
                }
            );
            
        } catch (error) {
            console.error('Link command error:', error);
            
            // Send error message
            return client.sendMessage(M.chat.id,
                `❌ Error getting link: ${error.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
};