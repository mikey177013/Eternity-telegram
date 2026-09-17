const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: 'horny',
    aliases: ['hornylicense', 'hornycard'],
    category: 'fun',
    exp: 5,
    cool: 10,
    description: 'Give someone an official Horny License',
    usage: 'Reply to a user or use /horny @username',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const messageId = M.message_id;
            
            // Get target user
            let targetUserId;
            let targetUserName = 'User';
            let targetUsername = 'user';

            // Check if replying to a message
            if (M.reply_to_message) {
                targetUserId = M.reply_to_message.from.id;
                targetUserName = M.reply_to_message.from.first_name || 'User';
                targetUsername = M.reply_to_message.from.username || targetUserName.toLowerCase().replace(/\s+/g, '_');
            } 
            // Use command sender
            else {
                targetUserId = M.from.id;
                targetUserName = M.from.first_name || 'User';
                targetUsername = M.from.username || targetUserName.toLowerCase().replace(/\s+/g, '_');
            }

            // Send processing message
            const processingMsg = await client.bot.sendMessage(
                chatId,
                "🎨 *Generating Horny License...*",
                {
                    parse_mode: 'Markdown',
                    reply_to_message_id: messageId
                }
            );

            // Template path - PNG format
            const templatePath = path.join(process.cwd(), 'assets', 'images', 'horny.png');
            
            // Check if template exists
            if (!fs.existsSync(templatePath)) {
                await client.bot.editMessageText(
                    "❌ *Template not found!*\n\n" +
                    "Please place `horny.png` in `assets/images/` folder.",
                    {
                        chat_id: chatId,
                        message_id: processingMsg.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }

            // Get user profile picture
            let userPfpBuffer;
            try {
                // Try to get profile photos
                const photos = await client.bot.getUserProfilePhotos(targetUserId, { limit: 1 });
                if (photos.total_count > 0) {
                    const file = await client.bot.getFile(photos.photos[0][0].file_id);
                    const fileUrl = `https://api.telegram.org/file/bot${client.bot.token}/${file.file_path}`;
                    
                    // Download profile picture
                    const response = await axios({
                        method: 'GET',
                        url: fileUrl,
                        responseType: 'arraybuffer'
                    });
                    
                    userPfpBuffer = Buffer.from(response.data);
                }
            } catch (pfpErr) {
                console.log('Could not get profile picture:', pfpErr.message);
            }

            // Create canvas with exact dimensions
            const canvas = createCanvas(829, 529);
            const ctx = canvas.getContext('2d');

            try {
                // Load template
                const templateBuffer = fs.readFileSync(templatePath);
                const template = await loadImage(templateBuffer);
                
                // Draw template background
                ctx.drawImage(template, 0, 0, 829, 529);

                // Draw user profile picture in RECTANGLE if available
                if (userPfpBuffer) {
                    try {
                        const pfpImage = await loadImage(userPfpBuffer);
                        
                        // Rectangle coordinates: (110, 146) to (300, 366)
                        const rectX = 110;
                        const rectY = 146;
                        const rectWidth = 193;  // 300 - 110 = 190
                        const rectHeight = 223; // 366 - 146 = 220
                        
                        // Draw profile picture in rectangle
                        ctx.save();
                        
                        // Create rectangle clipping path
                        ctx.beginPath();
                        ctx.rect(rectX, rectY, rectWidth, rectHeight);
                        ctx.closePath();
                        ctx.clip();
                        
                        // Calculate aspect ratio and position to cover rectangle
                        const imgRatio = pfpImage.width / pfpImage.height;
                        const rectRatio = rectWidth / rectHeight;
                        
                        let drawWidth, drawHeight, drawX, drawY;
                        
                        if (imgRatio > rectRatio) {
                            // Image is wider than rectangle - fit to height
                            drawHeight = rectHeight;
                            drawWidth = pfpImage.width * (rectHeight / pfpImage.height);
                            drawX = rectX - (drawWidth - rectWidth) / 2;
                            drawY = rectY;
                        } else {
                            // Image is taller than rectangle - fit to width
                            drawWidth = rectWidth;
                            drawHeight = pfpImage.height * (rectWidth / pfpImage.width);
                            drawX = rectX;
                            drawY = rectY - (drawHeight - rectHeight) / 2;
                        }
                        
                        ctx.drawImage(pfpImage, drawX, drawY, drawWidth, drawHeight);
                        ctx.restore();
                        
                        // Optional: Add a thin border around the rectangle
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
                        
                    } catch (avatarErr) {
                        console.log('Error drawing avatar:', avatarErr.message);
                    }
                }

                // Set font styles
                
                // 1. Draw User's First Name (Italic, Left-aligned)
                // Rectangle: (375, 183) to (605, 215)
                ctx.font = 'italic bold 28px Arial';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                
                // Truncate name if too long
                let displayName = targetUserName;
                const maxNameWidth = 220; // Width of rectangle
                
                // Measure text and truncate if needed
                let nameWidth = ctx.measureText(displayName).width;
                if (nameWidth > maxNameWidth) {
                    // Find appropriate length
                    let truncated = displayName;
                    while (ctx.measureText(truncated + '...').width > maxNameWidth && truncated.length > 1) {
                        truncated = truncated.slice(0, -1);
                    }
                    displayName = truncated + '...';
                }
                
                // Left side of rectangle (add some padding)
                const nameX = 380; // Slightly right from left edge
                const nameY = 183 + ((215 - 183) / 2);  // 199
                ctx.fillText(displayName, nameX, nameY);

                // 2. Draw User ID only (Left-aligned)
                // Rectangle: (387, 243) to (571, 265)
                ctx.font = 'bold 22px Arial';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                
                const userIdText = targetUserId.toString();
                const idX = 392; // Slightly right from left edge
                const idY = 243 + ((265 - 243) / 2);  // 254
                ctx.fillText(userIdText, idX, idY);

                // 3. Draw Username (Left-aligned)
                // Rectangle: (373, 282) to (555, 301)
                ctx.font = 'bold 20px Arial';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                
                const usernameText = `@${targetUsername}`;
                const usernameX = 378; // Slightly right from left edge
                const usernameY = 282 + ((301 - 282) / 2);  // 291.5
                ctx.fillText(usernameText, usernameX, usernameY);

                // Convert canvas to buffer
                const buffer = canvas.toBuffer('image/png');
                
                // Send the image
                await client.bot.sendPhoto(
                    chatId,
                    buffer,
                    {
                        caption: `📄 *Horny License issued to* ${targetUserName}\n\n` +
                                `👤 User ID: ${targetUserId}\n` +
                                `📱 Username: @${targetUsername}\n\n` +
                                `_This license certifies extreme horny levels! 🎫_`,
                        parse_mode: 'Markdown',
                        reply_to_message_id: messageId
                    }
                );

                // Delete processing message
                await client.bot.deleteMessage(chatId, processingMsg.message_id);

            } catch (error) {
                console.error('Horny license generation error:', error);
                
                await client.bot.editMessageText(
                    `❌ *Error generating license!*\n\n` +
                    `Error: ${error.message || 'Unknown error'}`,
                    {
                        chat_id: chatId,
                        message_id: processingMsg.message_id,
                        parse_mode: 'Markdown'
                    }
                );
            }

        } catch (err) {
            console.error('Horny command error:', err);
            
            try {
                await client.bot.sendMessage(
                    M.chat.id,
                    "❌ An error occurred while generating the Horny License. Please try again.",
                    {
                        parse_mode: 'Markdown',
                        reply_to_message_id: M.message_id
                    }
                );
            } catch (sendErr) {
                console.error('Failed to send error message:', sendErr);
            }
        }
    }
};