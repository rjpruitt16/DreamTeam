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
    try {
      const audioData = fs.readFileSync(filePath);
      
      console.log('🚀 Sending Audio Request:', {
        audioDataLength: audioData.length,
        format
      });

      // Create a simple request object
      const request = {
        audio_data: audioData,
        format: format
      };

      // Get the stream response
      const stream = client.processAudio(request);
      let transcriptText = '';
      let player = null;
      let audioChunks = []; // To collect audio data
      
      // Handle data events from the stream
      stream.on('data', (response) => {
        console.log('📊 Received stream data chunk');
        
        if (response.transcript && response.transcript.length > 0) {
          transcriptText = response.transcript;
          console.log('📝 Received transcript:', transcriptText);
        }
        
        if (response.audio_data && response.audio_data.length > 0) {
          console.log(`🔊 Received audio data chunk of size: ${response.audio_data.length} bytes`);
          console.log(`🔍 Audio data type: ${typeof response.audio_data}, isBuffer: ${Buffer.isBuffer(response.audio_data)}`);
          
          // Collect audio data for later playback
          audioChunks.push(response.audio_data);
        }
      });

      // Handle end of stream
      stream.on('end', () => {
        console.log('🏁 Stream ended');
        
        if (audioChunks.length > 0) {
          // Combine all chunks into a single buffer
          let combinedBuffer;
          
          if (audioChunks.length === 1) {
            combinedBuffer = Buffer.from(audioChunks[0]);
          } else {
            // Multiple chunks need to be combined
            combinedBuffer = Buffer.concat(audioChunks.map(chunk => Buffer.from(chunk)));
          }
          
          console.log(`🔊 Combined audio data size: ${combinedBuffer.length} bytes`);
          
          // Save the file for debugging/backup
          const outputPath = filePath.replace('.pcm', '_response.opus');
          fs.writeFileSync(outputPath, combinedBuffer);
          console.log(`✅ Audio response saved to ${outputPath}`);
          
          // Now play the audio if we have a connection
          if (connection) {
            try {
              player = createAudioPlayer();
              connection.subscribe(player);
              
              const resource = createAudioResource(outputPath, {
                inputType: StreamType.Opus,
                inlineVolume: true
              });
              
              player.play(resource);
              console.log('🎵 Playing audio from file');
            } catch (playErr) {
              console.error('❌ Error playing audio:', playErr);
            }
          }
          
          resolve({ 
            transcript: transcriptText, 
            audioPath: outputPath, 
            player: player 
          });
        } else {
          console.error('❌ No audio data received in stream');
          reject(new Error('No audio data received'));
        }
      });

      // Handle errors
      stream.on('error', (err) => {
        console.error('❌ Stream error:', err);
        reject(err);
      });

    } catch (readErr) {
      console.error('❌ Error reading audio file:', readErr);
      reject(readErr);
    }
  });
}

module.exports = { processAudio };
