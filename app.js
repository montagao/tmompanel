const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const os = require('os');
const diskusage = require('diskusage');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const translatemomLogPath = "/root/transcribemom/logs/translatemom.log";
const indexOutLogPath = "/root/.pm2/logs/index-out.log";

function formatToJson(input) {
    // Ensure keys are correctly double-quoted.
    input = input.replace(/([^\s:{}]+)(?=\s*:[^:])/g, '"$1"');

    // Correctly quote and escape all string values.
    return input.replace(/:\s*'([^']*)'|:\s*([^,\]}]*)/g, function(match, p1, p2) {
        if (p1) {  // Matched first pattern: single-quoted string.
            return ': "' + p1.replace(/"/g, '\\"') + '"';
        } else if (p2) {  // Matched second pattern: unquoted value.
            return ': "' + p2.replace(/"/g, '\\"') + '"';
        }
        return match;  // Should not reach here.
    });
}


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
    console.log('Served index.html');
});

io.on('connection', (socket) => {
    console.log('A user connected');

    const sendLogs = () => {
        fs.readFile(translatemomLogPath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading translatemom log file: ${err}`);
                socket.emit('log-error', 'Failed to read translatemom log file');
            } else {
                const lines = data.split('\n').slice(-50); // Get the last 50 lines
                socket.emit('log-update', lines.join('\n'));
                console.log('Translatemom logs sent to client');
            }
        });

        fs.readFile(indexOutLogPath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading index-out log file: ${err}`);
                socket.emit('log-error', 'Failed to read index-out log file');
            } else {
                console.log('Reading index-out log file');

                // Regex to find the JSON-like structure that includes the id
                const jsonPattern = /data:[\s\S]*?{[\s\S]*?"id":\s*'(\d+)'[\s\S]*?}/;

                const match = data.match(jsonPattern);
                if (match) {
                    const id = match[1];  // Extract the ID directly from the regex match
                    const elapsedTime = Date.now() - parseInt(id);
                    socket.emit('tweet-info-update', `Elapsed Time: ${Math.floor(elapsedTime / 1000)} seconds`);
                    console.log(`Tweet info update sent: ${elapsedTime / 1000} seconds since tweet with ID: ${id}`);
                } else {
                    console.log('No valid JSON match found or ID is missing');
                }
                const lines = data.split('\n').slice(-50); // Get the last 50 lines
                socket.emit('index-log-update', lines.join('\n'));
                console.log('Index logs sent to client');
            }
        });
    };

    // Initial send
    sendLogs();

    // Refresh log every 2 seconds
    const logInterval = setInterval(sendLogs, 2000);

    // Send system info every 10 seconds
    const systemInfoInterval = setInterval(async () => {
        try {
            const diskInfo = await diskusage.check(path.parse(os.platform() === 'win32' ? 'c:' : '/').root);
            const systemInfo = {
                freemem: os.freemem(),
                totalmem: os.totalmem(),
                freeSpace: diskInfo.free,
                totalSpace: diskInfo.total,
                cpus: os.cpus().length
            };
            socket.emit('system-info', systemInfo);
            console.log('System info sent to client');
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
    console.log('Server listening on *:3000');
});

