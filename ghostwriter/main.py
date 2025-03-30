from fastapi import FastAPI, File, UploadFile, HTTPException
import numpy as np
from scipy.io import wavfile
import os
import openai
from fastapi.responses import StreamingResponse
app = FastAPI()

# Enable verbose mode based on ENV or set to False
VERBOSE = os.getenv("VERBOSE", "false").lower() == "true"

# Root route to check if the server is up
@app.get("/")
def read_root():
    return {"message": "Ghostwriter FastAPI server with OpenAI Agent SDK is running!"}


# Ensure recordings directory exists
os.makedirs("recordings", exist_ok=True)
# Configure OpenAI API
openai.api_key = os.getenv("OPENAI_API_KEY")

@app.post("/audio-to-text-to-audio/")
async def audio_to_text_to_audio(file: UploadFile = File(...)):
    try:
        # Ensure file is PCM
        if not file.filename.endswith(".pcm"):
            raise HTTPException(status_code=400, detail="Only PCM files are supported")

        # Save PCM file
        pcm_path = os.path.join("recordings", file.filename)
        with open(pcm_path, "wb") as pcm_file:
            pcm_file.write(await file.read())
        print(f"✅ PCM file saved at: {pcm_path}")

        # Convert to WAV if needed
        wav_path = pcm_path.replace('.pcm', '.wav')
        sample_rate = 48000
        os.system(f"ffmpeg -f s16le -ar {sample_rate} -ac 1 -i {pcm_path} {wav_path}")
        print(f"✅ WAV file converted: {wav_path}")

        # Step 1: Transcribe using Whisper (Speech to Text)
        print("🚀 Transcribing audio with Whisper...")
        with open(wav_path, "rb") as audio_file:
            transcription_response = openai.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1"
            )
        transcription = transcription_response.text
        print(f"📝 Transcription: {transcription}")

        # Step 2: Process Text with GPT
        print("🧠 Processing with GPT...")
        gpt_response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", 
                 "content": "You are a helpful Discord bot. Provide friendly and engaging responses."
                          + "If users ask about commands or moderation, offer appropriate guidance."
                },

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
            input=gpt_output
        )

        print("✅ Streaming audio back to client.")

             # Cleanup files if not in verbose mode
        if not VERBOSE:
            os.remove(pcm_path)
            os.remove(wav_path)
            print("🧹 Cleaned up temporary audio files.")
        else:
            print("🗄️ Verbose mode enabled. Audio files retained for debugging.")
            
        return StreamingResponse(
           iter([tts_response.content]),
           media_type="audio/mpeg"
        )

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Root route to check if the server is up
@app.get("/")
def read_root():
    return {"message": "Ghostwriter FastAPI server is running!"}
