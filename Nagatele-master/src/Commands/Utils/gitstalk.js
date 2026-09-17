// src/Commands/Tools/Github.js
const axios = require('axios');

module.exports = {
    name: 'github',
    aliases: ['ghstalk', 'githubstalk', 'stalkgithub', 'gitstalk'],
    category: 'Utils',
    usage: '.github <username>',
    description: 'Stalk a GitHub user profile',

    async execute(client, arg, M) {
        const chatId = M.chat.id;

        // Normalize args
        const username = Array.isArray(arg) ? arg[0] : arg;
        if (!username) {
            return client.sendMessage(chatId, '❌ Example: `.github torvalds`', {
                parse_mode: 'Markdown'
            });
        }

        try {
            // Call GitHub API
            const { data } = await axios.get(
                `https://api.github.com/users/${username}`,
                {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Telegram-Bot'
                    }
                }
            );

            // Build caption
            const caption =
                `👤 *GitHub Profile*\n\n` +
                `• *Username:* ${data.login || '-'}\n` +
                `• *Name:* ${data.name || '-'}\n` +
                `• *Bio:* ${data.bio || '-'}\n` +
                `• *Profile:* ${data.html_url}\n` +
                `• *Type:* ${data.type}\n` +
                `• *Admin:* ${data.site_admin}\n` +
                `• *Company:* ${data.company || '-'}\n` +
                `• *Blog:* ${data.blog || '-'}\n` +
                `• *Location:* ${data.location || '-'}\n` +
                `• *Email:* ${data.email || '-'}\n\n` +
                `📊 *Stats*\n` +
                `• *Public Repos:* ${data.public_repos}\n` +
                `• *Public Gists:* ${data.public_gists}\n` +
                `• *Followers:* ${data.followers}\n` +
                `• *Following:* ${data.following}\n\n` +
                `⏱️ *Created:* ${data.created_at}\n` +
                `♻️ *Updated:* ${data.updated_at}`;

            // Send profile photo + info
            await client.sendPhoto(
                chatId,
                data.avatar_url,
                {
                    caption,
                    parse_mode: 'Markdown'
                }
            );

        } catch (err) {
            if (err.response?.status === 404) {
                return client.sendMessage(chatId, '❌ GitHub user not found');
            }

            console.error('GitHub Command Error:', err);
            await client.sendMessage(
                chatId,
                '❌ Failed to fetch GitHub profile (API limit or error)'
            );
        }
    }
};