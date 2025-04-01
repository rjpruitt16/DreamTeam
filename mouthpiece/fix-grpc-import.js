const fs = require('fs');
const path = require('path');

const grpcFilePath = path.resolve(__dirname, './grpc/voice_service_grpc_pb.js');

fs.readFile(grpcFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }
  const fixedData = data.replace("var grpc = require('grpc');", "var grpc = require('@grpc/grpc-js');");
  fs.writeFile(grpcFilePath, fixedData, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
    } else {
      console.log('✅ Fixed grpc import to @grpc/grpc-js');
    }
  });
});
