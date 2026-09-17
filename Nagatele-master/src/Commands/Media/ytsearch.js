const axios = require('axios');

module.exports = {
    name: 'yts',
    aliases: ['youtubesearch', 'ytsearch'],
    category: 'media',
    usage: '.yts <search query>',
    description: 'Search YouTube videos',
    exp: 3,
    cool: 5,
    react: '🔍',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const query = arg.trim();

        if (!query) {
            return client.sendMessage(chatId, 
                "❌ *Please provide a search query!*\n\n" +
                "*Example:* `.yts despacito`\n" +
                "*Example:* `.yts shape of you ed sheeran`",
                { parse_mode: 'Markdown' }
            );
        }

        try {
            // Send searching message
            await client.sendMessage(chatId, `🔍 *Searching for "${query}"...*`, { parse_mode: 'Markdown' });

            // Call API
            const apiUrl = `https://apis.prexzyvilla.site/search/youtube?q=${encodeURIComponent(query)}`;
            const response = await axios.get(apiUrl, { timeout: 10000 });

            if (!response.data?.status || !response.data?.data || response.data.data.length === 0) {
                return client.sendMessage(chatId, 
                    "❌ *No results found!*\n\n" +
                    "Try a different search term.",
                    { parse_mode: 'Markdown' }
                );
            }

            const results = response.data.data;
            const topResults = results.slice(0, 5); // Get first 5 results

            // Build results message
            let message = `*YouTube Search Results for "${query}"*\n\n`;
            
            topResults.forEach((result, index) => {
                const title = result.title || 'No Title';
                const link = result.link || 'No Link';
                const duration = result.duration ? ` (${result.duration})` : '';
                
                message += `*${index + 1}. ${title}${duration}*\n`;
                message += `${link}\n\n`;
            });

            message += `_Showing ${topResults.length} of ${results.length} results_`;

            // Send results
            await client.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
            });

        } catch (error) {
            console.error('YTS error:', error.message);
            
            let errorMsg = "❌ *Error searching YouTube!*";
            if (error.code === 'ECONNABORTED') {
                errorMsg += "\nRequest timeout. Try again.";
            } else if (error.response?.status === 404) {
                errorMsg += "\nSearch service unavailable.";
            }
            
            await client.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
        }
    }
};