const axios = require('axios');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

class QuoteGenerator {
    constructor(client) {
        this.client = client;
        
        // Telegram-like fonts (if available)
        try {
            const fontPath = path.join(__dirname, '../../assets/fonts');
            if (fs.existsSync(path.join(fontPath, 'Roboto-Regular.ttf'))) {
                registerFont(path.join(fontPath, 'Roboto-Regular.ttf'), { family: 'Roboto' });
                registerFont(path.join(fontPath, 'Roboto-Bold.ttf'), { family: 'Roboto Bold' });
            }
        } catch (err) {
            console.log('Using default fonts for quote generator');
        }
    }

    /**
     * Generate a Telegram-style quote image
     * @param {string} text - The quote text
     * @param {string} name - Username
     * @param {string} avatar - Profile picture URL
     * @param {Object} options - Additional options
     * @returns {Buffer} - Image buffer
     */
    async generateQuote(text, name, avatar, options = {}) {
        try {
            console.log(`🎨 Generating quote for: ${name}`);
            
            // Try using external API first (faster and better quality)
            try {
                return await this.generateWithAPI(text, name, avatar, options);
            } catch (apiError) {
                console.log('API generation failed, falling back to canvas:', apiError.message);
                return await this.generateWithCanvas(text, name, avatar, options);
            }
        } catch (error) {
            console.error('❌ Quote generation error:', error);
            throw error;
        }
    }

    /**
     * Generate quote using external API (better quality)
     */
    async generateWithAPI(text, name, avatar, options) {
        const payload = {
            type: "quote",
            format: "png",
            backgroundColor: "#17212B", // Telegram dark theme background
            width: 512,
            height: 768,
            scale: 2,
            messages: [
                {
                    entities: [],
                    avatar: true,
                    from: {
                        id: 1,
                        name: name,
                        photo: {
                            url: avatar
                        }
                    },
                    text: text,
                    replyMessage: {},
                    textColor: "#FFFFFF", // White text
                    timeColor: "#7B8A9B", // Telegram timestamp color
                    nameColor: "#54B7F9" // Telegram blue for names
                }
            ]
        };

        try {
            const res = await axios.post(
                "https://bot.lyo.su/quote/generate",
                payload,
                { 
                    headers: { "Content-Type": "application/json" },
                    timeout: 15000
                }
            );

            if (res.data && res.data.result && res.data.result.image) {
                return Buffer.from(res.data.result.image, "base64");
            } else {
                throw new Error('Invalid API response');
            }
        } catch (apiError) {
            // Try alternative API
            return await this.generateWithAlternativeAPI(text, name, avatar);
        }
    }

    /**
     * Alternative API endpoint
     */
    async generateWithAlternativeAPI(text, name, avatar) {
        try {
            const payload = {
                "type": "quote",
                "format": "png",
                "backgroundColor": "#1B2733",
                "width": 512,
                "height": 768,
                "scale": 2,
                "messages": [
                    {
                        "entities": [],
                        "avatar": true,
                        "from": {
                            "id": 1,
                            "name": name,
                            "photo": {
                                "url": avatar
                            }
                        },
                        "text": text,
                        "replyMessage": {}
                    }
                ]
            };

            const res = await axios.post(
                "https://quote-api.tioclkp.repl.co/generate",
                payload,
                { 
                    headers: { "Content-Type": "application/json" },
                    timeout: 10000
                }
            );

            if (res.data && res.data.result && res.data.result.image) {
                return Buffer.from(res.data.result.image, "base64");
            }
            throw new Error('Alternative API failed');
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generate quote using Canvas (fallback)
     */
    async generateWithCanvas(text, name, avatar, options) {
        const width = 512;
        const height = 768;
        const padding = 40;
        const avatarSize = 60;
        
        // Create canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Telegram dark theme background
        ctx.fillStyle = '#17212B';
        ctx.fillRect(0, 0, width, height);
        
        // Add Telegram header (blue strip)
        ctx.fillStyle = '#54B7F9';
        ctx.fillRect(0, 0, width, 4);
        
        try {
            // Load and draw avatar
            if (avatar) {
                const avatarImg = await loadImage(avatar);
                
                // Create circular avatar
                ctx.save();
                ctx.beginPath();
                ctx.arc(padding + avatarSize/2, padding + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                
                ctx.drawImage(avatarImg, padding, padding, avatarSize, avatarSize);
                ctx.restore();
            } else {
                // Draw default avatar
                ctx.fillStyle = '#54B7F9';
                ctx.beginPath();
                ctx.arc(padding + avatarSize/2, padding + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
                ctx.fill();
                
                // Add initial
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 24px Arial';
                ctx.fillText(name.charAt(0).toUpperCase(), padding + avatarSize/2, padding + avatarSize/2);
            }
        } catch (error) {
            console.log('Error loading avatar:', error.message);
            // Draw default avatar
            ctx.fillStyle = '#54B7F9';
            ctx.beginPath();
            ctx.arc(padding + avatarSize/2, padding + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
            ctx.fill();
            
            // Add initial
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(name.charAt(0).toUpperCase(), padding + avatarSize/2, padding + avatarSize/2);
        }
        
        // Draw name
        ctx.fillStyle = '#54B7F9'; // Telegram blue
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(name, padding * 2 + avatarSize, padding + 10);
        
        // Draw timestamp
        ctx.fillStyle = '#7B8A9B'; // Telegram timestamp gray
        ctx.font = '14px Arial';
        const timeText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        ctx.fillText(timeText, padding * 2 + avatarSize, padding + 32);
        
        // Draw message text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        
        // Calculate text position
        const textX = padding;
        const textY = padding * 2 + avatarSize + 10;
        const maxWidth = width - (padding * 2);
        
        // Wrap text
        const lines = this.wrapText(ctx, text, maxWidth);
        let lineY = textY;
        
        for (let line of lines) {
            ctx.fillText(line, textX, lineY);
            lineY += 24; // Line height
        }
        
        // Add Telegram message bubble effect
        ctx.strokeStyle = '#2B5278';
        ctx.lineWidth = 1;
        ctx.strokeRect(padding - 5, padding * 2 + avatarSize, maxWidth + 10, lineY - textY + 10);
        
        // Add subtle gradient at bottom
        const gradient = ctx.createLinearGradient(0, height - 100, 0, height);
        gradient.addColorStop(0, 'rgba(23, 33, 43, 0)');
        gradient.addColorStop(1, '#17212B');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - 100, width, 100);
        
        return canvas.toBuffer('image/png');
    }

    /**
     * Wrap text to fit within max width
     */
    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        lines.push(currentLine);
        return lines;
    }

    /**
     * Convert image to sticker (512x512 PNG with transparent background)
     */
    async convertToSticker(imageBuffer) {
        try {
            const img = await loadImage(imageBuffer);
            
            // Create square canvas for sticker
            const size = 512;
            const canvas = createCanvas(size, size);
            const ctx = canvas.getContext('2d');
            
            // Make background transparent
            ctx.clearRect(0, 0, size, size);
            
            // Calculate dimensions to fit
            const ratio = Math.min(size / img.width, size / img.height);
            const newWidth = img.width * ratio;
            const newHeight = img.height * ratio;
            const x = (size - newWidth) / 2;
            const y = (size - newHeight) / 2;
            
            // Draw image centered
            ctx.drawImage(img, x, y, newWidth, newHeight);
            
            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error converting to sticker:', error);
            return imageBuffer; // Return original if conversion fails
        }
    }
}

module.exports = QuoteGenerator;