const axios = require('axios');

module.exports = {
    name: 'yta',
    aliases: ['youtubeaudio', 'ytmp3', 'youtubemp3'],
    category: 'media',
    usage: '.yta <YouTube URL>',
    description: 'Download YouTube audio as MP3',
    exp: 5,
    cool: 10,
    react: '🎵',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const url = arg.trim();

        if (!url) {
            return client.sendMessage(chatId, 
                "❌ *Please provide a YouTube URL!*\n\n" +
                "*Examples:*\n" +
                "• `.yta https://youtu.be/dQw4w9WgXcQ`\n" +
                "• `.yta https://www.youtube.com/watch?v=dQw4w9WgXcQ`",
                { parse_mode: 'Markdown' }
            );
        }

        // Extract video ID
        const videoId = getYouTubeId(url);
        if (!videoId) {
            return client.sendMessage(chatId, 
                "❌ *Invalid YouTube URL!*\n\n" +
                "Please provide a valid YouTube URL.",
                { parse_mode: 'Markdown' }
            );
        }

        let processingMsg = null;
        let downloadingMsg = null;

        try {
            // Send processing message
            processingMsg = await client.sendMessage(chatId, "🔍 *Processing audio...*", { parse_mode: 'Markdown' });

            // Call API
            const apiUrl = `https://apis.prexzyvilla.site/download/youtube-mp3?url=https://youtu.be/${videoId}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });

            if (!response.data?.status || !response.data?.download?.url) {
                // Delete processing message
                if (processingMsg) await client.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
                return client.sendMessage(chatId, "❌ *Could not fetch audio!*", { parse_mode: 'Markdown' });
            }

            const audioUrl = response.data.download.url;
            const title = response.data.video_info?.title || 'phoenix';
            const quality = response.data.download.quality || '128kbps';
            
            // Delete processing message
            if (processingMsg) await client.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
            
            // Send downloading message
            downloadingMsg = await client.sendMessage(chatId, "⬇️ *Downloading audio...*", { parse_mode: 'Markdown' });

            try {
                // Download audio
                const audioRes = await axios.get(audioUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                const audioBuffer = Buffer.from(audioRes.data);
                
                // Check if audio is valid
                if (audioBuffer.length < 10240) {
                    throw new Error('Audio file too small');
                }

                // Delete downloading message
                if (downloadingMsg) await client.deleteMessage(chatId, downloadingMsg.message_id).catch(() => {});

                // Generate filename: phoenix.mp3
                const filename = 'phoenix.mp3';
                
                // Send audio
                await client.bot.sendDocument(chatId, audioBuffer, {
                    caption: "💠 Downloaded by ZeroTwo",
                    filename: filename
                });

            } catch (err) {
                console.error('Direct download failed:', err.message);
                
                // Delete downloading message if exists
                if (downloadingMsg) await client.deleteMessage(chatId, downloadingMsg.message_id).catch(() => {});
                
                // Try sending via URL with phoenix.mp3 filename
                try {
                    await client.bot.sendDocument(chatId, audioUrl, {
                        caption: "💠 Downloaded by ZeroTwo",
                        filename: 'phoenix.mp3'
                    });
                } catch (urlError) {
                    throw new Error('Both download methods failed');
                }
            }

        } catch (error) {
            // Clean up any remaining messages
            if (processingMsg) await client.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
            if (downloadingMsg) await client.deleteMessage(chatId, downloadingMsg.message_id).catch(() => {});
            
            console.error('YTA error:', error.message);
            
            let errorMsg = "❌ *Error downloading audio!*";
            if (error.code === 'ECONNABORTED') {
                errorMsg += "\nRequest timeout. Try a shorter video.";
            } else if (error.message.includes('404')) {
                errorMsg += "\nAudio not found.";
            } else if (error.message.includes('Both download methods failed')) {
                errorMsg += "\nFailed to download audio. Try again later.";
            }
            
            await client.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
        }
    }
};

// Helper function to extract YouTube ID
function getYouTubeId(url) {
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