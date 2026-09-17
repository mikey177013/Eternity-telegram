const QuoteGenerator = require('../../Helpers/QuoteGenerator');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'quoted',
    aliases: ['q', 'quote', 'qc'],
    category: 'utils',
    description: 'Create Telegram-style quote sticker from text or replied message',
    usage: '.quoted <text> or reply .quoted to a message',
    exp: 15,
    cool: 10,
    react: '💬',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const userId = M.from.id;
            
            // Get text from argument or replied message
            let text = arg.trim();
            let targetUser = M.from;
            let targetMessage = M;
            
            // If replying to a message, use that text and user
            if (M.reply_to_message) {
                targetUser = M.reply_to_message.from;
                text = M.reply_to_message.text || text;
                targetMessage = M.reply_to_message;
                
                if (!text.trim()) {
                    return client.sendMessage(chatId,
                        '❌ The replied message has no text!\n' +
                        'Please reply to a text message or provide text after the command.',
                        { parse_mode: 'Markdown' }
                    );
                }
            }
            
            // If no text provided
            if (!text.trim()) {
                return client.sendMessage(chatId,
                    '❌ Please provide text or reply to a message!\n\n' +
                    '*Usage:*\n' +
                    '• `.quoted your text here`\n' +
                    '• Reply `.quoted` to a message',
                    { parse_mode: 'Markdown' }
                );
            }
            
            console.log(`💬 Creating quote for: ${targetUser.first_name} with text: ${text.substring(0, 50)}...`);
            
            // Send processing message
            const processingMsg = await client.sendMessage(chatId,
                `✨ Creating quote sticker for ${targetUser.first_name}...`,
                { parse_mode: 'Markdown' }
            );
            
            // Initialize quote generator
            const quoteGenerator = new QuoteGenerator(client);
            
            // Get user info
            const firstName = targetUser.first_name || 'User';
            const lastName = targetUser.last_name || '';
            const fullName = lastName ? `${firstName} ${lastName}` : firstName;
            const username = targetUser.username ? `@${targetUser.username}` : firstName;
            
            // Get profile picture
            let avatarUrl = null;
            try {
                const photos = await client.getUserProfilePhotos(targetUser.id, { offset: 0, limit: 1 });
                if (photos.total_count > 0) {
                    const photo = photos.photos[0];
                    const largestPhoto = photo[photo.length - 1];
                    const file = await client.getFile(largestPhoto.file_id);
                    
                    if (file && file.file_path) {
                        avatarUrl = `https://api.telegram.org/file/bot${client.bot.token}/${file.file_path}`;
                    }
                }
            } catch (avatarError) {
                console.log('Could not get profile photo:', avatarError.message);
            }
            
            // Fallback avatar
            if (!avatarUrl) {
                avatarUrl = 'https://files.catbox.moe/ga0p7d.jpg'; // Default avatar
            }
            
            // Generate quote image
            const quoteBuffer = await quoteGenerator.generateQuote(
                text,
                username,
                avatarUrl,
                {
                    timestamp: new Date().toISOString(),
                    isReply: !!M.reply_to_message
                }
            );
            
            // Convert to sticker format
            const stickerBuffer = await quoteGenerator.convertToSticker(quoteBuffer);
            
            // Save temp file (for debugging if needed)
            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }
            
            const tempPath = path.join(tmpDir, `quote-${Date.now()}.png`);
            fs.writeFileSync(tempPath, stickerBuffer);
            
            try {
                // Send as sticker
                await client.sendSticker(chatId, stickerBuffer, {
                    reply_to_message_id: M.reply_to_message ? M.reply_to_message.message_id : undefined
                });
                
                console.log(`✅ Quote sticker sent for ${firstName}`);
                
                // Send success reaction
                try {
                    await client.sendMessage(chatId, {
                        chat_id: chatId,
                        text: '✅',
                        reply_to_message_id: M.message_id
                    });
                } catch (reactError) {
                    // Ignore reaction errors
                }
                
            } catch (sendError) {
                console.error('Error sending sticker:', sendError);
                
                // Fallback: Send as image
                await client.sendPhoto(chatId, quoteBuffer, {
                    caption: `💬 *Quote by ${username}*`,
                    parse_mode: 'Markdown',
                    reply_to_message_id: M.reply_to_message ? M.reply_to_message.message_id : undefined
                });
            }
            
            // Delete processing message
            try {
                await client.deleteMessage(chatId, processingMsg.message_id);
            } catch (deleteError) {
                // Ignore
            }
            
            // Cleanup temp file
            try {
                fs.unlinkSync(tempPath);
            } catch (cleanupError) {
                // Ignore
            }
            
        } catch (err) {
            console.error('Quote command error:', err);
            
            // Send error message
            await client.sendMessage(M.chat.id,
                `❌ Error creating quote sticker: ${err.message}\n\n` +
                'Please try again with shorter text or different message.',
                { parse_mode: 'Markdown' }
            );
        }
    }
};