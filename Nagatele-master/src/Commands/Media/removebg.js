// src/Commands/Media/removebg.js
// Remove background plugin (uses sharpify helpers)
const { _runSharpify } = require('./sharpify');

module.exports = {
    name: 'removebg',
    aliases: ['rmbg', 'nobg'],
    category: 'media',
    exp: 5,
    cool: 10,
    react: '🪄',
    description: 'Remove image background (Sharpify)',
    usage: '.removebg (reply to image)',
    async execute(client, arg, M) {
        return _runSharpify(client, arg, M, 'removebg', 'Remove Background', '🪄');
    }
};
