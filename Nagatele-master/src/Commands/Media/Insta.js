// src/Commands/Media/Insta.js
// Instagram downloader plugin (posts, reels, stories, IGTV)
// Adapted from instagram2.js (ZennzXD)
const axios = require('axios');
const qs = require('qs');

const IG_HEADERS = {
    'X-IG-App-ID': '936619743392459',
    'User-Agent': 'Instagram 275.0.0.27.98 Android'
};

const DL_HEADERS = {
    'user-agent': 'curl/8.5.0',
    'accept': '*/*',
    'accept-encoding': 'identity',
    'range': 'bytes=0-',
    'referer': 'https://www.instagram.com/',
    'origin': 'https://www.instagram.com/'
};

/**
 * Resolve an Instagram URL into { type, media, caption, author }
 */
async function instagram(url) {
    if (url.includes('/stories/')) {
        try {
            const parts = new URL(url).pathname.split('/').filter(Boolean);
            const user = parts[1];
            const id = parts[2];
            const htmlRes = await axios.get(url, { timeout: 20000 });
            const html = htmlRes.data;
            const match = html.match(/"user":(\{.*?\})/);
            if (!match) throw new Error('Story metadata not found');
            const usr = JSON.parse(match[1]);

            const query = qs.stringify({
                supported_capabilities_new: JSON.stringify([{
                    name: 'SUPPORTED_SDK_VERSIONS',
                    value: '100.0,101.0,102.0'
                }])
            });

            const { data } = await axios.get(
                `https://i.instagram.com/api/v1/feed/user/${usr.id}/story/?${query}`,
                { headers: IG_HEADERS, timeout: 20000 }
            );

            const item = data.reel.items.find(v => v.id.split('_')[0] === id);
            if (!item) throw new Error('Story not found');

            const media = item.video_versions
                ? item.video_versions[0].url
                : item.image_versions2.candidates[0].url;

            return {
                type: 'story',
                author: { username: usr.username, id: usr.id },
                caption: '',
                media
            };
        } catch (e) {
            throw new Error('Story is private or unavailable');
        }
    }

    const codeMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/);
    if (!codeMatch) throw new Error('Invalid Instagram URL');
    const code = codeMatch[1];

    const q = qs.stringify({
        doc_id: '8845758582119845',
        variables: JSON.stringify({ shortcode: code })
    });

    const res = await axios.get(
        `https://www.instagram.com/graphql/query/?${q}`,
        { headers: IG_HEADERS, timeout: 20000 }
    );
    const j = res.data;
    const m = j?.data?.xdt_shortcode_media;
    if (!m) throw new Error('Content is private or unavailable');

    const side = m.edge_sidecar_to_children?.edges || [];
    const media = side.length
        ? side.map(x => x.node.video_url || x.node.display_url)
        : (m.video_url || m.display_url);

    return {
        type: side.length ? 'slide' : (m.is_video ? 'video' : 'photo'),
        author: {
            username: m.owner.username,
            name: m.owner.full_name
        },
        caption: m.edge_media_to_caption?.edges?.[0]?.node?.text || '',
        stats: {
            likes: m.edge_media_preview_like?.count,
            comments: m.edge_media_preview_comment?.count,
            views: m.video_view_count || m.video_play_count || null
        },
        media
    };
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        headers: DL_HEADERS,
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });
    return Buffer.from(res.data);
}

function isInstagramUrl(s) {
    return /(?:instagram\.com|instagr\.am)/i.test(s);
}

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'insta', 'instadl', 'igdl'],
    category: 'media',
    exp: 5,
    cool: 10,
    react: '📥',
    description: 'Download Instagram posts, reels, stories and IGTV',
    usage: '.ig <instagram_url>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const urlMatch = (arg || '').match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0].trim() : '';

        if (!url || !isInstagramUrl(url)) {
            return client.sendMessage(chatId,
                '📱 *Instagram Downloader*\n\n' +
                'Send me a valid Instagram link.\n\n' +
                'Usage: `.ig <instagram_url>`',
                { parse_mode: 'Markdown' }
            );
        }

        let status;
        try {
            status = await client.sendMessage(chatId, '📥 Downloading Instagram media...');
        } catch (_) {}

        try {
            const data = await instagram(url);
            const caption = data.caption ? data.caption.slice(0, 900) : '';

            const cleanup = async () => {
                if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
            };

            const sendOne = async (mediaUrl, type) => {
                const buf = await downloadBuffer(mediaUrl);
                if (type === 'video') {
                    return client.sendVideo(chatId, buf, { caption });
                }
                return client.sendPhoto(chatId, buf, { caption });
            };

            if (data.type === 'photo') {
                await sendOne(data.media, 'photo');
            } else if (data.type === 'video') {
                await sendOne(data.media, 'video');
            } else if (data.type === 'story') {
                // Try video first, fall back to photo on error
                const buf = await downloadBuffer(data.media);
                const isVideo = /\.mp4(\?|$)/i.test(data.media);
                if (isVideo) {
                    await client.sendVideo(chatId, buf, { caption });
                } else {
                    await client.sendPhoto(chatId, buf, { caption });
                }
            } else if (data.type === 'slide' && Array.isArray(data.media)) {
                for (const mediaUrl of data.media) {
                    const isVideo = /\.mp4(\?|$)/i.test(mediaUrl);
                    await sendOne(mediaUrl, isVideo ? 'video' : 'photo');
                }
            } else {
                throw new Error('Unknown content type');
            }

            await cleanup();
        } catch (e) {
            console.error('Instagram download error:', e.message);
            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
            await client.sendMessage(chatId,
                `❌ Failed to download Instagram media.\nReason: ${e.message || 'Unknown error'}`,
                { parse_mode: 'Markdown' }
            );
        }
    },

    _instagram: instagram,
    _downloadBuffer: downloadBuffer
};
