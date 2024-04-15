const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const os = require('os');
const diskusage = require('diskusage');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const logFilePath = "/root/transcribemom/logs/translatemom.log";

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Refresh log every 2 seconds
    const logInterval = setInterval(() => {
        fs.readFile(logFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading log file: ${err}`);
                socket.emit('log-error', 'Failed to read log file');
            } else {
                const lines = data.split('\n').slice(-50); // Get the last 50 lines
                socket.emit('log-update', lines.join('\n'));
            }
        });
    }, 2000);

    // Send system info every 10 seconds
    const systemInfoInterval = setInterval(async () => {
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
            socket.emit('system-error', 'Failed to get system info');
        }
    }, 10000);

    socket.on('disconnect', () => {
        console.log('User disconnected');
        clearInterval(logInterval);
        clearInterval(systemInfoInterval);
    });
});

server.listen(3000, () => {
    console.log('Listening on *:3000');
});

