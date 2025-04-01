import grpc
import voice_service_pb2
import voice_service_pb2_grpc
import os
import openai
import uuid
from concurrent.futures import ThreadPoolExecutor

# Enable verbose mode based on ENV or set to False
VERBOSE = os.getenv("VERBOSE", "false").lower() == "true"

class VoiceServiceServicer(voice_service_pb2_grpc.VoiceServiceServicer):
    def ProcessAudio(self, request, context):
        try:
            # Generate a unique filename using UUID
            session_id = str(uuid.uuid4())
            pcm_path = os.path.join("recordings", f"{session_id}.pcm")
            wav_path = pcm_path.replace('.pcm', '.wav')

            # Save PCM to file
            with open(pcm_path, "wb") as pcm_file:
                pcm_file.write(request.audio_data)
            print(f"✅ PCM file saved at: {pcm_path}")

            # Convert to WAV using FFmpeg
            sample_rate = 48000
            os.system(f"ffmpeg -f s16le -ar {sample_rate} -ac 1 -i {pcm_path} {wav_path}")
            print(f"✅ WAV file converted: {wav_path}")

            # Step 1: Transcription using Whisper
            print("🚀 Transcribing audio with Whisper...")
            with open(wav_path, "rb") as audio_file:
                transcription_response = openai.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-1"
                )
            transcription = transcription_response.text
            print(f"📝 Transcription: {transcription}")

            # Stream the transcription immediately
            yield voice_service_pb2.AudioResponse(
                transcript=transcription,
                audio_data=b"",
                is_final=False
            )

            # Step 2: Process with GPT
            print("🧠 Processing with GPT...")
            gpt_response = openai.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a helpful Discord bot."},
                    {"role": "user", "content": transcription}
                ]
            )
            gpt_output = gpt_response.choices[0].message.content
            print(f"💬 GPT Response: {gpt_output}")

            # Step 3: Convert GPT Response to Speech
            print("🗣️ Converting GPT output to speech...")
            tts_response = openai.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=gpt_output,
                response_format="opus"  # Request OPUS instead of MP3
            )

            # Stream the final audio response
            yield voice_service_pb2.AudioResponse(
                transcript="",
                audio_data=tts_response.content,
                is_final=True
            )

            # Cleanup temporary files
            os.remove(pcm_path)
            os.remove(wav_path)
            print("🧹 Cleaned up temporary audio files.")
        
        except Exception as e:
            print(f"❌ Error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))

def serve():
    server = grpc.server(ThreadPoolExecutor(max_workers=10))
    voice_service_pb2_grpc.add_VoiceServiceServicer_to_server(VoiceServiceServicer(), server)
    server.add_insecure_port('[::]:50051')
    print("🚀 gRPC server started on port 50051")
    server.start()
    server.wait_for_termination()

if __name__ == "__main__":
    serve()