require('dotenv').config({ path: "../../.env"});
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, EndBehaviorType } = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const connections = new Map();
const ownerId = process.env.OWNER_USER_ID;
let audioBuffer = [];
const SEGMENT_DURATION_MS = 3000;

// Join the channel
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'join') {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      connections.set(interaction.guild.id, connection);
      startRecording(connection, interaction.guild.id);
      await interaction.reply({ content: `✅ Joined <#${voiceChannel.id}> and started listening.` });

    } catch (err) {
      console.error('❌ Error joining VC:', err);
      await interaction.reply({ content: '⚠️ Failed to join the voice channel.', ephemeral: true });
    }
  }

  // Leave the channel
  if (interaction.commandName === 'leave') {
    const connection = connections.get(interaction.guild.id);
    if (connection) {
      connection.destroy();
      connections.delete(interaction.guild.id);
      await interaction.reply('👋 Left the voice channel!');
    } else {
      await interaction.reply('❌ I\'m not in a voice channel!');
    }
  }
});

// 🎙️ Start Recording
function startRecording(connection, guildId) {
  connection.receiver.speaking.on('start', (userId) => {
    if (userId !== ownerId) return; // Only record owner's voice

    console.log(`🎙️ Recording voice...`);

    const pcmStream = connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 5000, // End after 5 seconds of silence
      },
    });

    pcmStream.on('data', (chunk) => {
      audioBuffer.push(chunk);
    });

    // Send to Ghostwriter every 3 seconds
    setInterval(() => {
      if (audioBuffer.length > 0) {
        console.log(`📤 Sending ${audioBuffer.length} chunks to Ghostwriter...`);
        sendToGhostwriter(Buffer.concat(audioBuffer), guildId, connection);
        audioBuffer = []; // Clear buffer
      }
    }, SEGMENT_DURATION_MS);
  });
}

// 📤 Send to Ghostwriter
async function sendToGhostwriter(audioData, guildId, connection) {
  const pcmPath = `recordings/${guildId}-${Date.now()}.pcm`;
  fs.writeFileSync(pcmPath, audioData);

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(pcmPath));

    console.log("🚀 Sending audio to Ghostwriter...");
    const response = await axios.post('http://localhost:8001/audio-to-text-to-audio/', formData, {
      headers: formData.getHeaders(),
      responseType: 'stream'
    });

    console.log("✅ Response received. Playing audio...");
    playResponseAudio(connection, response.data);
  } catch (error) {
    console.error('❌ Error sending to Ghostwriter:', error.message);
  }
}

// 🔊 Play AI Response Audio
function playResponseAudio(connection, audioStream) {
  const player = createAudioPlayer();
  const resource = createAudioResource(audioStream);
  connection.subscribe(player);

  player.play(resource);
  console.log("🎵 Playing AI response...");

  player.on('error', (error) => console.error('Audio Player Error:', error));
}

// Bot Login
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);