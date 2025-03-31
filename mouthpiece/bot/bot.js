require('dotenv').config({ path: "../../.env"});
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, EndBehaviorType, VoiceReceiver } = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const prism = require('prism-media');
const { pipeline } = require('stream');

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
const SEGMENT_DURATION_MS = 10000; // 10 second segments

// Store active streams to properly clean up
const activeStreams = new Map();

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

// 🎙️ Start Recording with direct Opus handling
function startRecording(connection, guildId) {
  let recordingStartTime = null;
  let speakingUser = null;
  let fileStream = null;
  let opusDecoder = null;
  let segmentTimeout = null;
  let recordingTimeout = null;
  
  // Clean up existing resources
  function cleanup() {
    console.log('🧹 Cleaning up recording resources');
    
    clearTimeout(segmentTimeout);
    clearTimeout(recordingTimeout);
    
    if (fileStream) {
      fileStream.end();
      fileStream = null;
    }
    
    if (opusDecoder) {
      opusDecoder.end();
      opusDecoder = null;
    }
    
    recordingStartTime = null;
    speakingUser = null;
  }
  
  // Function to start a new recording session
  function startNewRecording(userId) {
    // Clean up any existing recording
    cleanup();
    
    console.log(`🎙️ Starting new recording for ${userId}...`);
    recordingStartTime = Date.now();
    speakingUser = userId;
    
    // Create a filename with timestamp
    const filename = `recordings/${guildId}-${Date.now()}.pcm`;
    
    // Create a writestream for the PCM data
    fileStream = fs.createWriteStream(filename);
    
    // Create an Opus decoder
    opusDecoder = new prism.opus.Decoder({ 
      rate: 48000, 
      channels: 1, 
      frameSize: 960 
    });
    
    // Get the opus stream from Discord
    const opusStream = connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 3000, // 3 seconds of silence
      }
    });
    
    // Add error handlers to individual streams before the pipeline
    opusStream.on('error', (err) => {
      console.error('⚠️ Opus stream error:', err);
      // Don't crash, just log it
    });
    
    opusDecoder.on('error', (err) => {
      console.error('⚠️ Decoder error:', err);
      // Don't crash, just log it
    });
    
    fileStream.on('error', (err) => {
      console.error('⚠️ File stream error:', err);
      // Don't crash, just log it
    });
    
    // Pipe the opus stream through the decoder to the file
    pipeline(
      opusStream,
      opusDecoder,
      fileStream,
      (err) => {
        if (err) {
          console.error('❌ Pipeline error:', err);
          
          // If it's a premature close, we can still try to process what we have
          if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
            console.log('🔄 Stream closed early, but we might have useful data');
            
            // Check if we have enough data to process
            try {
              const fileSize = fs.statSync(filename).size;
              const durationSec = fileSize / (48000 * 2); // 48kHz, 16-bit
              
              console.log(`📊 Recording stats despite error: ${fileSize} bytes, ~${durationSec.toFixed(2)}s duration`);
              
              if (fileSize > 48000) { // At least 0.5 seconds
                console.log(`📤 Sending partial recording to Ghostwriter...`);
                sendRecordingToGhostwriter(filename, guildId, connection);
                // Let the cleanup function handle the reset
                speakingUser = null;
                recordingStartTime = null;
                return;
              }
            } catch (statErr) {
              console.error('❌ Error checking file stats:', statErr);
            }
          }
        } else {
          console.log('✅ Recording pipeline completed successfully');
          
          // Process the completed recording
          const fileSize = fs.statSync(filename).size;
          const durationSec = fileSize / (48000 * 2); // 48kHz, 16-bit
          
          console.log(`📊 Recording stats: ${fileSize} bytes, ~${durationSec.toFixed(2)}s duration`);
          
          if (fileSize > 48000) { // At least 0.5 seconds
            console.log(`📤 Sending recording to Ghostwriter...`);
            sendRecordingToGhostwriter(filename, guildId, connection);
          } else {
            console.log(`⚠️ Recording too short (${fileSize} bytes), not sending`);
            // Delete the short recording
            fs.unlink(filename, () => {});
          }
        }
        
        // Reset state
        speakingUser = null;
        recordingStartTime = null;
      }
    );
    
    // Set a maximum recording duration
    segmentTimeout = setTimeout(() => {
      if (fileStream) {
        console.log(`⏱️ Max recording duration reached (${SEGMENT_DURATION_MS/1000}s), finishing recording`);
        // Use a gentle approach to end streams
        if (opusDecoder) {
          opusDecoder.unpipe(fileStream);
          opusDecoder.end();
        }
        if (fileStream) {
          fileStream.end();
        }
      }
    }, SEGMENT_DURATION_MS);
    
    // Safety timeout in case the pipeline doesn't end properly
    recordingTimeout = setTimeout(() => {
      if (fileStream || opusDecoder) {
        console.log('⚠️ Safety timeout triggered, cleaning up');
        cleanup();
      }
    }, SEGMENT_DURATION_MS + 5000); // 5 seconds after the segment timeout
  }
  
  // Handle speaking start
  connection.receiver.speaking.on('start', (userId) => {
    if (userId !== ownerId) return; // Only record owner's voice
    
    // If we're not already recording this user, start a new recording
    if (!speakingUser) {
      startNewRecording(userId);
    }
  });
  
  // Handle speaking end
  connection.receiver.speaking.on('end', (userId) => {
    if (userId !== ownerId || userId !== speakingUser) return;
    
    console.log(`🎤 User ${userId} stopped speaking`);
    // The pipeline will end automatically due to AfterSilence behavior
  });
}

// 📤 Send recording to Ghostwriter
async function sendRecordingToGhostwriter(filePath, guildId, connection) {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    console.log("🚀 Sending audio to Ghostwriter...", process.env.GHOSTWRITER_API_URL + '/audio-to-text-to-audio/');
    const response = await axios.post(process.env.GHOSTWRITER_API_URL + '/audio-to-text-to-audio/', formData, {
      headers: formData.getHeaders(),
      responseType: 'stream',
      timeout: 30000
    });

    console.log("✅ Response received. Playing audio...");
    playResponseAudio(connection, response.data);
    
    // Don't delete the file immediately to aid debugging
    setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }, 10000); // Keep for 10 seconds
    
  } catch (error) {
    console.error('❌ Error sending to Ghostwriter:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out - server may be overloaded');
    }
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
  
  // Create recordings directory if it doesn't exist
  if (!fs.existsSync('recordings')) {
    fs.mkdirSync('recordings');
    console.log('📁 Created recordings directory');
  }
});

client.login(process.env.DISCORD_TOKEN);