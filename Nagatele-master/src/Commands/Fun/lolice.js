const axios = require('axios');

module.exports = {
    name: 'lolice',
    aliases: ['police', 'lolichief'],
    category: 'Fun',
    description: 'Generate a lolice meme with user profile picture',
    usage: '.lolice [@user or reply]',
    cooldown: 5,

    async execute(client, args, M) {
        try {
            const chatId = M.chat.id;
            const userId = M.from.id;
            
            // Determine target user
            let targetUserId = userId;
            let targetName = M.from.first_name || 'User';
            
            // Check if replying to someone
            if (M.reply_to_message && M.reply_to_message.from) {
                targetUserId = M.reply_to_message.from.id;
                targetName = M.reply_to_message.from.first_name || 'User';
            }
            
            // Check if mentioned someone
            else if (args && args.includes('@')) {
                // Extract username from args
                const mentionedUsername = args.replace('@', '').trim();
                // Note: Getting ID from username requires additional logic
                // For now, use current user
                await client.sendMessage(chatId,
                    `⚠️ *Note:* Getting user by @mention requires special handling.\n` +
                    `Using your profile picture instead.\n\n` +
                    `*Pro tip:* Reply to someone's message instead!`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Get user profile photo URL
            const profilePhotoUrl = await client.getUserProfilePhotoUrl(targetUserId);
            
            // If no profile photo, use default
            if (!profilePhotoUrl) {
                return client.sendMessage(chatId,
                    `❌ ${targetName} doesn't have a profile picture!\n\n` +
                    `Please set a profile picture first, or try with another user.`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Send processing message
            const processingMsg = await client.sendMessage(chatId,
                `🖼️ Generating lolice image for ${targetName}...`,
                { parse_mode: 'Markdown' }
            );
            
            // Try multiple APIs in case one fails
            let generatedImage = null;
            
            // OPTION 1: Try Some Random API (if available)
            try {
                const apiUrl = `https://some-random-api.com/canvas/misc/lolice?avatar=${encodeURIComponent(profilePhotoUrl)}`;
                const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
                
                if (response.status === 200) {
                    generatedImage = Buffer.from(response.data, 'binary');
                }
            } catch (api1Error) {
                console.log('Some-Random-API failed:', api1Error.message);
            }
            
            // OPTION 2: Try another similar service as fallback
            if (!generatedImage) {
                try {
                    // Alternative API - jeyyapi (often works better)
                    const altApiUrl = `https://api.jeyy.xyz/image/lolice?image_url=${encodeURIComponent(profilePhotoUrl)}`;
                    const response = await axios.get(altApiUrl, { responseType: 'arraybuffer' });
                    
                    if (response.status === 200) {
                        generatedImage = Buffer.from(response.data, 'binary');
                    }
                } catch (api2Error) {
                    console.log('Alternative API failed:', api2Error.message);
                }
            }
            
            // OPTION 3: Local generation fallback (simpler overlay)
            if (!generatedImage) {
                try {
                    const { createCanvas, loadImage } = require('canvas');
                    const canvas = createCanvas(400, 400);
                    const ctx = canvas.getContext('2d');
                    
                    // Load user profile
                    const userImg = await loadImage(profilePhotoUrl);
                    
                    // Draw user image
                    ctx.drawImage(userImg, 0, 0, 400, 400);
                    
                    // Add police hat overlay (would need an image file)
                    // This is simplified - you'd need a police hat PNG
                    
                    generatedImage = canvas.toBuffer('image/png');
                } catch (localError) {
                    console.log('Local generation failed:', localError.message);
                }
            }
            
            // Delete processing message
            try {
                await client.deleteMessage(chatId, processingMsg.message_id);
            } catch (e) {
                // Ignore
            }
            
            // Send result
            if (generatedImage) {
                const caption = `🚨 *LOLICE!*\n\n` +
                              `Suspect: *${targetName}*\n` +
                              `Generated by: *ZeroTwo* 💖\n\n` +
                              `_This is just for fun!_`;
                
                await client.sendPhoto(chatId, generatedImage, {
                    caption: caption,
                    parse_mode: 'Markdown'
                });
            } else {
                await client.sendMessage(chatId,
                    `❌ Failed to generate lolice image.\n\n` +
                    `API services might be down.\n` +
                    `Try again later or use a different command.`,
                    { parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            console.error('Lolice command error:', error);
            await client.sendMessage(M.chat.id,
                '❌ An error occurred while generating the lolice image.\n' +
                'Please try again later.',
                { parse_mode: 'Markdown' }
            );
        }
    }
};