module.exports = {
    name: 'profile',
    aliases: ['p'],
    category: 'core',
    exp: 10,
    cool: 4,
    react: '🎈',
    usage: '.profile or reply .profile',
    description: 'Show user details',

    async execute(client, arg, M) {
        try {
            // Get target user
            let user = M.from;
            if (M.reply_to_message && M.reply_to_message.from) {
                user = M.reply_to_message.from;
            }

            // ==================== SAFE TEXT ESCAPING ====================
            const escapeTelegramText = (text) => {
                if (!text || typeof text !== 'string') return 'N/A';
                
                // Escape Markdown special characters
                return text
                    .replace(/\_/g, '\\_')
                    .replace(/\*/g, '\\*')
                    .replace(/\[/g, '\\[')
                    .replace(/\]/g, '\\]')
                    .replace(/\(/g, '\\(')
                    .replace(/\)/g, '\\)')
                    .replace(/\~/g, '\\~')
                    .replace(/\`/g, '\\`')
                    .replace(/\>/g, '\\>')
                    .replace(/\#/g, '\\#')
                    .replace(/\+/g, '\\+')
                    .replace(/\-/g, '\\-')
                    .replace(/\=/g, '\\=')
                    .replace(/\|/g, '\\|')
                    .replace(/\{/g, '\\{')
                    .replace(/\}/g, '\\}')
                    .replace(/\./g, '\\.')
                    .replace(/\!/g, '\\!');
            };

            // ==================== GET USER DETAILS ====================
            const name = escapeTelegramText(user.first_name || '');
            const lastName = escapeTelegramText(user.last_name || '');
            const fullName = lastName ? `${name} ${lastName}` : name;
            const username = user.username ? `@${escapeTelegramText(user.username)}` : 'Not set';
            const id = user.id;
            const language = user.language_code || 'Not set';
            const isPremium = user.is_premium ? 'Yes ✅' : 'No';
            const isBot = user.is_bot ? 'Yes 🤖' : 'No 👤';

            // Get bio - escape it for safety
            let bioText = 'No bio';
            if (user.bio && typeof user.bio === 'string' && user.bio.trim().length > 0) {
                bioText = escapeTelegramText(user.bio);
                // Truncate long bios
                if (bioText.length > 200) {
                    bioText = bioText.substring(0, 197) + '...';
                }
            }

            // ==================== GET PROFILE PHOTO ====================
            let photoFileId = null;
            
            try {
                const photos = await client.getUserProfilePhotos(Number(id), { 
                    offset: 0, 
                    limit: 1 
                });
                
                if (photos && photos.total_count > 0 && photos.photos && photos.photos[0]) {
                    // Get the largest available photo
                    const photo = photos.photos[0];
                    const largestPhoto = photo[photo.length - 1];
                    photoFileId = largestPhoto.file_id;
                }
            } catch (photoErr) {
                console.log('Could not fetch profile photo:', photoErr.message);
                // Continue without photo
            }

            // ==================== CREATE PROFILE MESSAGE ====================
            const profileText = 
`<b>👤 USER PROFILE</b>

<b>Name:</b> ${fullName || 'N/A'}
<b>Username:</b> ${username}
<b>ID:</b> <code>${id}</code>
<b>Bio:</b> ${bioText}
<b>Language:</b> ${language}
<b>Premium:</b> ${isPremium}
<b>Bot:</b> ${isBot}`;

            // ==================== SEND MESSAGE ====================
            try {
                if (photoFileId) {
                    await client.sendPhoto(M.chat.id, photoFileId, {
                        caption: profileText,
                        parse_mode: 'HTML',
                        disable_web_page_preview: true
                    });
                } else {
                    await client.sendMessage(M.chat.id, profileText, { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: true
                    });
                }
            } catch (sendError) {
                console.error('Send error:', sendError.message);
                
                // Fallback: Try with plain text
                const plainText = 
`👤 USER PROFILE

Name: ${fullName || 'N/A'}
Username: ${username}
ID: ${id}
Bio: ${bioText}
Language: ${language}
Premium: ${isPremium}
Bot: ${isBot}`;
                
                if (photoFileId) {
                    await client.sendPhoto(M.chat.id, photoFileId, {
                        caption: plainText
                    });
                } else {
                    await client.sendMessage(M.chat.id, plainText);
                }
            }

        } catch (err) {
            console.error('Profile command error:', err);
            
            // Try to send error message
            try {
                await client.sendMessage(M.chat.id, 
                    "❌ Could not display profile. Try using `.id` instead.", 
                    { parse_mode: 'Markdown' }
                );
            } catch (finalError) {
                console.error('Even error message failed:', finalError);
            }
        }
    }
};