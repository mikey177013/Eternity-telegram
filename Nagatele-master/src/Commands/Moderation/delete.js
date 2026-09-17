module.exports = {
    name: 'del',
    aliases: ['delete', 'remove', 'purge'],
    category: 'Moderation',
    description: 'Delete a specific message (Admin only)',
    usage: 'Reply to a message with .del',
    adminOnly: true,
    groupOnly: true,

    async execute(client, args, M) {
        try {
            const chatId = M.chat.id;
            const messageId = M.message_id;
            const userId = M.from.id;
            
            // Check if it's a group
            if (M.chat.type !== 'group' && M.chat.type !== 'supergroup') {
                return client.sendMessage(chatId,
                    '❌ This command can only be used in groups.',
                    { parse_mode: 'Markdown' }
                );
            }

            // Check if replying to a message
            if (!M.reply_to_message) {
                return client.sendMessage(chatId,
                    '❌ Please reply to the message you want to delete.\n\n' +
                    '*Usage:* Reply to a message with `.del`',
                    { parse_mode: 'Markdown' }
                );
            }

            const targetMessageId = M.reply_to_message.message_id;
            
            // Check if user is admin using the handler's method
            const handler = client.getHandler ? client.getHandler() : null;
            let isAdmin = false;
            
            if (handler && handler.isAdminOrOwner) {
                isAdmin = await handler.isAdminOrOwner(chatId, userId);
            } else if (client.isAdminOrOwner) {
                isAdmin = await client.isAdminOrOwner(chatId, userId);
            }
            
            if (!isAdmin) {
                return client.sendMessage(chatId,
                    '❌ You need to be an admin to use this command.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Check if bot is admin
            let isBotAdmin = false;
            const botInfo = await client.getBotInfo();
            const botId = botInfo?.id;
            
            if (botId) {
                if (handler && handler.isAdminOrOwner) {
                    isBotAdmin = await handler.isAdminOrOwner(chatId, botId);
                } else if (client.isAdminOrOwner) {
                    isBotAdmin = await client.isAdminOrOwner(chatId, botId);
                }
            }
            
            if (!isBotAdmin) {
                return client.sendMessage(chatId,
                    '❌ I need admin permissions to delete messages.\n\n' +
                    '*To fix:*\n' +
                    '1. Make me admin in this group\n' +
                    '2. Grant me *"Delete Messages"* permission\n' +
                    '3. Try again',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Try to delete the message
            try {
                // Delete the target message
                const deleteResult = await client.deleteMessage(chatId, targetMessageId);
                
                if (deleteResult === false) {
                    throw new Error('Failed to delete message (returned false)');
                }
                
                // Send success message
                const successMsg = await client.sendMessage(chatId,
                    '✅ Message deleted successfully!',
                    { parse_mode: 'Markdown' }
                );
                
                // Delete command message after 1 second
                setTimeout(async () => {
                    try {
                        await client.deleteMessage(chatId, messageId);
                    } catch (e) {
                        console.log('Could not delete command message:', e.message);
                    }
                }, 1000);
                
                // Delete success message after 3 seconds
                setTimeout(async () => {
                    try {
                        await client.deleteMessage(chatId, successMsg.message_id);
                    } catch (e) {
                        console.log('Could not delete success message:', e.message);
                    }
                }, 3000);
                
            } catch (deleteError) {
                console.error('Delete message error:', deleteError);
                
                // Parse the error
                let errorMessage = '❌ Failed to delete the message.\n';
                
                if (deleteError.message) {
                    const errMsg = deleteError.message.toLowerCase();
                    
                    if (errMsg.includes('not enough rights') || errMsg.includes('403')) {
                        errorMessage = '❌ *Permission Denied!*\n\n' +
                                      'I need *"Delete Messages"* admin permission.\n\n' +
                                      '*How to fix:*\n' +
                                      '1. Make me admin in this group\n' +
                                      '2. Grant me *"Delete Messages"* permission\n' +
                                      '3. Try the command again';
                    } else if (errMsg.includes('message to delete not found')) {
                        errorMessage += 'Message not found (might already be deleted)';
                    } else if (errMsg.includes('too old')) {
                        errorMessage += 'Message is too old (max 48 hours)';
                    } else {
                        errorMessage += `Error: ${deleteError.message}`;
                    }
                } else {
                    errorMessage += 'Unknown error occurred.';
                }
                
                return client.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
            }

        } catch (error) {
            console.error('DEL command error:', error);
            await client.sendMessage(M.chat.id,
                '❌ An error occurred while trying to delete the message.',
                { parse_mode: 'Markdown' }
            );
        }
    }
};