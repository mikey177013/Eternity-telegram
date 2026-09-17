// src/Commands/Media/Play.js
const axios = require('axios');

module.exports = {
    name: 'play',
    aliases: ['song'],
    category: 'media',
    usage: '.play <song name>',
    description: 'Search and download YouTube audio',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const query = arg || '';
        
        if (!query.trim()) {
            return client.sendMessage(chatId, "❌ Please provide a song name.\nExample: .play senorita");
        }

        try {
            // Send searching message
            const sentMsg = await client.sendMessage(chatId, "🎵 Searching for song...");
            const sentMsgId = sentMsg.message_id;

            try {
                // API call
                const apiUrl = `https://apis.davidcyriltech.my.id/play?query=${encodeURIComponent(query)}`;
                const { data } = await axios.get(apiUrl);

                if (!data || !data.status || !data.result || !data.result.download_url) {
                    // Delete searching message
                    try { await client.deleteMessage(chatId, sentMsgId); } catch {}
                    return client.sendMessage(chatId, "❌ No audio found. Try another keyword.");
                }

                const { title, video_url, thumbnail, download_url, duration, views, published } = data.result;
                
                // Delete searching message
                try { await client.deleteMessage(chatId, sentMsgId); } catch {}
                
                // Send thumbnail with song info
                await client.sendPhoto(chatId, thumbnail, {
                    caption: `🎵 *${title}*\n\n⏱️ Duration: ${duration || 'Unknown'}\n👁️ Views: ${views ? formatNumber(views) : 'Unknown'}\n📅 ${published || 'Unknown'}\n\n🔗 YouTube: ${video_url}`,
                    parse_mode: 'Markdown'
                });
                
                // Download audio
                const audioResponse = await axios.get(download_url, {
                    responseType: 'arraybuffer'
                });
                
                const audioBuffer = Buffer.from(audioResponse.data);
                
                // Send audio as document (most reliable method)
                await client.sendDocument(chatId, audioBuffer, {
                    caption: `🎵 ${title.substring(0, 100)}`,
                    filename: `${cleanFilename(title)}.mp3`
                });

            } catch (error) {
                console.error('Download error:', error.message);
                // Delete searching message
                try { await client.deleteMessage(chatId, sentMsgId); } catch {}
                await client.sendMessage(chatId, "❌ Error downloading audio. Please try again.");
            }
            
        } catch (err) {
            console.error('Play command error:', err);
            await client.sendMessage(chatId, "❌ An error occurred.");
        }
    }
};

// Helper function to format numbers
function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Helper function to clean filename
function cleanFilename(str) {
    return str.substring(0, 50)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_');
}