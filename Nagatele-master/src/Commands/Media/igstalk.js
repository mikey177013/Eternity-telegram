const axios = require('axios');

module.exports = {
    name: 'igstalk',
    aliases: ['iguser', 'instastalk'],
    category: 'media',
    description: 'Fetches Instagram profile info for a given username',
    usage: '.igstalk <username> or .iguser <username>',
    
    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const userId = M.from.id;
            
            // Validate input
            if (!arg || !arg.trim()) {
                return client.sendMessage(chatId,
                    '❌ *Please provide an Instagram username*\n\n' +
                    'Example: `.igstalk whynotdipu`\n' +
                    'Or: `.iguser instagram`',
                    { parse_mode: 'Markdown' }
                );
            }

            const username = arg.trim();

            // Send processing message
            const processingMsg = await client.sendMessage(chatId,
                '🔍 *Fetching Instagram profile...*\n' +
                'Please wait while I get the profile information...',
                { parse_mode: 'Markdown' }
            );

            try {
                // API call
                const res = await axios.get(`https://igstalk-21yg.onrender.com/api/ig?user=${encodeURIComponent(username)}`, {
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                const data = res.data;

                if (!data.success) {
                    // Delete processing message
                    try {
                        await client.deleteMessage(chatId, processingMsg.message_id);
                    } catch (e) {}
                    
                    return client.sendMessage(chatId,
                        `❌ Failed to fetch profile for *${username}*\n\n` +
                        'Please check:\n' +
                        '• Username is correct\n' +
                        '• Account is public\n' +
                        '• Try again later',
                        { parse_mode: 'Markdown' }
                    );
                }

                // Format followers, following, posts numbers
                const formatNumber = (num) => {
                    if (!num && num !== 0) return 'N/A';
                    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
                    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
                    return num.toString();
                };

                // Profile info text
                const profileText = 
                    `📸 *Instagram Profile Info*\n\n` +
                    `👤 *Name:* ${data.name || 'N/A'}\n` +
                    `🔖 *Username:* @${data.username || 'N/A'}\n` +
                    `📜 *Bio:* ${data.bio ? (data.bio.length > 200 ? data.bio.substring(0, 200) + '...' : data.bio) : 'No bio'}\n` +
                    `👥 *Followers:* ${formatNumber(data.followers)}\n` +
                    `➡️ *Following:* ${formatNumber(data.following)}\n` +
                    `📷 *Posts:* ${formatNumber(data.posts)}\n` +
                    `✔️ *Verified:* ${data.verified ? '✅ Yes' : '❌ No'}\n\n` +
                    `_Profile fetched by ZeroTwo_`;

                // Delete processing message
                try {
                    await client.deleteMessage(chatId, processingMsg.message_id);
                } catch (e) {}

                // Check if profile picture exists
                if (data.profile_pic) {
                    try {
                        // Send profile picture with caption
                        await client.sendPhoto(chatId, data.profile_pic, {
                            caption: profileText,
                            parse_mode: 'Markdown'
                        });
                    } catch (photoError) {
                        console.log('Photo send error, sending text only:', photoError.message);
                        // Send text only if photo fails
                        await client.sendMessage(chatId, profileText, {
                            parse_mode: 'Markdown'
                        });
                    }
                } else {
                    // Send text only if no profile picture
                    await client.sendMessage(chatId, profileText, {
                        parse_mode: 'Markdown'
                    });
                }

            } catch (apiError) {
                console.error('IG Stalk API Error:', apiError.message);
                
                // Delete processing message
                try {
                    await client.deleteMessage(chatId, processingMsg.message_id);
                } catch (e) {}
                
                return client.sendMessage(chatId,
                    '❌ *Failed to fetch Instagram profile*\n\n' +
                    'Possible reasons:\n' +
                    '• Instagram API is down\n' +
                    '• Username not found\n' +
                    '• Rate limited\n' +
                    '• Try again in a few minutes',
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (error) {
            console.error('IG Stalk Command Error:', error);
            await client.sendMessage(M.chat.id,
                '❌ An unexpected error occurred. Please try again later.',
                { parse_mode: 'Markdown' }
            );
        }
    },

    // Helper function for help command
    async help(client, chatId) {
        await client.sendMessage(chatId,
            '📱 *Instagram Profile Stalker*\n\n' +
            '*Commands:*\n' +
            '• `.igstalk <username>` - Get Instagram profile info\n' +
            '• `.iguser <username>` - Alternative command\n' +
            '• `.instastalk <username>` - Another alternative\n\n' +
            '*Examples:*\n' +
            '`.igstalk whynotdipu`\n' +
            '`.iguser instagram`\n' +
            '`.instastalk cristiano`\n\n' +
            '*Features:*\n' +
            '✅ Profile picture\n' +
            '✅ Name & bio\n' +
            '✅ Followers/Following count\n' +
            '✅ Post count\n' +
            '✅ Verification status\n\n' +
            '*Note:*\n' +
            '• Works with public accounts only\n' +
            '• Private accounts cannot be stalked\n' +
            '• Limited by Instagram API restrictions',
            { parse_mode: 'Markdown' }
        );
    }
};