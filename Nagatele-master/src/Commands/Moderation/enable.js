// src/Commands/Moderation/enable.js
const { isOwner } = require('../../core/permissions');

// Allowed group ID where admins can also enable cards/wild/pokemon (besides owner)
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
  name: 'enable',
  aliases: [],
  exp: 2,
  cool: 4,
  react: '🟢',
  category: 'Moderation',
  usage: '.enable --<cards|pokemon|antilink|wild|antispam>',
  description: 'Enable group features',

  async execute(client, arg, ctx) {
    try {
      const chatId = ctx.chat.id;
      const userId = ctx.from.id.toString();
      const chatType = ctx.chat?.type;

      if (!arg) {
        return client.sendMessage(chatId,
          '*Available Features*\n\n' +
          '`.enable --cards` — Auto card spawning\n' +
          '`.enable --pokemon` — Pokemon spawner\n' +
          '`.enable --wild` — Wild pokemon spawn\n' +
          '`.enable --antilink` — Block links\n' +
          '`.enable --antispam` — Anti-spam',
          { parse_mode: 'Markdown' }
        );
      }

      const match = arg.match(/--(\w+)/);
      if (!match) {
        return client.sendMessage(chatId, 'Use: .enable --<feature>', { parse_mode: 'Markdown' });
      }

      const feature = match[1].toLowerCase();

      // Permission policy:
      //   - Bot owner: always allowed (any chat).
      //   - Group admins of ALLOWED_GROUP_ID: allowed for cards/wild/pokemon.
      const ownerOk = isOwner(userId);
      let permitted = ownerOk;

      const adminFeatures = new Set(['cards', 'wild', 'pokemon', 'pokespawn', 'poke']);
      if (!permitted && adminFeatures.has(feature) &&
          ['group', 'supergroup'].includes(chatType) &&
          Number(chatId) === ALLOWED_GROUP_ID) {
        permitted = await isGroupAdmin(client, chatId, userId);
      }

      if (!permitted) {
        return client.sendMessage(chatId, 'Only the bot owner or this group admin can enable this.', {
          parse_mode: 'Markdown'
        });
      }

      let enabled = false;
      let alreadyEnabled = false;

      // ============== POKEMON / WILD ==============
      if (feature === 'pokemon' || feature === 'pokespawn' || feature === 'poke' || feature === 'wild') {
        const pokeStatus = client.pokemonSettings?.get?.(chatId.toString());
        if (pokeStatus?.enabled) {
          return client.sendMessage(chatId,
            'Pokemon spawner is *already enabled* in this group.\nUse `.disable --wild` to turn off.',
            { parse_mode: 'Markdown' }
          );
        }

        if (typeof client.togglePokemonGame !== 'function') {
          return client.sendMessage(chatId, 'Pokemon handler not loaded.', { parse_mode: 'Markdown' });
        }

        await client.togglePokemonGame(chatId, true);

        return client.sendMessage(chatId,
          '*Pokemon spawner enabled*\n\n' +
          '• First spawn arrives shortly\n' +
          '• Pokemon spawn every *20 minutes*\n' +
          '• Catch using: `.catch <name>`\n\n' +
          'Use `.disable --wild` to turn off.',
          { parse_mode: 'Markdown' }
        );
      }

      // ============== CARDS ==============
      if (feature === 'cards') {
        try {
          const status = await client.getCardGameStatus?.(chatId);
          if (status && status.enabled === 1) {
            return client.sendMessage(chatId,
              'Card games are *already enabled*.\nUse `.disable --cards` to turn off.',
              { parse_mode: 'Markdown' }
            );
          }
          enabled = await client.toggleCardGame?.(chatId, true);
        } catch (e) {
          console.log('Cards enable error:', e.message);
          return client.sendMessage(chatId, 'Cards system error.', { parse_mode: 'Markdown' });
        }

        if (enabled) {
          return client.sendMessage(chatId,
            '*Card spawning enabled*\n\n' +
            '• First card arrives shortly\n' +
            '• Cards spawn every *12 minutes*\n\n' +
            'Use `.disable --cards` to turn off.',
            { parse_mode: 'Markdown' }
          );
        }
        return client.sendMessage(chatId, 'Failed to enable cards.', { parse_mode: 'Markdown' });
      }

      // ============== OTHER (DB list) ==============
      const enabledList = await client.DB?.get?.(feature) || [];
      if (enabledList.includes(chatId.toString())) {
        alreadyEnabled = true;
      } else {
        enabledList.push(chatId.toString());
        await client.DB?.set?.(feature, enabledList);
        enabled = true;
      }

      if (alreadyEnabled) {
        return client.sendMessage(chatId,
          `*${feature}* is already enabled.\nUse \`.disable --${feature}\` to disable.`,
          { parse_mode: 'Markdown' }
        );
      }
      if (enabled) {
        return client.sendMessage(chatId, `*${feature}* enabled.`, { parse_mode: 'Markdown' });
      }
      return client.sendMessage(chatId, `Failed to enable ${feature}.`, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error('Enable error:', err);
      await client.sendMessage(ctx.chat.id, 'Error.', { parse_mode: 'Markdown' });
    }
  }
};
