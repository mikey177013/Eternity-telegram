// src/Handlers/AutoDownloader.js
// Auto downloader for Telegram - converts whatsapp downloader.js to telegram format
// Handles: TikTok, Instagram, Pinterest, YouTube, GitHub, MediaFire, Twitter/X, Threads, Mega, SoundCloud, Spotify, Facebook, Videy, Sfile
// Triggers automatically when a user shares a supported link (no prefix required)

const axios = require('axios');

// =================== REGEXES (same as original downloader.js) ===================
const TT = /(?<!\S)https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+(?=\s|$)/gi;
const IG = /https?:\/\/(www\.)?instagram\.com\/[^\s]+/gi;
const MF = /(?<!\S)https?:\/\/(www\.)?mediafire\.com\/\S+(?=\s|$)/gi;
const PIN = /https?:\/\/(www\.)?(pinterest\.(com|fr|de|co\.uk|jp|ru|ca|it|com\.au|com\.mx|com\.br|es|pl)|pin\.it)\/[^\s]+/gi;
const FB = /(?<!\S)https?:\/\/(www\.|m\.|web\.)?facebook\.com\/[^\s]+(?=\s|$)/gi;
const TW = /(?<!\S)https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s]+(?=\s|$)/gi;
const VD = /https?:\/\/(www\.)?videy\.co\/[^\s]+/gi;
const TH = /https?:\/\/(www\.)?threads\.(net|com)\/[^\s]+/gi;
const MG = /https?:\/\/mega\.nz\/[^\s]+/gi;
const SC = /(?<!\S)https?:\/\/(www\.|on\.)?soundcloud\.com\/[^\s]+(?=\s|$)/gi;
const SP = /https?:\/\/open\.spotify\.com\/[^\s]+/gi;
const YT = /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[^\s]+/gi;
const SF = /https?:\/\/sfile\.co\/[^\s]+/gi;
const GH = /https?:\/\/(www\.)?github\.com\/[^\s]+/gi;

const SUPPORTED_DOMAINS = [
  'tiktok.com', 'instagram.com', 'instagr.am', 'pinterest.com', 'pin.it',
  'facebook.com', 'fb.com', 'fb.watch', 'twitter.com', 'x.com',
  'threads.net', 'threads.com', 'mega.nz', 'soundcloud.com',
  'open.spotify.com', 'spotify.com', 'youtube.com', 'youtu.be',
  'mediafire.com', 'videy.co', 'sfile.co', 'github.com'
];

/**
 * Returns true if URL belongs to one of the supported (auto-download) platforms.
 */
function isSupportedDownloadLink(url) {
  if (!url) return false;
  try {
    const lower = url.toLowerCase();
    return SUPPORTED_DOMAINS.some(d => lower.includes(d));
  } catch (e) {
    return false;
  }
}

/**
 * Extract URL info from text
 */
function extractLink(txt) {
  if (!txt) return null;
  const clean = (m) => m?.[0]?.replace(/[.,!?]$/, '');
  let m;

  m = txt.match(TT); if (m) return { type: 'tt', url: clean(m) };
  m = txt.match(IG); if (m && !clean(m).includes('/stories/')) return { type: 'ig', url: clean(m) };
  m = txt.match(PIN); if (m) return { type: 'pin', url: clean(m) };
  m = txt.match(FB); if (m) {
    const u = clean(m);
    if (!u.includes('/login') && !u.includes('/dialog') && !u.includes('/plugins/')) {
      return { type: 'fb', url: u };
    }
  }
  m = txt.match(TW); if (m) return { type: 'tw', url: clean(m) };
  m = txt.match(VD); if (m) return { type: 'vd', url: clean(m) };
  m = txt.match(TH); if (m) return { type: 'th', url: clean(m) };
  m = txt.match(MG); if (m) return { type: 'mg', url: clean(m) };
  m = txt.match(SC); if (m) return { type: 'sc', url: clean(m) };
  m = txt.match(SP); if (m) return { type: 'sp', url: clean(m) };
  m = txt.match(YT); if (m) return { type: 'yt', url: clean(m) };
  m = txt.match(SF); if (m) return { type: 'sf', url: clean(m) };
  m = txt.match(MF); if (m) return { type: 'mf', url: clean(m) };
  m = txt.match(GH); if (m) return { type: 'gh', url: clean(m) };
  return null;
}

