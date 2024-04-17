tmux new-session -d -s bot "cd /root/tweetlingo/cmd/worker && pm2 start index.js && pm2 log index; tmux split-window -h 'tail -f /root/tweetlingo/scheduler.log'; tmux split-window -v 'while true; do find /root/tweetlingo/cmd/worker/*.mp4 -mindepth 1 -mmin +60 -delete >> /tmp/mycron.log 2>&1; sleep 3600; done'; tmux split-window -v 'cd /root/botpanel && node app.js"
tmux new-session -d -s back "cd /root/transcribemom && pm2 start ecosystem.config.js --env=production; tmux split-window -h 'tail -f /root/transcribemom/logs/translatemom.log'; tmux split-window -v 'pm2 log my-app'; tmux split-window -v 'while true; do find /root/tweetlingo/cmd/worker/*.mp4 -mindepth 1 -mmin +60 -delete >> /tmp/mycron.log 2>&1; sleep 3600; done'"