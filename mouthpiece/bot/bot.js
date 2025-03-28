require('dotenv').config({ path: "../../.env"});
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const axios = require('axios');
const FormData = require('form-data');

const connections = new Map();
const ownerId = process.env.OWNER_USER_ID;
let audioBuffer = [];

const SEGMENT_DURATION_MS = 3000; // Send data every 3 seconds

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Slash command interaction handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 🟢 /join - Join and start recording
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
      await interaction.reply({ content: `✅ Joined and started recording. Sending data every ${SEGMENT_DURATION_MS / 1000}s!` });
    } catch (err) {
      console.error('❌ Error:', err);
      await interaction.reply({ content: '⚠️ Failed to join the voice channel.', ephemeral: true });
    }
  }

  // 🔴 /leave - Leave and stop recording
  if (interaction.commandName === 'leave') {
    const connection = connections.get(interaction.guild.id);
    if (connection) {
      connection.destroy();
      connections.delete(interaction.guild.id);
      await interaction.reply('👋 Left and stopped recording.');
    } else {
      await interaction.reply('❌ I\'m not in a voice channel!');
    }
  }
});

// 🛠 Start Recording and Buffer Data
function startRecording(connection, guildId) {
  connection.receiver.speaking.on('start', (userId) => {
    if (userId !== ownerId) return; // Only record your voice

    console.log(`🎙️ Recording your voice...`);

    const pcmStream = connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 2000, // 5 seconds of silence before ending
      },
    });

    const audio = new prism.opus.Decoder({ channels: 1, rate: 48000, frameSize: 960 });

    audio.on('data', (chunk) => {
      const amplitude = Math.max(...new Int16Array(chunk.buffer));
  
      // Only append audio if it's not silent
      if (amplitude > 300) { // Threshold for silence detection
        console.log(`📥 Audio Received - Amplitude: ${amplitude}`);
        audioBuffer.push(chunk);
      } else {
        console.log("🔇 Silent packet detected. Skipping.");
      }
    });

    pcmStream.pipe(audio);

    // Send to Ghostwriter every 3 seconds
    setInterval(() => {
      if (audioBuffer.length > 0) {
        console.log(`📤 Sending ${audioBuffer.length} chunks to Ghostwriter...`);
        sendToGhostwriter(Buffer.concat(audioBuffer), guildId);
        audioBuffer = []; // Clear buffer
      }
    }, SEGMENT_DURATION_MS);
  });
}

async function sendToGhostwriter(audioData, guildId) {
    const formData = new FormData();
    
    // Convert buffer to a proper form-data file
    formData.append('file', Buffer.from(audioData), {
      filename: `${guildId}-${Date.now()}.pcm`,
      contentType: 'audio/L16', // 16-bit PCM audio
    });
  
    console.log("Send to Ghostwriter, ", `${process.env.GHOSTWRITER_API_URL}/upload-audio/`);
  
    try {
      const response = await axios.post(`${process.env.GHOSTWRITER_API_URL}/upload-audio/`, formData, {
        headers: formData.getHeaders(),
      });
  
      console.log(`📝 Transcription: ${response.data.text}`);
    } catch (error) {
      console.error('❌ Error sending to Ghostwriter:', error.message);
    }
}

// ✅ Ready Event
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
