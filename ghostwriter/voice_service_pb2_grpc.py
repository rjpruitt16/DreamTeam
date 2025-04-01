# Generated by the gRPC Python protocol compiler plugin. DO NOT EDIT!
"""Client and server classes corresponding to protobuf-defined services."""
import grpc
import warnings

import voice_service_pb2 as voice__service__pb2

GRPC_GENERATED_VERSION = '1.71.0'
GRPC_VERSION = grpc.__version__
_version_not_supported = False

try:
    from grpc._utilities import first_version_is_lower
    _version_not_supported = first_version_is_lower(GRPC_VERSION, GRPC_GENERATED_VERSION)
except ImportError:
    _version_not_supported = True

if _version_not_supported:
    raise RuntimeError(
        f'The grpc package installed is at version {GRPC_VERSION},'
        + f' but the generated code in voice_service_pb2_grpc.py depends on'
        + f' grpcio>={GRPC_GENERATED_VERSION}.'
        + f' Please upgrade your grpc module to grpcio>={GRPC_GENERATED_VERSION}'
        + f' or downgrade your generated code using grpcio-tools<={GRPC_VERSION}.'
    )


class VoiceServiceStub(object):
    """Missing associated documentation comment in .proto file."""

    def __init__(self, channel):
        """Constructor.

        Args:
            channel: A grpc.Channel.
        """
        self.ProcessAudio = channel.unary_stream(
                '/voice.VoiceService/ProcessAudio',
                request_serializer=voice__service__pb2.AudioRequest.SerializeToString,
                response_deserializer=voice__service__pb2.AudioResponse.FromString,
                _registered_method=True)


class VoiceServiceServicer(object):
    """Missing associated documentation comment in .proto file."""

    def ProcessAudio(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')


def add_VoiceServiceServicer_to_server(servicer, server):
    rpc_method_handlers = {
            'ProcessAudio': grpc.unary_stream_rpc_method_handler(
                    servicer.ProcessAudio,
                    request_deserializer=voice__service__pb2.AudioRequest.FromString,
                    response_serializer=voice__service__pb2.AudioResponse.SerializeToString,
            ),
    }
    generic_handler = grpc.method_handlers_generic_handler(
            'voice.VoiceService', rpc_method_handlers)
    server.add_generic_rpc_handlers((generic_handler,))
    server.add_registered_method_handlers('voice.VoiceService', rpc_method_handlers)


 # This class is part of an EXPERIMENTAL API.
class VoiceService(object):
    """Missing associated documentation comment in .proto file."""

    @staticmethod
    def ProcessAudio(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_stream(
            request,
            target,
            '/voice.VoiceService/ProcessAudio',
            voice__service__pb2.AudioRequest.SerializeToString,
            voice__service__pb2.AudioResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
            _registered_method=True)
