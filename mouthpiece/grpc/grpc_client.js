const path = require('path');
const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const fs = require('fs');
const { 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  StreamType
} = require('@discordjs/voice');

// Path to the proto file
const protoPath = path.resolve(__dirname, '../../grpc/voice_service.proto');

// Load the proto file
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// Load the proto definition
const voiceProto = grpc.loadPackageDefinition(packageDefinition).voice;

// Create a client directly from the loaded definition
const client = new voiceProto.VoiceService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

function processAudio(filePath, format, connection) {
  return new Promise((resolve, reject) => {
    // Read the audio file
    const audioData = fs.readFileSync(filePath);
    
    // Create a player for streaming audio
    const player = createAudioPlayer();
    connection.subscribe(player);
    
    // Track if we've started playing audio
    let isPlaying = false;
    let transcriptText = '';
    let tempFiles = [];
    
    // Call the gRPC service
    const stream = client.ProcessAudio({ audio_data: audioData });
    
    stream.on('data', (response) => {
      // Handle transcript data
      if (response.transcript) {
        transcriptText = response.transcript;
        console.log(`📝 Transcript: ${transcriptText}`);
      }
      
      // Handle audio data as it arrives in chunks
      if (response.audio_data && response.audio_data.length > 0) {
        // Create a temporary file for this chunk
        const tempPath = path.join(__dirname, `../temp-chunk-${Date.now()}.opus`);
        fs.writeFileSync(tempPath, response.audio_data);
        tempFiles.push(tempPath);
        
        // Create an audio resource from this chunk
        const resource = createAudioResource(tempPath, {
          inputType: StreamType.Opus,
        });
        
        // If we're not already playing, start playing
        if (!isPlaying) {
          player.play(resource);
          isPlaying = true;
        } else {
          // Queue this chunk to play next when the current one finishes
          player.once(AudioPlayerStatus.Idle, () => {
            player.play(resource);
          });
        }
      }
    });
    
    stream.on('end', () => {
      console.log('✅ Stream completed');
      
      // Clean up temp files when done playing
      player.once(AudioPlayerStatus.Idle, () => {
        tempFiles.forEach(file => {
          try {
            fs.unlinkSync(file);
          } catch (err) {
            console.error(`Failed to delete temp file ${file}:`, err);
          }
        });
      });
      
      resolve({ transcript: transcriptText });
    });
    
    stream.on('error', (err) => {
      console.error('❌ Error in gRPC stream:', err);
      reject(err);
    });
  });
}

module.exports = { processAudio };
