// src/Commands/Media/xdl.js
// X (Twitter) downloader plugin
// Adapted from x.js (ZennzXD)
const axios = require('axios');

const X_BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

async function fetchTweet(url) {
    const idMatch = url.match(/status\/(\d+)/);
    if (!idMatch) throw new Error('Invalid X / Twitter URL');
    const id = idMatch[1];

    const variables = encodeURIComponent(JSON.stringify({
        tweetId: id,
        withCommunity: false,
        includePromotedContent: false,
        withVoice: false
    }));
    const features = encodeURIComponent(JSON.stringify({
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true
    }));
    const fieldToggles = encodeURIComponent(JSON.stringify({
        withArticleRichContentState: true
    }));

    const endpoint = `https://api.x.com/graphql/tmhPpO5sDermwYmq3h034A/TweetResultByRestId?variables=${variables}&features=${features}&fieldToggles=${fieldToggles}`;

    const res = await axios.get(endpoint, {
        headers: {
            authorization: X_BEARER,
            'content-type': 'application/json',
            origin: 'https://x.com'
        },
        timeout: 25000
    });

    const d = res.data;
    const t = d?.data?.tweetResult?.result;
    if (!t) throw new Error('Tweet not found or private');
    const u = t?.core?.user_results?.result;
    const l = t?.legacy;

    const media = (l?.extended_entities?.media || []).map(m => {
        if (m.type === 'photo') {
            return { kind: 'image', type: 'image/jpeg', url: m.media_url_https };
        }
        if (m.type === 'video' || m.type === 'animated_gif') {
            const v = (m.video_info?.variants || [])
                .filter(x => x.content_type === 'video/mp4')
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
            return {
                kind: 'video',
                type: v?.content_type || 'video/mp4',
                url: v?.url || null,
                thumbnail: m.media_url_https
            };
        }
        return null;
    }).filter(Boolean);

    return {
        id: t?.rest_id,
        title: l?.full_text || '',
        author: {
            name: u?.core?.name,
            username: u?.core?.screen_name
        },
        media,
        stats: {
            likes: l?.favorite_count,
            retweets: l?.retweet_count,
            views: Number(t?.views?.count || 0)
        }
    };
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
            'user-agent': 'Mozilla/5.0',
            referer: 'https://x.com/'
        }
    });
    return Buffer.from(res.data);
}

module.exports = {
    name: 'xdl',
    aliases: ['x', 'twitter', 'twdl', 'twitterdl'],
    category: 'media',
    exp: 5,
    cool: 10,
    react: '🐦',
    description: 'Download videos / images from X (Twitter)',
    usage: '.xdl <x_or_twitter_url>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const urlMatch = (arg || '').match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0].trim() : '';

        if (!url || !/(x\.com|twitter\.com)\/.+\/status\/\d+/i.test(url)) {
            return client.sendMessage(chatId,
                '🐦 *X / Twitter Downloader*\n\nUsage: `.xdl <x_or_twitter_url>`',
                { parse_mode: 'Markdown' }
            );
        }

        let status;
        try { status = await client.sendMessage(chatId, '📥 Fetching tweet...'); } catch (_) {}

        try {
            const tweet = await fetchTweet(url);

            if (!tweet.media.length) {
                if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
                return client.sendMessage(chatId,
                    `📝 *Tweet by @${tweet.author.username || 'unknown'}*\n\n${tweet.title.slice(0, 1000)}`,
                    { parse_mode: undefined }
                );
            }

            const caption = `🐦 *@${tweet.author.username}*: ${tweet.title.slice(0, 900)}`;

            for (const m of tweet.media) {
                const buf = await downloadBuffer(m.url);
                if (m.kind === 'video') {
                    await client.sendVideo(chatId, buf, { caption: caption.slice(0, 1024), parse_mode: 'Markdown' });
                } else {
                    await client.sendPhoto(chatId, buf, { caption: caption.slice(0, 1024), parse_mode: 'Markdown' });
                }
            }

            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
        } catch (err) {
            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
            console.error('XDL error:', err.message);
            await client.sendMessage(chatId,
                `❌ Failed to download from X: ${err.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
};
