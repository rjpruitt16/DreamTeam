// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var voice_service_pb = require('./voice_service_pb.js');

function serialize_voice_AudioRequest(arg) {
  if (!(arg instanceof voice_service_pb.AudioRequest)) {
    throw new Error('Expected argument of type voice.AudioRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_voice_AudioRequest(buffer_arg) {
  return voice_service_pb.AudioRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_voice_AudioResponse(arg) {
  if (!(arg instanceof voice_service_pb.AudioResponse)) {
    throw new Error('Expected argument of type voice.AudioResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_voice_AudioResponse(buffer_arg) {
  return voice_service_pb.AudioResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var VoiceServiceService = exports.VoiceServiceService = {
  processAudio: {
    path: '/voice.VoiceService/ProcessAudio',
    requestStream: false,
    responseStream: true,
    requestType: voice_service_pb.AudioRequest,
    responseType: voice_service_pb.AudioResponse,
    requestSerialize: serialize_voice_AudioRequest,
    requestDeserialize: deserialize_voice_AudioRequest,
    responseSerialize: serialize_voice_AudioResponse,
    responseDeserialize: deserialize_voice_AudioResponse,
  },
};

exports.VoiceServiceClient = grpc.makeGenericClientConstructor(VoiceServiceService, 'VoiceService');
