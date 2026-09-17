const axios = require('axios');

module.exports = {
    name: 'ytv',
    aliases: ['youtubevideo', 'ytvideo', 'ytmp4'],
    category: 'media',
    usage: '.ytv <YouTube URL>',
    description: 'Download YouTube videos',
    exp: 5,
    cool: 10,
    react: '🎬',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const query = arg || '';

        if (!query.trim()) {
            return client.sendMessage(chatId, 
                "❌ *Please provide a YouTube URL!*\n\n" +
                "*Examples:*\n" +
                "• `.ytv https://youtu.be/dQw4w9WgXcQ`\n" +
                "• `.ytv https://www.youtube.com/watch?v=dQw4w9WgXcQ`\n" +
                "• `.ytv https://youtube.com/shorts/VIDEO_ID`",
                { parse_mode: 'Markdown' }
            );
        }

        // Extract video ID from various YouTube URL formats
        let videoId = extractYouTubeId(query);
        
        if (!videoId) {
            return client.sendMessage(chatId, 
                "❌ *Invalid YouTube URL!*\n\n" +
                "Please provide a valid YouTube URL.\n" +
                "Supported formats:\n" +
                "• youtube.com/watch?v=ID\n" +
                "• youtu.be/ID\n" +
                "• youtube.com/shorts/ID",
                { parse_mode: 'Markdown' }
            );
        }

        try {
            // Send initial message
            const processingMsg = await client.sendMessage(chatId, 
                "🔍 *Processing YouTube video...*", 
                { parse_mode: 'Markdown' }
            );

            // Construct API URL
            const apiUrl = `https://apis.prexzyvilla.site/download/youtube-mp4?url=https://youtu.be/${videoId}`;
            
            console.log(`🌐 Calling API: ${apiUrl}`);
            
            // Call API with timeout
            const response = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.data || !response.data.status) {
                await client.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
                return client.sendMessage(chatId, 
                    "❌ *Failed to fetch video information!*\n\n" +
                    "API returned an error. Try again later.",
                    { parse_mode: 'Markdown' }
                );
            }

            const data = response.data;
            
            // Check if download URL exists
            if (!data.download || !data.download.url) {
                await client.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
                return client.sendMessage(chatId, 
                    "❌ *No download URL available!*\n\n" +
                    "This video might not be available for download.",
                    { parse_mode: 'Markdown' }
                );
            }

            const videoUrl = data.download.url;
            const videoInfo = data.video_info || {};
            const quality = data.download.quality || 'Unknown';
            const size = data.download.size || 'Unknown';
            
            console.log(`✅ Got video URL: ${videoUrl}`);
            console.log(`📊 Quality: ${quality}, Size: ${size}`);

            // Delete processing message and send new downloading message
            await client.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
            const downloadingMsg = await client.sendMessage(chatId, 
                "💠 *Downloading video...*", 
                { parse_mode: 'Markdown' }
            );

            try {
                // Download video
                const videoResponse = await axios({
                    method: 'GET',
                    url: videoUrl,
                    responseType: 'arraybuffer',
                    timeout: 60000, // 1 minute timeout for video
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://youtube.com/',
                        'Origin': 'https://youtube.com'
                    }
                });

                const videoBuffer = Buffer.from(videoResponse.data);
                
                // Check if video is valid (at least 100KB)
                if (videoBuffer.length < 102400) {
                    throw new Error('Video file too small, likely invalid');
                }

                // Generate caption
                const title = videoInfo.title || 'YouTube Video';
                const caption = `ㅤㅤㅤㅤㅤㅤㅤㅤㅤ*\n\n` +
                               `\n💠 Downloaded by *ZeroTwo*`;
                
                // Delete downloading message
                await client.deleteMessage(chatId, downloadingMsg.message_id).catch(() => {});

                // Send video - Using client.bot if client.sendVideo doesn't work
                try {
                    await client.sendVideo(chatId, videoBuffer, {
                        caption: caption,
                        parse_mode: 'Markdown',
                        supports_streaming: true
                    });
                } catch (sendError) {
                    // Fallback to using bot directly
                    console.log('Using bot.sendVideo as fallback...');
                    await client.bot.sendVideo(chatId, videoBuffer, {
                        caption: caption,
                        parse_mode: 'Markdown',
                        supports_streaming: true
                    });
                }

                console.log(`✅ Successfully sent video: ${title}`);

            } catch (downloadError) {
                console.error('Video download error:', downloadError.message);
                
                // Delete downloading message
                await client.deleteMessage(chatId, downloadingMsg.message_id).catch(() => {});
                
                // Try sending the video URL directly
                const fallbackMsg = await client.sendMessage(chatId, 
                    "❌ *Direct download failed, trying alternative method...*", 
                    { parse_mode: 'Markdown' }
                );

                try {
                    // Try sending via URL
                    await client.bot.sendVideo(chatId, videoUrl, {
                        caption: `💠 Downloaded by *ZeroTwo*\n\n*Note:* Sent via direct URL`,
                        parse_mode: 'Markdown',
                        supports_streaming: true
                    });
                    
                    await client.deleteMessage(chatId, fallbackMsg.message_id).catch(() => {});
                    
                } catch (urlError) {
                    console.error('Alternative method also failed:', urlError.message);
                    
                    await client.deleteMessage(chatId, fallbackMsg.message_id).catch(() => {});
                    
                    await client.sendMessage(chatId, 
                        "❌ *Failed to download video!*\n\n" +
                        "Possible reasons:\n" +
                        "• Video is too large\n" +
                        "• Download link expired\n" +
                        "• Video is not available\n\n" +
                        "Try:\n" +
                        "• Shorter videos\n" +
                        "• Different video\n" +
                        "• Try again later",
                        { parse_mode: 'Markdown' }
                    );
                }
            }

        } catch (error) {
            console.error('ytv command error:', error);
            
            let errorMessage = "❌ *An error occurred!*\n\n";
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += "Request timeout! Video might be too large.\nTry a shorter video.";
            } else if (error.response) {
                errorMessage += `API Error: ${error.response.status}`;
            } else if (error.request) {
                errorMessage += "No response from server. Check your internet.";
            } else {
                errorMessage += `Error: ${error.message}`;
            }
            
            await client.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
        }
    }
};

// Helper function to extract YouTube ID from various URL formats
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}