// =================== API CALLS (same endpoints as original) ===================

const tt = async (url) => {
  const { data: d } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (d.code !== 0 || !d.data) throw new Error(d.msg || 'TikTok API error');
  const r = d.data.images?.length
    ? { type: 'image', data: d.data.images }
    : { type: 'video', data: d.data.play };
  return { type: r.type, data: r.data, title: d.data.title };
};

const ig = async (url) => {
  const { data: d } = await axios.get(`https://api-faa.my.id/faa/igdl?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result || !d.result.url) throw new Error(d.message || 'Instagram API error');
  return { urls: d.result.url, isVideo: d.result.metadata?.isVideo };
};

const pin = async (url) => {
  const { data: d } = await axios.get(`https://api-faa.my.id/faa/pin-down?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result || !d.result.medias) throw new Error(d.message || 'Pinterest API error');
  return d.result.medias;
};

const fb = async (url) => {
  const { data: d } = await axios.get(`https://api-faa.my.id/faa/fbdownload?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result || !d.result.media) throw new Error(d.message || 'Facebook API error');
  return d.result.media;
};

const tw = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/twitter?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result) throw new Error(d.message || 'Twitter/X API error');
  return { type: d.result.type, data: d.result.download_url };
};

const vd = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/videy?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result) throw new Error(d.message || 'Videy API error');
  return d.result;
};

const mf = async (url) => {
  const { data: d } = await axios.get(`https://api-faa.my.id/faa/mediafire?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result) throw new Error(d.message || 'MediaFire API error');
  return d.result;
};

const th = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/threads?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result || !d.result.media) throw new Error(d.message || 'Threads API error');
  return d.result.media;
};

const mg = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/mega?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result) throw new Error(d.message || 'Mega API error');
  return d.result;
};

const sc = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/soundcloud?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result || !d.result.url) throw new Error(d.message || 'SoundCloud API error');
  return d.result;
};

const sp = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/spotify?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result || !d.result.url) throw new Error(d.message || 'Spotify API error');
  return d.result;
};

const yt = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 45000 });
  if (!d.status || !d.result || !d.result.url) throw new Error(d.message || 'YouTube API error');
  return d.result;
};

const sf = async (url) => {
  const { data: d } = await axios.get(`https://api.nexray.web.id/downloader/sfile?url=${encodeURIComponent(url)}`, { timeout: 30000 });
  if (!d.status || !d.result || !d.result.url) throw new Error(d.message || 'Sfile API error');
  return d.result;
};

// =================== TELEGRAM SEND HELPERS ===================

async function sendVideo(client, chatId, videoUrl, options = {}) {
  return client.bot.sendVideo(chatId, videoUrl, {
    supports_streaming: true,
    ...options,
  });
}

async function sendPhoto(client, chatId, photoUrl, options = {}) {
  return client.bot.sendPhoto(chatId, photoUrl, options);
}

async function sendAudio(client, chatId, audioUrl, options = {}) {
  return client.bot.sendAudio(chatId, audioUrl, options);
}

async function sendDocument(client, chatId, docUrl, options = {}) {
  return client.bot.sendDocument(chatId, docUrl, options);
}

async function sendMediaGroup(client, chatId, media) {
  try {
    return await client.bot.sendMediaGroup(chatId, media);
  } catch (e) {
    // Fallback: send individually
    for (const item of media) {
      try {
        if (item.type === 'photo') await sendPhoto(client, chatId, item.media);
        else if (item.type === 'video') await sendVideo(client, chatId, item.media);
      } catch (_) {}
    }
  }
}

// =================== MAIN AUTO-DOWNLOAD HANDLER ===================

