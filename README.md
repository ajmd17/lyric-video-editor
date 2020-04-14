## This app allows you to build simple lyric videos for songs and then render it into an mp4.

### Install npm packages:
```
npm install
```

### Install canvas-video-generator (https://github.com/wwwtyro/canvas-video-generator)
```
npm install -g canvas-video-generator
```

Note, you may need to use `sudo` for the command above.

### Make sure you have `ffmpeg` command on your system.
You can download ffmpeg here: http://ffmpeg.org/download.html

### Spin up a http server to display the app:
```
npx http-server -p 8000
```

### Spin up the `cvg` server as well
```
npx cvg
```

### Navigate to http://localhost:8000 in your browser
And away she goes.