from fastapi import FastAPI, File, UploadFile, HTTPException
import numpy as np
from scipy.io import wavfile
import os

app = FastAPI()


# Ensure recordings directory exists
os.makedirs("recordings", exist_ok=True)
# Configure OpenAI API
openai.api_key = os.getenv("OPENAI_API_KEY")

@app.post("/upload-audio/")
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
            transcription_response = openai.Audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        transcription = transcription_response.get("text", "")
        print(f"📝 Transcription: {transcription}")

        # Step 2: Process Text with GPT
        print("🧠 Processing with GPT...")
        gpt_response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "user", "content": transcription}
            ]
        )
        gpt_output = gpt_response.choices[0].message["content"]
        print(f"💬 GPT Response: {gpt_output}")

        # Step 3: Convert GPT Response to Speech
        print("🗣️ Converting GPT output to speech...")
        tts_response = openai.Audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=gpt_output
        )

        print("✅ Streaming audio back to client.")
        return StreamingResponse(
            tts_response.iter_content(chunk_size=1024),
            media_type="audio/mpeg"
        )

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
# Root route to check if the server is up
@app.get("/")
def read_root():
    return {"message": "Ghostwriter FastAPI server is running!"}
