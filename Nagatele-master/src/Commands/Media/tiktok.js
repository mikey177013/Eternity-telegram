// src/Commands/Media/tiktok.js (Fixed version)
const axios = require('axios');

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'tiktokdl', 'ttdl'],
    category: 'media',
    description: 'Download TikTok videos without watermark',
    usage: '.tiktok <url> or .tiktok <search query>',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const messageId = M.message_id;
            
            if (!arg.trim()) {
                return this.showHelp(client, chatId, messageId);
            }
            
            // Send initial message
            const statusMsg = await client.sendMessage(chatId,
                '🔄 *Processing TikTok...*\n' +
                '⏳ This may take a few seconds...',
                { 
                    parse_mode: 'Markdown',
                    reply_to_message_id: messageId 
                }
            );
            
            // Check if URL or search
            const isUrl = this.isTikTokUrl(arg);
            
            let result;
            if (isUrl) {
                result = await this.downloadTikTokWithFallback(arg);
            } else {
                result = await this.searchAndDownloadTikTok(arg);
            }
            
            // FIXED: Use sendMessage instead of editMessageText
            // Delete status message first
            try {
                await client.deleteMessage(chatId, statusMsg.message_id);
            } catch (e) {
                // Ignore if can't delete
            }
            
            // Send ready message
            const readyMsg = await client.sendMessage(chatId,
                `✅ *TikTok Ready!*\n` +
                `📦 Sending video...`,
                { 
                    parse_mode: 'Markdown',
                    reply_to_message_id: messageId 
                }
            );
            
            // Send the media
            await this.sendResult(client, chatId, result, M);
            
            // Delete ready message
            setTimeout(async () => {
                try {
                    await client.deleteMessage(chatId, readyMsg.message_id);
                } catch (e) {}
            }, 2000);
            
        } catch (error) {
            console.error('TikTok command error:', error);
            await client.sendMessage(M.chat.id,
                `❌ *Download Failed*\n\n` +
                `Error: ${error.message || 'Unknown error'}\n\n` +
                `💡 *Tips:*\n` +
                `• Make sure the TikTok link is valid\n` +
                `• Try again in a few minutes\n` +
                `• Use a different TikTok URL`,
                { 
                    parse_mode: 'Markdown',
                    reply_to_message_id: M.message_id 
                }
            );
        }
    },
    
    showHelp(client, chatId, messageId) {
        const botUsername = process.env.BOT_USERNAME || 'ZeroTwo_1bot';
        
        return client.sendMessage(chatId,
            `🎬 *TikTok Downloader*\n\n` +
            `📥 *Download Videos:*\n` +
            `Send any TikTok link:\n` +
            `• \`https://vm.tiktok.com/xxxxx\`\n` +
            `• \`https://www.tiktok.com/@user/video/123\`\n\n` +
            `🔍 *Search & Download:*\n` +
            `\`.tiktok cute cats\`\n` +
            `\`.tiktok funny memes\`\n\n` +
            `✨ *Features:*\n` +
            `✓ No watermark\n` +
            `✓ High quality\n` +
            `✓ Audio extraction\n` +
            `✓ Video info\n\n` +
            `📌 *Examples:*\n` +
            `\`.tiktok https://vm.tiktok.com/ZSNsjH7cG/\`\n` +
            `\`.tiktok dancing videos\`\n\n` +
            `💬 *Need help?* Contact @${botUsername}`,
            { 
                parse_mode: 'Markdown',
                reply_to_message_id: messageId 
            }
        );
    },
    
    isTikTokUrl(text) {
        const patterns = [
            /https?:\/\/(?:vt|vm)\.tiktok\.com\/\S+/i,
            /https?:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+/i,
            /https?:\/\/tiktok\.com\/@[\w.-]+\/video\/\d+/i,
            /https?:\/\/www\.tiktok\.com\/t\/\w+/i
        ];
        return patterns.some(pattern => pattern.test(text));
    },
    
    async downloadTikTokWithFallback(url) {
        const apis = [
            this.tryApi1,
            this.tryApi2
        ];
        
        for (const apiFunc of apis) {
            try {
                console.log(`Trying API: ${apiFunc.name}`);
                const result = await apiFunc(url);
                if (result) return result;
            } catch (error) {
                console.log(`API ${apiFunc.name} failed:`, error.message);
                continue;
            }
        }
        
        throw new Error('All TikTok APIs failed. Please try again later.');
    },
    
    async tryApi1(url) {
        // API 1: tikwm.com
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
        
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (response.data?.code === 0 && response.data?.data) {
            return {
                type: 'success',
                data: response.data.data,
                api: 'tikwm'
            };
        }
        throw new Error('API1 failed');
    },
    
    async tryApi2(url) {
        // API 2: tiklydown
        const apiUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (response.data?.video) {
            return {
                type: 'success',
                data: {
                    play: response.data.video,
                    title: response.data.title || 'TikTok Video',
                    author: {
                        nickname: response.data.author?.name || 'Unknown',
                        unique_id: response.data.author?.id || ''
                    },
                    play_count: response.data.play_count || 0,
                    digg_count: response.data.digg_count || 0,
                    comment_count: response.data.comment_count || 0,
                    share_count: response.data.share_count || 0,
                    duration: response.data.duration || 0
                },
                api: 'tiklydown'
            };
        }
        throw new Error('API2 failed');
    },
    
    // FIXED: Search AND download immediately
    async searchAndDownloadTikTok(query) {
        try {
            console.log(`🔍 Searching TikTok for: "${query}"`);
            
            // Search for videos
            const searchUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=5&hd=1`;
            
            const response = await axios.get(searchUrl, {
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (!response.data?.code === 0 || !response.data?.data?.videos || response.data.data.videos.length === 0) {
                throw new Error(`No TikTok videos found for: "${query}"`);
            }
            
            // Get the first (most relevant) video
            const video = response.data.data.videos[0];
            
            if (!video.play) {
                throw new Error('No video URL found in search results');
            }
            
            // Construct full URL if needed
            let videoUrl = video.play;
            if (!videoUrl.startsWith('http')) {
                videoUrl = `https://www.tikwm.com${videoUrl}`;
            }
            
            // Return video data for downloading
            return {
                type: 'success',
                data: {
                    ...video,
                    play: videoUrl,
                    // Make sure we have all required fields
                    title: video.title || `TikTok about ${query}`,
                    author: video.author || { nickname: 'Unknown', unique_id: '' },
                    play_count: video.play_count || 0,
                    digg_count: video.digg_count || 0,
                    comment_count: video.comment_count || 0,
                    share_count: video.share_count || 0,
                    duration: video.duration || 0,
                    region: video.region || 'Unknown'
                },
                api: 'search'
            };
            
        } catch (error) {
            console.error('Search TikTok error:', error);
            throw new Error(`Failed to find TikTok for "${query}": ${error.message}`);
        }
    },
    
    async sendResult(client, chatId, result, M) {
        if (result.type === 'success') {
            await this.sendTikTokVideo(client, chatId, result.data, M);
        } else {
            throw new Error('Unexpected result type');
        }
    },
    
    async sendTikTokVideo(client, chatId, videoData, M) {
        const caption = this.createVideoCaption(videoData);
        
        // Determine media type
        if (videoData.images && videoData.images.length > 0) {
            // Photo or slideshow
            if (videoData.images.length === 1) {
                await client.sendPhoto(chatId, videoData.images[0], {
                    caption: caption,
                    parse_mode: 'Markdown',
                    reply_to_message_id: M.message_id
                });
            } else {
                await client.sendPhoto(chatId, videoData.images[0], {
                    caption: `${caption}\n📸 *${videoData.images.length} photos*`,
                    parse_mode: 'Markdown',
                    reply_to_message_id: M.message_id
                });
                
                // Send remaining photos
                for (let i = 1; i < Math.min(videoData.images.length, 5); i++) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await client.sendPhoto(chatId, videoData.images[i]);
                }
            }
        } else if (videoData.play) {
            // Video
            console.log(`📹 Sending video: ${videoData.play}`);
            
            await client.sendVideo(chatId, videoData.play, {
                caption: caption,
                parse_mode: 'Markdown',
                supports_streaming: true,
                reply_to_message_id: M.message_id
            });
            
            // Send audio separately if available
            if (videoData.music && videoData.music.play) {
                setTimeout(async () => {
                    try {
                        let audioUrl = videoData.music.play;
                        if (!audioUrl.startsWith('http')) {
                            audioUrl = `https://www.tikwm.com${audioUrl}`;
                        }
                        
                        await client.sendAudio(chatId, audioUrl, {
                            title: videoData.music.title || 'TikTok Audio',
                            performer: videoData.music.author || 'Unknown',
                            caption: '🎵 *Audio from TikTok*',
                            parse_mode: 'Markdown'
                        });
                    } catch (e) {
                        console.log('Could not send audio:', e.message);
                    }
                }, 1000);
            }
        } else {
            throw new Error('No media found in TikTok data');
        }
    },
    
    createVideoCaption(videoData) {
        let caption = `🎬 *TikTok Video*\n\n`;
        
        // Title
        if (videoData.title) {
            caption += `📝 *Title:* ${videoData.title}\n`;
        }
        
        // Creator
        if (videoData.author) {
            caption += `👤 *Creator:* ${videoData.author.nickname || videoData.author.unique_id || 'Unknown'}\n`;
        }
        
        // Stats
        caption += `📊 *Stats:*\n`;
        if (videoData.play_count) caption += `• 👀 ${this.formatNumber(videoData.play_count)} views\n`;
        if (videoData.digg_count) caption += `• ❤️ ${this.formatNumber(videoData.digg_count)} likes\n`;
        if (videoData.comment_count) caption += `• 💬 ${this.formatNumber(videoData.comment_count)} comments\n`;
        if (videoData.share_count) caption += `• 🔄 ${this.formatNumber(videoData.share_count)} shares\n`;
        
        // Duration
        if (videoData.duration) {
            caption += `⏱ *Duration:* ${this.formatDuration(videoData.duration)}\n`;
        }
        
        // Region
        if (videoData.region) {
            caption += `🌍 *Region:* ${videoData.region}\n`;
        }
        
        // Search query info (if it was a search)
        if (videoData.query) {
            caption += `🔍 *Search:* "${videoData.query}"\n`;
        }
        
        caption += `\n✨ *Downloaded without watermark*`;
        
        return caption;
    },
    
    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },
    
    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};