#!/bin/bash
# Wait for PM2 daemon to be ready
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/path/to/your/nvm/bin:/root/.nvm/versions/node/v18.18.0/bin
while ! pm2 ping > /dev/null 2>&1; do
    echo "Waiting for PM2 daemon to start..."
    sleep 1
done
echo "PM2 daemon is running."

set -x  # Enable debugging output

# Kill existing tmux session named "bot" if it exists
tmux kill-session -t bot 2>/dev/null

# Start a new tmux session detached (-d) and named "bot"
tmux new-session -d -s bot -n worker -c /root/tweetlingo/cmd/worker

# Start pm2 and its log in the first window
tmux send-keys -t bot "pm2 start index.js" C-m
tmux send-keys -t bot "pm2 log index" C-m

# Create a new pane for tailing logs
tmux split-window -h -t bot -c /root/tweetlingo
tmux send-keys -t bot "tail -f /root/tweetlingo/scheduler.log" C-m

# Create another pane for deleting old mp4 files
tmux split-window -v -t bot
tmux send-keys -t bot "while true; do find /root/tweetlingo/cmd/worker/*.mp4 -mindepth 1 -mmin +60 -delete >> /tmp/mycron.log 2>&1; sleep 3600; done" C-m

# Create another pane for node app
tmux split-window -v -t bot -c /root/botpanel
tmux send-keys -t bot "node app.js" C-m

# Kill existing tmux session named "back" if it exists
tmux kill-session -t back 2>/dev/null

# Start a new tmux session detached (-d) and named "back"
tmux new-session -d -s back -n transcribemom -c /root/transcribemom

# Start pm2 with ecosystem configuration in production
tmux send-keys -t back "pm2 start ecosystem.config.cjs --env=production" C-m

# Create a new pane for tailing translatemom logs
tmux split-window -h -t back
tmux send-keys -t back "tail -f /root/transcribemom/logs/translatemom.log" C-m

# Create another pane for pm2 logs
tmux split-window -v -t back
tmux send-keys -t back "pm2 log my-app" C-m

# Create another pane for deleting old mp4 files
tmux split-window -v -t back
tmux send-keys -t back "while true; do find /root/tweetlingo/cmd/worker/*.mp4 -mindepth 1 -mmin +60 -delete >> /tmp/mycron.log 2>&1; sleep 3600; done" C-m

