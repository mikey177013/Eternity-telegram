module.exports = {
  name: 'ping',
  aliases: ['p'],
  category: 'core',
  description: 'Check if bot is alive',
  
  async execute(client, arg, M) {
    const start = Date.now();
    const msg = await client.sendMessage(M.chat.id, '🏓 Pinging...');
    const latency = Date.now() - start;
    
    await client.sendMessage(M.chat.id, 
      `🏓 Pong!\n` +
      `• Latency: ${latency}ms\n` +
      `• Chat ID: ${M.chat.id}`
    );
  }
};