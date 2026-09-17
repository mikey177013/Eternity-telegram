const axios = require('axios');

module.exports = {
    name: 'ai',
    aliases: ['pai'],
    category: 'ai',
    description: 'Chat with AI (GPT-5/Copilot)',
    usage: '.ai <message>',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            
            // Check if user provided message
            if (!arg.trim()) {
                return client.sendMessage(chatId,
                    '🤖 *AI Chat*\n\n' +
                    'Chat with AI (GPT-5/Copilot)\n\n' +
                    'Usage: `.ai <message>`\n' +
                    'Example: `.ai hello, who are you?`\n' +
                    'Example: `.ai explain quantum physics`',
                    { parse_mode: 'Markdown' }
                );
            }
            
            const question = arg.trim();
            
            // Try multiple API endpoints
            const apiEndpoints = [
                {
                    url: `https://apis.prexzyvilla.site/ai/grok?text=${encodeURIComponent(question)}`,
                    extract: (data) => data.status && data.reply ? data.reply : null
                },
                {
                    url: `https://apis.prexzyvilla.site/ai/gpt-5?text=${encodeURIComponent(question)}`,
                    extract: (data) => data.status && data.text ? data.text : null
                },
                {
                    url: `https://api.mifinfinity.my.id/api/ai/Copilot-gpt5?q=${encodeURIComponent(question)}`,
                    extract: (data) => data.status && data.response && data.response.text ? data.response.text : null
                },
                {
                    url: `https://api.mifinfinity.my.id/api/ai/Copilot-Default?q=${encodeURIComponent(question)}`,
                    extract: (data) => data.status && data.response && data.response.text ? data.response.text : null
                }
            ];
            
            let aiResponse = null;
            let lastError = null;
            
            // Try each API endpoint until one works
            for (const endpoint of apiEndpoints) {
                try {
                    console.log(`Trying API: ${endpoint.url.split('?')[0]}`);
                    
                    const response = await axios.get(endpoint.url, {
                        timeout: 20000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (response.status === 200) {
                        aiResponse = endpoint.extract(response.data);
                        
                        if (aiResponse) {
                            console.log(`Success from: ${endpoint.url.split('?')[0]}`);
                            break;
                        }
                    }
                } catch (error) {
                    console.error(`API failed: ${endpoint.url.split('?')[0]} - ${error.message}`);
                    lastError = error;
                    continue; // Try next endpoint
                }
            }
            
            if (aiResponse) {
                // Clean the response - remove any markdown, attribution, etc.
                let cleanResponse = aiResponse
                    .replace(/@MifNity/g, '')
                    .replace(/@\w+/g, '')
                    .replace(/\[\d+\]/g, '')
                    .replace(/Note:.*/g, '')
                    .replace(/Attribution:.*/g, '')
                    .replace(/Creator:.*/g, '')
                    .trim();
                
                // Send just the answer in bold
                await client.sendMessage(chatId,
                    `*${cleanResponse}*`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await client.sendMessage(chatId,
                    '❌ *Failed to get AI response*\n' +
                    'All AI services might be down.\n' +
                    'Please try again later.',
                    { parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            console.error('AI command error:', error);
            await client.sendMessage(M.chat.id,
                '❌ An error occurred. Please try again.',
                { parse_mode: 'Markdown' }
            );
        }
    }
};