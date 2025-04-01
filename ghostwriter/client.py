import grpc
import voice_service_pb2
import voice_service_pb2_grpc
import argparse
import os

def process_audio(file_path, format):
    with open(file_path, "rb") as f:
        audio_data = f.read()

    with grpc.insecure_channel('localhost:50051') as channel:
        stub = voice_service_pb2_grpc.VoiceServiceStub(channel)
        response_iterator = stub.ProcessAudio(voice_service_pb2.AudioRequest(audio_data=audio_data, format=format))

        for response in response_iterator:
            if response.transcript:
                print("Transcription:", response.transcript)
            if response.audio_data:
                print("Received Audio Response:", len(response.audio_data), "bytes")
                output_path = os.path.splitext(file_path)[0] + "_response.wav"
                with open(output_path, "wb") as f:
                    f.write(response.audio_data)
                print(f"Audio response saved to: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Client to interact with gRPC server')
    parser.add_argument('file', type=str, help='Path to the audio file (wav or pcm format)')
    parser.add_argument('--format', type=str, choices=['wav', 'pcm'], required=True, help='Audio format (wav or pcm)')
    args = parser.parse_args()

    if not os.path.isfile(args.file):
        print("Error: File not found.")
    else:
        print(f"Processing file: {args.file}")
        process_audio(args.file, args.format)