const axios = require('axios');

module.exports = {
    name: 'spotify',
    aliases: ['spoti', 'spotifydl'],
    category: 'media',
    usage: '.spotify <song name or Spotify URL> or .spotify --s <song name> for search list',
    description: 'Download songs from Spotify with search option',
    exp: 5,
    cool: 10,
    react: '🎵',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const query = arg || '';

        if (!query.trim()) {
            return client.sendMessage(chatId, 
                "❌ *Please provide a song name or Spotify URL!*\n\n" +
                "*Example:* `.spotify despacito`\n" +
                "*Example:* `.spotify https://open.spotify.com/track/...`\n" +
                "*Search List:* `.spotify --s ransom`",
                { parse_mode: 'Markdown' }
            );
        }

        // Check if it's a search list request
        if (query.startsWith('--s ') || query.startsWith('-s ')) {
            const searchQuery = query.replace(/^(--s\s+|-s\s+)/, '').trim();
            
            if (!searchQuery) {
                return client.sendMessage(chatId, 
                    "❌ *Please provide a song name to search!*\n\n" +
                    "*Example:* `.spotify --s ransom`",
                    { parse_mode: 'Markdown' }
                );
            }
            
            await this.showSearchList(client, chatId, searchQuery);
            return;
        }

        try {
            // Send initial processing message
            let statusMsg = await client.sendMessage(chatId, "⏳ *Processing your request...*", { parse_mode: 'Markdown' });
            
            let spotifyUrl = null;
            let searchResults = null;
            
            // Check if it's already a Spotify URL
            if (query.includes('open.spotify.com/track/')) {
                spotifyUrl = query;
            } else {
                // ============================
                // PARALLEL SEARCH - Try multiple search APIs at once
                // ============================
                console.log('🔍 Fast searching for:', query);
                
                // Create search promises
                const searchPromises = [
                    // API 1: prexzyvilla
                    axios.get(`https://apis.prexzyvilla.site/search/spotify?query=${encodeURIComponent(query)}`, { timeout: 5000 }).catch(e => null),
                    // API 2: apocalypse
                    axios.get(`https://api.apocalypse.web.id/search/spotify?q=${encodeURIComponent(query)}`, { timeout: 5000 }).catch(e => null)
                ];

                // Execute all searches in parallel
                const searchResponses = await Promise.allSettled(searchPromises);
                
                // Process results
                for (const response of searchResponses) {
                    if (response.status === 'fulfilled' && response.value?.data) {
                        const data = response.value.data;
                        
                        if (data.status && data.songs?.length > 0) {
                            // Handle prexzyvilla format
                            searchResults = {
                                results: data.songs.map(song => ({
                                    title: song.title,
                                    artist: song.artist,
                                    duration: song.duration,
                                    url: song.url,
                                    thumbnail: song.thumbnail
                                }))
                            };
                            break;
                        } else if (data.status && data.result?.length > 0) {
                            // Handle apocalypse format
                            searchResults = {
                                results: data.result.map(song => ({
                                    title: song.title,
                                    artist: song.artist,
                                    duration: song.duration,
                                    url: song.spotify_url,
                                    thumbnail: song.thumbnail
                                }))
                            };
                            break;
                        }
                    }
                }
                
                if (!searchResults) {
                    await client.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
                    return client.sendMessage(chatId, 
                        "❌ *No results found!*\n\n" +
                        "Try:\n" +
                        "• A different song name\n" +
                        "• Check spelling\n" +
                        "• Use `.spotify --s <song>` to see all available songs",
                        { parse_mode: 'Markdown' }
                    );
                }
                
                // Get the first result
                const firstResult = searchResults.results[0];
                spotifyUrl = firstResult.url;
            }
            
            // ============================
            // PARALLEL DOWNLOAD - Try multiple download APIs at once
            // ============================
            console.log('⬇️ Fast downloading from:', spotifyUrl);
            
            let downloadUrl = null;
            let metadata = null;
            
            // Create download promises (all in parallel)
            const downloadPromises = [
                // API 1: prexzyvilla download
                axios.get(`https://apis.prexzyvilla.site/download/spotify?url=${encodeURIComponent(spotifyUrl)}`, { timeout: 8000 }).catch(e => null),
                
                // API 2: apocalypse download (spotify specific)
                axios.get(`https://api.apocalypse.web.id/download/spotify?url=${encodeURIComponent(spotifyUrl)}`, { timeout: 8000 }).catch(e => null),
                
                // API 3: apocalypse play (search and download)
                searchResults ? axios.get(`https://api.apocalypse.web.id/download/play?q=${encodeURIComponent(searchResults.results[0].title)}&bitrate=128`, { timeout: 8000 }).catch(e => null) : Promise.resolve(null),
                
                // API 4: mifinfinity (backup)
                axios.get(`https://api.mifinfinity.my.id/api/downloader/play-spotify?q=${encodeURIComponent(query)}`, { timeout: 8000 }).catch(e => null),
                
                // API 5: deline (backup)
                axios.get(`https://api.deline.web.id/downloader/spotifyplay?q=${encodeURIComponent(query)}`, { timeout: 8000 }).catch(e => null)
            ];

            // Execute all downloads in parallel
            const downloadResponses = await Promise.allSettled(downloadPromises);
            
            // Process the first successful response
            for (let i = 0; i < downloadResponses.length; i++) {
                const response = downloadResponses[i];
                if (response.status === 'fulfilled' && response.value?.data) {
                    const data = response.value.data;
                    
                    if (i === 0 && data.status && data.data) { // prexzyvilla
                        const audioData = data.data.media?.find(item => item.type === 'audio' && item.format === 'mp3');
                        if (audioData) {
                            downloadUrl = audioData.url;
                            metadata = {
                                title: data.data.title || searchResults?.results[0]?.title || 'Unknown',
                                artist: data.data.artist || searchResults?.results[0]?.artist || 'Unknown',
                                duration: data.data.duration || searchResults?.results[0]?.duration || 'Unknown',
                                cover: data.data.thumbnail || searchResults?.results[0]?.thumbnail,
                                url: spotifyUrl
                            };
                            console.log('✅ Got from API 1');
                            break;
                        }
                    } else if (i === 1 && data.status && data.result) { // apocalypse spotify
                        const audioData = data.result.medias?.find(item => item.type === 'audio');
                        if (audioData) {
                            downloadUrl = audioData.url;
                            metadata = {
                                title: data.result.title || searchResults?.results[0]?.title || 'Unknown',
                                artist: data.result.author || searchResults?.results[0]?.artist || 'Unknown',
                                duration: data.result.duration || searchResults?.results[0]?.duration || 'Unknown',
                                cover: data.result.thumbnail || searchResults?.results[0]?.thumbnail,
                                url: spotifyUrl
                            };
                            console.log('✅ Got from API 2');
                            break;
                        }
                    } else if (i === 2 && data.status && data.result) { // apocalypse play
                        downloadUrl = data.result.download_url;
                        metadata = {
                            title: searchResults.results[0].title,
                            artist: searchResults.results[0].artist,
                            duration: searchResults.results[0].duration,
                            cover: searchResults.results[0].thumbnail,
                            url: spotifyUrl
                        };
                        console.log('✅ Got from API 3');
                        break;
                    } else if (i === 3 && data.status && data.result) { // mifinfinity
                        downloadUrl = data.result.dlink;
                        metadata = data.result.metadata || {
                            title: searchResults?.results[0]?.title || 'Unknown',
                            artist: searchResults?.results[0]?.artist || 'Unknown',
                            duration: searchResults?.results[0]?.duration || 'Unknown',
                            cover: searchResults?.results[0]?.thumbnail,
                            url: spotifyUrl
                        };
                        console.log('✅ Got from API 4');
                        break;
                    } else if (i === 4 && data.status && data.result) { // deline
                        downloadUrl = data.result.dlink;
                        metadata = data.result.metadata || {
                            title: searchResults?.results[0]?.title || 'Unknown',
                            artist: searchResults?.results[0]?.artist || 'Unknown',
                            duration: searchResults?.results[0]?.duration || 'Unknown',
                            cover: searchResults?.results[0]?.thumbnail,
                            url: spotifyUrl
                        };
                        console.log('✅ Got from API 5');
                        break;
                    }
                }
            }

            // Check if we got a download URL
            if (!downloadUrl || !metadata) {
                await client.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
                return client.sendMessage(chatId, 
                    "❌ *Download failed!*\n\n" +
                    "All download sources are currently unavailable.\n" +
                    "Please try again later or use `.spotify --s <song>` to see available songs.",
                    { parse_mode: 'Markdown' }
                );
            }

            // Delete status message
            await client.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

            // Create caption (EXACT FORMAT AS REQUESTED)
            const caption = `🎵 *${metadata.title}*\n\n` +
                           `👨‍🎤 *Artist:* ${metadata.artist || 'Unknown'}\n` +
                           `⏱️ *Duration:* ${metadata.duration || 'Unknown'}\n` +
                           `🔗 *Spotify:* ${metadata.url ? metadata.url.substring(0, 30) + '...' : 'Not available'}`;

            try {
                // Send thumbnail with caption FIRST (before audio)
                let sentMessage = null;
                if (metadata.cover) {
                    try {
                        sentMessage = await client.sendPhoto(chatId, metadata.cover, {
                            caption: caption,
                            parse_mode: 'Markdown'
                        });
                    } catch (photoError) {
                        // If photo fails, send text only
                        sentMessage = await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
                    }
                } else {
                    sentMessage = await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
                }

                // Now download and send audio in background
                setTimeout(async () => {
                    try {
                        // Download audio with timeout
                        const audioResponse = await axios({
                            method: 'GET',
                            url: downloadUrl,
                            responseType: 'arraybuffer',
                            timeout: 15000, // 15 seconds timeout
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124 Safari/537.36'
                            }
                        });

                        const audioBuffer = Buffer.from(audioResponse.data);
                        
                        // Check if audio is valid (at least 10KB)
                        if (audioBuffer.length < 10240) {
                            throw new Error('Audio file too small');
                        }

                        // Send the audio file
                        const filename = cleanFilename(`${metadata.title} - ${metadata.artist || 'Unknown'}.mp3`);
                        await client.sendDocument(chatId, audioBuffer, {
                            filename: filename,
                            parse_mode: 'Markdown'
                        });

                        console.log(`✅ Successfully sent: ${metadata.title}`);

                    } catch (downloadError) {
                        console.error('Audio download error:', downloadError.message);
                        
                        // Send error message
                        await client.sendMessage(chatId, 
                            "❌ *Failed to download audio!*\n\n" +
                            "The download link expired or was blocked.\n" +
                            "Try searching again.",
                            { parse_mode: 'Markdown' }
                        );
                    }
                }, 100); // Small delay to ensure thumbnail is sent first

            } catch (error) {
                console.error('Error sending thumbnail:', error);
                await client.sendMessage(chatId, 
                    "❌ *Failed to process song!*\n\n" +
                    "Please try again later.",
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (error) {
            console.error('Spotify command error:', error);
            
            await client.sendMessage(chatId, 
                "❌ *An error occurred!*\n\n" +
                "Error: " + (error.message || 'Unknown error') + "\n\n" +
                "Please try again later.",
                { parse_mode: 'Markdown' }
            );
        }
    },
    
    // New method to show search list
    async showSearchList(client, chatId, searchQuery) {
        try {
            // Send initial message
            const searchMsg = await client.sendMessage(chatId, `🔍 *Searching for "${searchQuery}"...*`, { parse_mode: 'Markdown' });
            
            let searchResults = null;
            
            // Try search APIs in parallel
            const searchPromises = [
                axios.get(`https://apis.prexzyvilla.site/search/spotify?query=${encodeURIComponent(searchQuery)}`, { timeout: 8000 }).catch(e => null),
                axios.get(`https://api.apocalypse.web.id/search/spotify?q=${encodeURIComponent(searchQuery)}`, { timeout: 8000 }).catch(e => null)
            ];
            
            const searchResponses = await Promise.allSettled(searchPromises);
            
            // Process results
            for (const response of searchResponses) {
                if (response.status === 'fulfilled' && response.value?.data) {
                    const data = response.value.data;
                    
                    if (data.status && data.songs?.length > 0) {
                        // Handle prexzyvilla format
                        searchResults = data.songs.slice(0, 10); // Max 10 results
                        break;
                    } else if (data.status && data.result?.length > 0) {
                        // Handle apocalypse format
                        searchResults = data.result.slice(0, 10); // Max 10 results
                        break;
                    }
                }
            }
            
            if (!searchResults || searchResults.length === 0) {
                await client.deleteMessage(chatId, searchMsg.message_id).catch(() => {});
                return client.sendMessage(chatId, 
                    `❌ *No results found for "${searchQuery}"!*\n\n` +
                    "Try a different search term.",
                    { parse_mode: 'Markdown' }
                );
            }
            
            // Delete searching message
            await client.deleteMessage(chatId, searchMsg.message_id).catch(() => {});
            
            // Format the search results
            let resultText = `🎵 *Search Results for "${searchQuery}"*\n\n`;
            
            searchResults.forEach((song, index) => {
                const title = song.title || song.title;
                const artist = song.artist || song.artist || 'Unknown Artist';
                const url = song.url || song.spotify_url || '#';
                const duration = song.duration || 'Unknown';
                
                resultText += `${index + 1}. *${title}*\n`;
                resultText += `   👤 *Artist:* ${artist}\n`;
                resultText += `   ⏱️ *Duration:* ${duration}\n`;
                resultText += `   🔗 *Link:* ${url}\n\n`;
            });
            
            resultText += `\n📝 *Usage:* To download any song, use:\n`;
            resultText += `\`.spotify <song name>\` or \`.spotify <spotify_url>\``;
            
            await client.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('Search list error:', error);
            await client.sendMessage(chatId, 
                "❌ *Failed to search songs!*\n\n" +
                "Please try again later.",
                { parse_mode: 'Markdown' }
            );
        }
    }
};

// Helper function to clean filename
function cleanFilename(str) {
    if (!str) return 'spotify_song.mp3';
    
    return str
        .substring(0, 60) // Limit length
        .replace(/[\\/:*?"<>|]/g, '') // Remove invalid characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/__+/g, '_') // Remove multiple underscores
        .replace(/_+\.mp3$/, '.mp3') // Clean ending
        + '.mp3';
}