module.exports = {
  name: "datafile",
  aliases: ["creator", "dev", "owner"],
  category: "Core",
  description: "About the bot owner",

  async execute(client, arg, M) {
    const caption =
`<b>『 𝗔𝗕𝗢𝗨𝗧 𝗢𝗪𝗡𝗘𝗥 』</b>

<b>👤 Name      : Sano</b>
<b>📍 Username  : @sanosenxpai</b>
<b>🆔 ID        : 7998469369</b>
<b>🟢 Status    : Bot Owner</b>`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "Contact Owner",
            url: "https://t.me/sanosenxpai"
          }
        ]
      ]
    };

    await client.sendPhoto(
      M.chat.id,
      "https://files.catbox.moe/d4jv7o.jpg",
      {
        caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
        reply_to_message_id: M.message_id
      }
    );
  }
};
