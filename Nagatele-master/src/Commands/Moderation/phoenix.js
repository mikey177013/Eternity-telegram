const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'phoenix',
    category: 'Moderation',
    description: 'bot owner',
    usage: '.phoenix',
    
    async execute(client, args, M) {
        const chatId = M.chat.id;
        
        try {
            // Path to the local image
            const imagePath = path.join(__dirname, '../../../assets/images/phoenix.png');
            
            // Check if file exists
            if (!fs.existsSync(imagePath)) {
                console.log('Phoenix image not found at:', imagePath);
                return;
            }
            
            // Send the local phoenix image
            await client.sendPhoto(chatId, fs.createReadStream(imagePath), {
                disable_notification: true
            });
            
        } catch (error) {
            // Fail silently
            console.log('Phoenix command error:', error.message);
        }
    }
};