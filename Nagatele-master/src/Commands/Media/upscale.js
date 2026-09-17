// src/Commands/Media/upscale.js
// Upscale plugin (uses sharpify helpers)
const { _runSharpify } = require('./sharpify');

module.exports = {
    name: 'upscale',
    aliases: ['hd', 'upres'],
    category: 'media',
    exp: 5,
    cool: 10,
    react: '🔍',
    description: 'Upscale an image to higher resolution (Sharpify)',
    usage: '.upscale (reply to image)',
    async execute(client, arg, M) {
        return _runSharpify(client, arg, M, 'upscale', 'Upscale', '🔍');
    }
};
