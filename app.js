const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const os = require('os');
const diskusage = require('diskusage');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const logFilePath = "/root/.pm2/logs/my-app-out.log";

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the last 50 lines of the log file to the connected client
    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading log file: ${err}`);
        } else {
            const lines = data.split('\n').slice(-50); // Get the last 50 lines
            socket.emit('log-update', lines.join('\n'));
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
        console.log('User disconnected');
        clearInterval(interval);
    });
});

server.listen(3000, () => {
    console.log('Listening on *:3000');
});

