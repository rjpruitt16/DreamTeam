// bot.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === 'join') {
      const voiceChannel = interaction.member.voice.channel;
  
      if (!voiceChannel) {
        return interaction.reply({
          content: '❌ You must be in a voice channel to use this command.',
          ephemeral: true,
        });
      }
  
      try {
        joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
  
        await interaction.reply({
          content: `✅ Joined <#${voiceChannel.id}>`,
          ephemeral: false,
        });
  
      } catch (err) {
        console.error('❌ Error joining VC:', err);
        await interaction.reply({
          content: '⚠️ Failed to join the voice channel.',
          ephemeral: true,
        });
      }
    }

    if (interaction.commandName === 'leave') {
      const connection = getVoiceConnection(interaction.guild.id);
    
      if (connection) {
        connection.destroy(); // disconnects from voice
        await interaction.reply({
          content: '👋 Left the voice channel!',
          ephemeral: false,
        });
      } else {
        await interaction.reply({
          content: '❌ I\'m not in a voice channel!',
          ephemeral: true,
        });
      }
    }
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
