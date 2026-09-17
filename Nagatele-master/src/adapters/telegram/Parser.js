function parseCommand(message, prefix = '.') {
    if (!message.startsWith(prefix)) return null;

    const args = message.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    return { command, args };
}

module.exports = { parseCommand };