from fastapi import FastAPI, File, UploadFile, HTTPException
import numpy as np
from scipy.io import wavfile
import os

app = FastAPI()

# Ensure recordings directory exists
os.makedirs("recordings", exist_ok=True)

@app.post("/upload-audio/")
async def upload_audio(file: UploadFile = File(...)):
    try:
        # Ensure file is PCM
        if not file.filename.endswith(".pcm"):
            raise HTTPException(status_code=400, detail="Only PCM files are supported")

        # Define paths for both PCM and WAV
        pcm_path = os.path.join("recordings", file.filename)
        wav_path = pcm_path.replace('.pcm', '.wav')

        # Read PCM data and save it
        pcm_data = await file.read()
        with open(pcm_path, "wb") as pcm_file:
            pcm_file.write(pcm_data)
        print(f"✅ PCM file saved at: {pcm_path}")

        # Convert PCM to NumPy array (16-bit signed PCM)
        audio_data = np.frombuffer(pcm_data, dtype=np.int16)

        # Save as WAV
        sample_rate = 48000  # Discord uses 48kHz
        wavfile.write(wav_path, sample_rate, audio_data)
        print(f"✅ WAV file saved at: {wav_path}")

        return {
            "message": "File received, saved as PCM and converted to WAV",
            "pcm_path": pcm_path,
            "wav_path": wav_path
        }
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Root route to check if the server is up
@app.get("/")
def read_root():
    return {"message": "Ghostwriter FastAPI server is running!"}
