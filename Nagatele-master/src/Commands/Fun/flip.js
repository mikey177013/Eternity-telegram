module.exports = {
  name: 'flip',
  aliases: ['flip', 'coin', 'dice', 'roll'],
  category: 'fun',
  react: '🎲',
  exp: 1,
  cool: 4,
  usage: '.flip coin/dice',
  description: 'Flip a coin or roll a dice',

  async execute(client, arg, ctx) {
    const userChoice = arg.toLowerCase();
    const chatId = ctx.chat.id;
    const userName = ctx.from?.first_name || 'Player';

    // If no argument, show usage
    if (!userChoice) {
      return client.sendMessage(chatId,
`🎮 *Flip Command* 🎮

Hello ${userName}! Choose an option:

🪙 *Coin Flip*
\`.flip coin\` - Flip a coin (Heads/Tails)

🎲 *Dice Roll*
\`.flip dice\` - Roll a 6-sided dice

*Examples:*
• \`.flip coin\`
• \`.flip dice\`
• \`.roll dice\``,
        { parse_mode: 'Markdown' }
      );
    }

    // Process the choice
    if (userChoice === 'coin' || userChoice === 'heads' || userChoice === 'tails') {
      // Flip coin
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const emoji = result === 'heads' ? '🪙' : '🪙';
      const resultText = result === 'heads' ? '**Heads**' : '**Tails**';
      
      // Animated message
      await client.sendMessage(chatId, `${emoji} Flipping coin...`, { parse_mode: 'Markdown' });
      
      setTimeout(async () => {
        await client.sendMessage(chatId,
`*Coin Flip Result* 🪙

👤 Player: ${userName}
🎯 Choice: ${userChoice === 'coin' ? 'Random' : userChoice}
🎲 Result: ${resultText}

${result === userChoice && userChoice !== 'coin' ? '🎉 You guessed it right!' : '😄 Better luck next time!'}`,
          { parse_mode: 'Markdown' }
        );
      }, 1500);
      
    } else if (userChoice === 'dice' || userChoice === 'roll') {
      // Roll dice
      const result = Math.floor(Math.random() * 6) + 1;
      const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const diceEmoji = diceEmojis[result];
      
      // Animated message
      await client.sendMessage(chatId, `${diceEmoji} Rolling dice...`, { parse_mode: 'Markdown' });
      
      setTimeout(async () => {
        await client.sendMessage(chatId,
`*Dice Roll Result* 🎲

👤 Player: ${userName}
🎲 Result: ${diceEmoji} **${result}**

${result === 6 ? '🎉 Critical success! You rolled a 6!' :
   result === 1 ? '😅 Oops! Snake eyes!' :
   result >= 4 ? '👍 Good roll!' :
   '🤔 Not bad!'}`,
          { parse_mode: 'Markdown' }
        );
      }, 1500);
      
    } else {
      // Invalid choice
      await client.sendMessage(chatId,
`❌ *Invalid Choice!*

Valid options:
• \`.flip coin\` - Flip a coin
• \`.flip dice\` - Roll a dice
• \`.roll dice\` - Same as dice roll

*Examples:*
\`\`\`
.flip coin
.flip dice
.roll dice
\`\`\``,
        { parse_mode: 'Markdown' }
      );
    }
  }
};