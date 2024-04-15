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
const indexErrorLogPath = "/root/.pm2/logs/index-error.log";

function snowflake2millis(snowflakeId) {
    /**
     * Get millisecond timestamp from snowflake ID.
     */
    return (snowflakeId / Math.pow(2, 22)) + 1288834974657;
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
        fs.readFile(indexErrorLogPath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading index error log file: ${err}`);
                socket.emit('index-error-error', 'Failed to read translatemom log file');
            } else {
                const lines = data.split('\n').slice(-50); // Get the last 50 lines
                socket.emit('index-error-update', lines.join('\n'));
                console.log('index (worker) error logs sent to client');
            }
        });



        fs.readFile(indexOutLogPath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading index-out log file: ${err}`);
                socket.emit('log-error', 'Failed to read index-out log file');
            } else {
                console.log('Reading index-out log file');

                // Regex to find the JSON-like structure that includes the id
                const jsonPattern = /data:[\s\S]*?{[\s\S]*?edit_history_tweet_ids:\s*\[\s*'(\d+)'\s*\][\s\S]*?}/g;

                let matches = [...data.matchAll(jsonPattern)];
                let match = matches[matches.length - 1];

                if (match) {
                    const id = match[match.length - 1];  // Extract the ID directly from the regex match
                    const tweetTime = snowflake2millis(parseInt(id));
                    const elapsedTime = Date.now() - tweetTime;
                    // Assume 'elapsedTime' is in milliseconds
                    let totalSeconds = Math.floor(elapsedTime / 1000);
                    let hours = Math.floor(totalSeconds / 3600);
                    let minutes = Math.floor((totalSeconds % 3600) / 60);
                    let seconds = totalSeconds % 60;

                    // Create a formatted string for the elapsed time
                    let formattedTime = `${hours} hours, ${minutes} minutes, ${seconds} seconds`;

                    // Emit and log the formatted time
                    socket.emit('tweet-info-update', `Elapsed Time: ${formattedTime} at https://x.com/i/status/${id}`);
                    console.log(`Tweet info update sent: ${formattedTime} since tweet with ID: ${id}`);

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