/**
 * Process a Telegram message text and auto-download if a supported link is found.
 * Returns { handled: boolean } - if handled=true, message contained a supported link.
 */
async function processMessage(client, msg) {
  const text = msg.text || msg.caption || '';
  if (!text) return { handled: false };

  const link = extractLink(text);
  if (!link) return { handled: false };

  const chatId = msg.chat.id;
  const replyTo = msg.message_id;
  const baseOpts = { reply_to_message_id: replyTo };

  // React with 📥 (use sendChatAction since reactions API isn't always available)
  try { await client.bot.sendChatAction(chatId, 'upload_video'); } catch (_) {}

  let statusMsg = null;
  try {
    statusMsg = await client.bot.sendMessage(chatId,
      `📥 *Downloading from ${platformLabel(link.type)}...*`,
      { parse_mode: 'Markdown', reply_to_message_id: replyTo }
    );
  } catch (_) {}

  const deleteStatus = async () => {
    if (!statusMsg) return;
    try { await client.bot.deleteMessage(chatId, statusMsg.message_id); } catch (_) {}
  };

  try {
    switch (link.type) {
      case 'tt': {
        const r = await tt(link.url);
        if (r.type === 'video') {
          await sendVideo(client, chatId, r.data, {
            ...baseOpts,
            caption: `🎵 *TikTok Download*${r.title ? `\n\n${r.title}` : ''}`,
            parse_mode: 'Markdown'
          });
        } else if (r.type === 'image') {
          if (!r.data || r.data.length === 0) throw new Error('No image data found');
          if (r.data.length === 1) {
            await sendPhoto(client, chatId, r.data[0], { ...baseOpts, caption: '🎵 TikTok Image' });
          } else {
            const media = r.data.slice(0, 10).map((u, i) => ({
              type: 'photo',
              media: u,
              caption: i === 0 ? '🎵 TikTok Slides' : undefined,
            }));
            await sendMediaGroup(client, chatId, media);
          }
        }
        break;
      }

      case 'ig': {
        const { urls, isVideo } = await ig(link.url);
        if (!urls || urls.length === 0) throw new Error('No media found');
        if (urls.length === 1) {
          if (isVideo) {
            await sendVideo(client, chatId, urls[0], {
              ...baseOpts, caption: '📸 *Instagram Download*', parse_mode: 'Markdown'
            });
          } else {
            await sendPhoto(client, chatId, urls[0], {
              ...baseOpts, caption: '📸 *Instagram Download*', parse_mode: 'Markdown'
            });
          }
        } else {
          const media = urls.slice(0, 10).map((u, i) => ({
            type: isVideo ? 'video' : 'photo',
            media: u,
            caption: i === 0 ? '📸 Instagram Media' : undefined,
          }));
          await sendMediaGroup(client, chatId, media);
        }
        break;
      }

      case 'pin': {
        const meds = await pin(link.url);
        if (!meds || meds.length === 0) throw new Error('No media found');
        const imgs = meds.filter(x => x.type === 'image');
        if (imgs.length > 0) {
          if (imgs.length === 1) {
            await sendPhoto(client, chatId, imgs[0].url, {
              ...baseOpts, caption: '📌 *Pinterest Download*', parse_mode: 'Markdown'
            });
          } else {
            const media = imgs.slice(0, 10).map((m, i) => ({
              type: 'photo',
              media: m.url,
              caption: i === 0 ? '📌 Pinterest Media' : undefined,
            }));
            await sendMediaGroup(client, chatId, media);
          }
        } else {
          const vid = meds.find(x => x.type === 'video');
          const gif = meds.find(x => x.type === 'gif');
          if (vid) {
            await sendVideo(client, chatId, vid.url, {
              ...baseOpts, caption: '📌 *Pinterest Video*', parse_mode: 'Markdown'
            });
          } else if (gif) {
            await client.bot.sendAnimation(chatId, gif.url, {
              ...baseOpts, caption: '📌 *Pinterest GIF*', parse_mode: 'Markdown'
            });
          }
        }
        break;
      }

      case 'fb': {
        const med = await fb(link.url);
        if (med.video_hd || med.video_sd) {
          const vu = med.video_hd || med.video_sd;
          await sendVideo(client, chatId, vu, {
            ...baseOpts, caption: '📘 *Facebook Download*', parse_mode: 'Markdown'
          });
        } else if (med.photo_image) {
          await sendPhoto(client, chatId, med.photo_image, {
            ...baseOpts, caption: '📘 *Facebook Image*', parse_mode: 'Markdown'
          });
        } else {
          throw new Error('No downloadable media found in this Facebook post');
        }
        break;
      }

      case 'tw': {
        const r = await tw(link.url);
        if (r.type === 'image') {
          if (!r.data || r.data.length === 0) throw new Error('No image data found');
          if (r.data.length === 1) {
            await sendPhoto(client, chatId, r.data[0].url, {
              ...baseOpts, caption: '🐦 *Twitter/X Download*', parse_mode: 'Markdown'
            });
          } else {
            const media = r.data.slice(0, 10).map((m, i) => ({
              type: 'photo',
              media: m.url,
              caption: i === 0 ? '🐦 Twitter/X Media' : undefined,
            }));
            await sendMediaGroup(client, chatId, media);
          }
        } else if (r.type === 'video') {
          if (!r.data || r.data.length === 0) throw new Error('No video data found');
          const vqs = r.data.filter(it => it.type === 'mp4');
          const best =
            vqs.find(v => v.resolusi === '768p') ||
            vqs.find(v => v.resolusi === '640p') ||
            vqs.find(v => v.resolusi === '426p') ||
            vqs[0];
          if (best) {
            await sendVideo(client, chatId, best.url, {
              ...baseOpts, caption: '🐦 *Twitter/X Video*', parse_mode: 'Markdown'
            });
          } else {
            throw new Error('No video URL found');
          }
        }
        break;
      }

      case 'vd': {
        const vu = await vd(link.url);
        const videoUrl = typeof vu === 'string' ? vu : (vu.url || vu.download_url);
        await sendVideo(client, chatId, videoUrl, {
          ...baseOpts, caption: '🎬 *Videy Download*', parse_mode: 'Markdown'
        });
        break;
      }

      case 'mf': {
        const r = await mf(link.url);
        await sendDocument(client, chatId, r.download_url, {
          ...baseOpts,
          caption: `📁 *MediaFire Download*\n\n📄 *Filename:* ${r.filename}\n📦 *Size:* ${r.size}`,
          parse_mode: 'Markdown',
        });
        break;
      }

      case 'th': {
        const meds = await th(link.url);
        if (!meds || meds.length === 0) throw new Error('No media found');
        const vids = meds.filter(m => m.thumbnail && m.thumbnail !== '-');
        const imgs = meds.filter(m => !m.thumbnail || m.thumbnail === '-');
        if (vids.length > 0) {
          await sendVideo(client, chatId, vids[0].url, {
            ...baseOpts, caption: '🧵 *Threads Download*', parse_mode: 'Markdown'
          });
        } else if (imgs.length > 0) {
          if (imgs.length === 1) {
            await sendPhoto(client, chatId, imgs[0].url, {
              ...baseOpts, caption: '🧵 *Threads Download*', parse_mode: 'Markdown'
            });
          } else {
            const media = imgs.slice(0, 10).map((m, i) => ({
              type: 'photo',
              media: m.url,
              caption: i === 0 ? '🧵 Threads Media' : undefined,
            }));
            await sendMediaGroup(client, chatId, media);
          }
        }
        break;
      }

      case 'mg': {
        const r = await mg(link.url);
        const durl = Array.isArray(r.download_url) ? r.download_url[0] : r.download_url;
        await sendDocument(client, chatId, durl, {
          ...baseOpts,
          caption: `☁️ *Mega Download*\n\n📄 *Filename:* ${r.filename}\n📦 *Size:* ${r.filesize}`,
          parse_mode: 'Markdown',
        });
        break;
      }

      case 'sc': {
        const r = await sc(link.url);
        await sendAudio(client, chatId, r.url, {
          ...baseOpts,
          title: r.title || r.fileName || 'SoundCloud Audio',
          performer: r.author || r.artist || 'SoundCloud',
          caption: `🎧 *SoundCloud Download*${r.title ? `\n\n🎵 ${r.title}` : ''}`,
          parse_mode: 'Markdown',
        });
        break;
      }

      case 'sp': {
        const r = await sp(link.url);
        await sendAudio(client, chatId, r.url, {
          ...baseOpts,
          title: r.title || 'Spotify Track',
          performer: r.artist || 'Spotify',
          caption: `🎵 *Spotify Download*\n\n🎼 *${r.title}*\n👤 ${r.artist}`,
          parse_mode: 'Markdown',
        });
        break;
      }

      case 'yt': {
        const r = await yt(link.url);
        await sendAudio(client, chatId, r.url, {
          ...baseOpts,
          title: r.title || 'YouTube Audio',
          performer: r.author || 'YouTube',
          caption: `▶️ *YouTube Download*${r.title ? `\n\n🎵 ${r.title}` : ''}`,
          parse_mode: 'Markdown',
        });
        break;
      }

      case 'sf': {
        const r = await sf(link.url);
        await sendDocument(client, chatId, r.url, {
          ...baseOpts,
          caption: `📦 *Sfile Download*\n\n📄 *Filename:* ${r.file_name}\n📦 *Size:* ${r.size}`,
          parse_mode: 'Markdown',
        });
        break;
      }

      case 'gh': {
        // GitHub - try to get repo zip download if it's a repo URL
        const ghInfo = parseGithubUrl(link.url);
        if (ghInfo) {
          const zipUrl = `https://github.com/${ghInfo.owner}/${ghInfo.repo}/archive/refs/heads/${ghInfo.branch}.zip`;
          await sendDocument(client, chatId, zipUrl, {
            ...baseOpts,
            caption:
              `🐙 *GitHub Repository*\n\n` +
              `📁 *Repo:* \`${ghInfo.owner}/${ghInfo.repo}\`\n` +
              `🌿 *Branch:* \`${ghInfo.branch}\`\n` +
              `🔗 ${link.url}`,
            parse_mode: 'Markdown',
          });
        } else {
          // Not a recognizable repo URL — skip silently
          await deleteStatus();
          return { handled: false };
        }
        break;
      }

      default:
        await deleteStatus();
        return { handled: false };
    }

    await deleteStatus();
    return { handled: true };

  } catch (err) {
    console.error('AutoDownloader error:', err.message);
    await deleteStatus();
    try {
      await client.bot.sendMessage(chatId,
        `❌ *Download failed:* ${err.message || 'Unknown error'}`,
        { parse_mode: 'Markdown', reply_to_message_id: replyTo }
      );
    } catch (_) {}
    return { handled: true }; // still consume so anti-link doesn't fire
  }
}

function platformLabel(type) {
  const labels = {
    tt: 'TikTok', ig: 'Instagram', pin: 'Pinterest', fb: 'Facebook',
    tw: 'Twitter/X', vd: 'Videy', th: 'Threads', mg: 'Mega',
    sc: 'SoundCloud', sp: 'Spotify', yt: 'YouTube', sf: 'Sfile',
    mf: 'MediaFire', gh: 'GitHub',
  };
  return labels[type] || 'Unknown';
}

function parseGithubUrl(url) {
  try {
    const m = url.match(/github\.com\/([^\/\s]+)\/([^\/\s\?#]+)(?:\/tree\/([^\/\s\?#]+))?/i);
    if (!m) return null;
    const owner = m[1];
    let repo = (m[2] || '').replace(/\.git$/, '');
    const branch = m[3] || 'main';
    if (!owner || !repo) return null;
    return { owner, repo, branch };
  } catch (e) {
    return null;
  }
}

module.exports = {
  processMessage,
  isSupportedDownloadLink,
  extractLink,
  SUPPORTED_DOMAINS,
};
