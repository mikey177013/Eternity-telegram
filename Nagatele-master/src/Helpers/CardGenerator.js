const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CardGenerator {
    constructor(client) {
        this.client = client;
        this.templatePath = path.join(__dirname, '../../assets/images/sanomanjiro.jpg');
        
        // Check if template exists
        if (!fs.existsSync(this.templatePath)) {
            console.error('❌ Template image not found:', this.templatePath);
            throw new Error('Template image not found');
        }
        
        // Card dimensions
        this.IMAGE_WIDTH = 4096;
        this.IMAGE_HEIGHT = 2932;
        
        // Rectangle coordinates for name
        this.rectX1 = 2080;
        this.rectY1 = 1562;
        this.rectX2 = 3460;
        this.rectY2 = 1841;
        
        // Circle coordinates for profile picture
        this.circleCenterX = 1209;
        this.circleCenterY = 1489.5;
        this.circleRadius = 738.5;
        
        console.log('✅ Card Generator initialized with template:', this.templatePath);
    }

    async generateMemberCard(userId, firstName, fullName, username = null) {
        try {
            console.log(`🎨 Generating member card for: ${firstName} (ID: ${userId})`);

            // Create canvas
            const canvas = createCanvas(this.IMAGE_WIDTH, this.IMAGE_HEIGHT);
            const ctx = canvas.getContext('2d');

            // Load template image
            const templateImg = await loadImage(this.templatePath);
            ctx.drawImage(templateImg, 0, 0, this.IMAGE_WIDTH, this.IMAGE_HEIGHT);

            // Add profile picture
            await this.addProfilePicture(ctx, userId, firstName);

            // Add user name
            this.addUserName(ctx, firstName);

            // Convert canvas to buffer
            const buffer = canvas.toBuffer('image/jpeg', { 
                quality: 0.95,
                progressive: true 
            });

            console.log('✅ Member card created successfully!');
            return buffer;

        } catch (err) {
            console.error('❌ Error creating member card:', err);
            throw err;
        }
    }

    async addProfilePicture(ctx, userId, firstName) {
        try {
            console.log(`📸 Fetching profile photo for user ${userId}...`);

            // Use your client's getUserProfilePhotos method
            const photos = await this.client.getUserProfilePhotos(Number(userId), { offset: 0, limit: 1 });

            if (photos.total_count > 0 && photos.photos && photos.photos.length > 0) {
                console.log('✅ Profile photo found, loading...');

                // Get the largest available photo
                const photo = photos.photos[0];
                const largestPhoto = photo[photo.length - 1];

                // Get file information
                const file = await this.client.getFile(largestPhoto.file_id);

                if (file && file.file_path) {
                    // Construct the file URL
                    const fileUrl = `https://api.telegram.org/file/bot${this.client.bot.token}/${file.file_path}`;
                    console.log('📸 Profile photo URL:', fileUrl);

                    // Download profile picture
                    const profileResponse = await axios.get(fileUrl, { 
                        responseType: 'arraybuffer',
                        timeout: 10000 
                    });

                    const profileBuffer = Buffer.from(profileResponse.data);
                    const profileImg = await loadImage(profileBuffer);

                    // Create circular clipping path
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(this.circleCenterX, this.circleCenterY, this.circleRadius, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();

                    // Draw profile picture
                    const profileSize = this.circleRadius * 2;
                    const profileX = this.circleCenterX - this.circleRadius;
                    const profileY = this.circleCenterY - this.circleRadius;

                    ctx.drawImage(
                        profileImg, 
                        0, 0, profileImg.width, profileImg.height,
                        profileX, profileY,
                        profileSize, profileSize
                    );

                    ctx.restore();
                    console.log('✅ Profile picture added successfully');
                    return;
                }
            }
            
            // If no profile picture, draw default
            console.log('ℹ️ No profile picture found, drawing default');
            this.drawDefaultProfilePicture(ctx, firstName);

        } catch (profileErr) {
            console.log('⚠️ Profile picture error:', profileErr.message);
            this.drawDefaultProfilePicture(ctx, firstName);
        }
    }

    addUserName(ctx, firstName) {
        // Calculate rectangle dimensions
        const rectWidth = this.rectX2 - this.rectX1;
        const rectHeight = this.rectY2 - this.rectY1;

        // Text position - LEFT ALIGNED with padding
        const textX = this.rectX1 + 40;
        const textY = this.rectY1 + (rectHeight / 2);

        ctx.save();

        // Set text properties
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Calculate font size
        let fontSize = Math.min(rectHeight * 0.6, 150);
        fontSize = Math.max(fontSize, 40);

        // Set font
        ctx.font = `bold ${fontSize}px Arial`;

        // Add text shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Check if text fits
        const displayName = firstName;
        const textMetrics = ctx.measureText(displayName);
        const maxTextWidth = rectWidth - 80;
        let finalName = displayName;

        if (textMetrics.width > maxTextWidth) {
            let shortenedName = displayName;
            while (shortenedName.length > 3 && ctx.measureText(shortenedName + '...').width > maxTextWidth) {
                shortenedName = shortenedName.slice(0, -1);
            }
            finalName = shortenedName + '...';
        }

        // Draw the name text
        ctx.fillText(finalName, textX, textY);

        // Add stroke for better visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(finalName, textX, textY);

        ctx.restore();
    }

    drawDefaultProfilePicture(ctx, name) {
        console.log('🎨 Drawing default profile picture...');

        // Create a gradient
        const gradient = ctx.createRadialGradient(
            this.circleCenterX, this.circleCenterY, this.circleRadius * 0.3,
            this.circleCenterX, this.circleCenterY, this.circleRadius
        );
        gradient.addColorStop(0, '#4F46E5');
        gradient.addColorStop(1, '#7C3AED');

        // Draw circle background
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.circleCenterX, this.circleCenterY, this.circleRadius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();

        // Add initial letter
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const initial = name.charAt(0).toUpperCase();
        const fontSize = this.circleRadius * 1.2;

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText(initial, this.circleCenterX, this.circleCenterY);
        ctx.restore();
    }

    // Generate welcome card with caption and buttons
    async generateWelcomeCard(chatId, user, groupName) {
        try {
            const userId = user.id;
            const firstName = user.first_name || 'User';
            const username = user.username ? `@${user.username}` : firstName;
            
            console.log(`🎴 Generating welcome card for ${firstName} in ${groupName}`);
            
            // Check if user is already registered
            const isRegistered = await this.client.checkUserRegistration(userId);
            
            // Generate the member card
            const imageBuffer = await this.generateMemberCard(userId, firstName, user.first_name + ' ' + (user.last_name || ''), username);
            
            // Create caption
            const caption = `🌸 *Welcome ${username}!* 🌸\n\n` +
                           `✨ Welcome to *${groupName}*! ✨\n\n` +
                           `I hope you will have lots of fun here! 💫\n\n` +
                           `Type \`.menu\` to get started${isRegistered ? '' : ' and register yourself here'}!`;
            
            // Create buttons
            const buttons = [];
            
            if (!isRegistered) {
                buttons.push([
                    {
                        text: '📝 Register Yourself',
                        url: 'https://t.me/ZeroTwo_1bot?start=register'
                    }
                ]);
            }
            
            buttons.push([
                {
                    text: 'PHOENIX',
                    callback_data: 'help_start'
                }
            ]);
            
            return {
                imageBuffer,
                caption,
                reply_markup: {
                    inline_keyboard: buttons
                }
            };
        } catch (error) {
            console.error('❌ Error generating welcome card:', error);
            throw error;
        }
    }
}

module.exports = CardGenerator;