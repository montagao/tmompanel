const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Tail } = require('tail');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const diskusage = require('diskusage')
const os = require('os')
const fs = require('fs');
const logFilePath = "/root/.pm2/logs/my-app-out.log";

// Check if the log file exists
fs.access(logFilePath, fs.constants.F_OK, (err) => {
  if (err) {
    console.error(`Error: Log file does not exist at ${logFilePath}`);
  } else {
    console.log(`Log file confirmed at ${logFilePath}`);
    // Set up tailing only if the file exists
    const tail = new Tail(logFilePath);

    tail.on("line", function(data) {
      io.emit('log-update', data);
    });

    tail.on("error", function(error) {
      console.error('Tail Error: ', error);
    });
  }
});


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const tail = new Tail("/root/.pm2/logs/my-app-out.log");


io.on('connection', (socket) => {
  console.log('a user connected');

  // Read the entire log file
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading log file: ${err}`);
    } else {
      console.log(`Log file contents:\n${data}`);
      // Send the entire log file contents to the connected client
      socket.emit('log-update', data);
    }
  });


  // Send system info every 10 seconds
  const interval = setInterval(async () => {
    try {
      const path = os.platform() === 'win32' ? 'c:' : '/';
      const { available, free, total } = await diskusage.check(path);
      const systemInfo = {
        freemem: os.freemem(),
        totalmem: os.totalmem(),
        freeSpace: free,
        totalSpace: total,
        cpus: os.cpus().length
      };
      socket.emit('system-info', systemInfo);
    } catch (err) {
      console.error('Failed to get disk usage:', err);
    }
  }, 10000);



  socket.on('disconnect', () => {
    console.log('user disconnected');
    clearInterval(interval);
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});

