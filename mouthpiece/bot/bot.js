require('dotenv').config({ path: "../../.env" });
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,  EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs');
const prism = require('prism-media');
const { pipeline } = require('stream');
const { processAudio } = require('../grpc/grpc_client');

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
let currentRecording = null;

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
  if (currentRecording) {
    console.log('⚠️ Recording already in progress. Ignoring.');
    return;
  }

  let speakingUser = null;
  let fileStream = null;
  let startTime = null;

  function cleanup() {
    console.log('🧹 Cleaning up recording resources');
    if (fileStream) {
      fileStream.end();
      console.log('🧹 File stream closed.');
      fileStream = null;
    }
    currentRecording = null;
  }

  function startNewRecording(userId) {
    if (currentRecording) {
      console.log('⚠️ Another recording detected. Ignoring.');
      return;
    }
    currentRecording = true;
    speakingUser = userId;
    startTime = Date.now();

    console.log(`🎙️ Starting new recording for ${userId}...`);

    const filename = `recordings/${guildId}-${Date.now()}.pcm`;
    fileStream = fs.createWriteStream(filename);

    const opusDecoder = new prism.opus.Decoder({ 
      rate: 48000, 
      channels: 1, 
      frameSize: 960 
    });

    const opusStream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
    });

    pipeline(opusStream, opusDecoder, fileStream, (err) => {
      if (err) {
        console.error('❌ Pipeline error:', err);
      } else {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const fileSize = (fs.statSync(filename).size / 1024).toFixed(2);
        console.log(`✅ Recording completed. Duration: ${duration}s, Size: ${fileSize} KB`);
        console.log('✅ Processing audio...');
        processAudio(filename, 'pcm', connection).then(({ transcript, audioPath }) => {
          console.log('📝 Transcript:', transcript);
          playResponseAudio(connection, audioPath);
        }).catch(error => {
          console.error('❌ Error processing audio:', error);
        });
        console.log("finish processing audio")
      }
      cleanup();
    });

    opusStream.on('error', (error) => {
      console.error('❌ Opus Stream Error:', error);
      cleanup();
    });
  }

  connection.receiver.speaking.on('start', (userId) => {
    if (userId !== ownerId) return;
    if (!speakingUser) startNewRecording(userId);
  });

  connection.receiver.speaking.on('end', (userId) => {
    if (userId === speakingUser) {
      console.log(`🎤 User ${userId} stopped speaking.`);
      speakingUser = null;
    }
  });
}

// 🔊 Play AI Response Audio
function playResponseAudio(connection, audioPath) {
  if (!fs.existsSync(audioPath)) {
    console.error(`❌ Audio file not found at path: ${audioPath}`);
    return;
  }

  try {
    console.log(`📂 Audio file exists. Path: ${audioPath}`);

    const player = createAudioPlayer();
    const resource = createAudioResource(audioPath);

    connection.subscribe(player);
    player.play(resource);

    console.log("🎵 Playing AI response...");

    player.on(AudioPlayerStatus.Idle, () => {
      console.log("✅ Finished playing audio.");
    });

    player.on('error', (error) => {
      console.error('Audio Player Error:', error);
    });

  } catch (error) {
    console.error('❌ Error playing response audio:', error);
  }
}

// Bot Login
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  if (!fs.existsSync('recordings')) {
    fs.mkdirSync('recordings');
    console.log('📁 Created recordings directory');
  }
});

client.login(process.env.DISCORD_TOKEN);
