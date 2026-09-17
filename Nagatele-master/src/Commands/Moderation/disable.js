// src/Commands/Moderation/disable.js
const { isOwner } = require('../../core/permissions');

const ALLOWED_GROUP_ID = -1003575021203;

async function isGroupAdmin(client, chatId, userId) {
  try {
    const admins = await client.bot.getChatAdministrators(chatId);
    return admins.some(a => String(a.user.id) === String(userId));
  } catch (_) {
    return false;
  }
}

module.exports = {
  name: 'disable',
  aliases: [],
  exp: 2,
  cool: 4,
  react: '❎',
  category: 'Moderation',
  usage: '.disable --<cards|pokemon|antilink|wild|antispam>',
  description: 'Disable group features',

  async execute(client, arg, ctx) {
    try {
      const chatId = ctx.chat.id;
      const userId = ctx.from.id.toString();
      const chatType = ctx.chat?.type;

      if (!arg) {
        return client.sendMessage(chatId,
          '*Available Features*\n\n' +
          '`.disable --cards` — Stop card spawning\n' +
          '`.disable --pokemon` / `--wild` — Stop pokemon\n' +
          '`.disable --antilink` — Allow links\n' +
          '`.disable --antispam` — Allow spam',
          { parse_mode: 'Markdown' }
        );
      }

      const match = arg.match(/--(\w+)/);
      if (!match) {
        return client.sendMessage(chatId, 'Use: .disable --<feature>', { parse_mode: 'Markdown' });
      }

      const feature = match[1].toLowerCase();

      const ownerOk = isOwner(userId);
      let permitted = ownerOk;
      const adminFeatures = new Set(['cards', 'wild', 'pokemon', 'pokespawn', 'poke']);
      if (!permitted && adminFeatures.has(feature) &&
          ['group', 'supergroup'].includes(chatType) &&
          Number(chatId) === ALLOWED_GROUP_ID) {
        permitted = await isGroupAdmin(client, chatId, userId);
      }
      if (!permitted) {
        return client.sendMessage(chatId, 'Only the bot owner or this group admin can disable this.', {
          parse_mode: 'Markdown'
        });
      }

      let disabled = false;
      let alreadyDisabled = false;

      if (feature === 'cards') {
        const status = await client.getCardGameStatus?.(chatId);
        if (!status || status.enabled === 0) alreadyDisabled = true;
        else disabled = await client.toggleCardGame?.(chatId, false);

      } else if (feature === 'pokemon' || feature === 'pokespawn' || feature === 'poke' || feature === 'wild') {
        const pokeStatus = client.pokemonSettings?.get?.(chatId.toString());
        if (!pokeStatus?.enabled) {
          alreadyDisabled = true;
        } else {
          await client.togglePokemonGame?.(chatId, false);
          disabled = true;
        }

      } else {
        const enabledList = await client.DB?.get?.(feature) || [];
        if (!enabledList.includes(chatId.toString())) {
          alreadyDisabled = true;
        } else {
          const index = enabledList.indexOf(chatId.toString());
          enabledList.splice(index, 1);
          await client.DB?.set?.(feature, enabledList);
          disabled = true;
        }
      }

      if (alreadyDisabled) {
        return client.sendMessage(chatId,
          `*${feature}* is already disabled.\nUse \`.enable --${feature}\` to turn on.`,
          { parse_mode: 'Markdown' }
        );
      }

      if (disabled) {
        if (feature === 'cards') {
          return client.sendMessage(chatId,
            '*Card spawning disabled*\n\nUse `.enable --cards` to re-enable.',
            { parse_mode: 'Markdown' }
          );
        }
        if (['pokemon', 'pokespawn', 'poke', 'wild'].includes(feature)) {
          return client.sendMessage(chatId,
            '*Pokemon spawner disabled*\n\nUse `.enable --wild` to re-enable.',
            { parse_mode: 'Markdown' }
          );
        }
        return client.sendMessage(chatId, `*${feature}* disabled.`, { parse_mode: 'Markdown' });
      }

      return client.sendMessage(chatId, `Failed to disable ${feature}.`, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error('Disable error:', err);
      await client.sendMessage(ctx.chat.id, 'Error.', { parse_mode: 'Markdown' });
    }
  }
};
