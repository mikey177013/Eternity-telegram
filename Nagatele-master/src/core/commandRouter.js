const fs = require('fs');
const path = require('path');

const commands = new Map();

// Load commands dynamically
const commandsPath = path.join(__dirname, '../Commands');
fs.readdirSync(commandsPath, { withFileTypes: true }).forEach(dir => {
    if (dir.isDirectory()) {
        const subDir = path.join(commandsPath, dir.name);
        fs.readdirSync(subDir).forEach(file => {
            if (file.endsWith('.js')) {
                const cmd = require(path.join(subDir, file));
                commands.set(cmd.name, cmd);
                if (cmd.aliases) cmd.aliases.forEach(a => commands.set(a, cmd));
            }
        });
    }
});

async function commandRouter(client, ctx) {
    const commandName = ctx.commandName;
    const cmd = commands.get(commandName);
    if (!cmd) return;

    try {
        await cmd.execute(client, ctx.args.join(' '), ctx);
    } catch (error) {
        console.error('Command error:', error);
        await ctx.reply('❌ Error executing the command.');
    }
}

module.exports = { commandRouter };