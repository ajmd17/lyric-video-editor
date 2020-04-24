// https://github.com/wwwtyro/canvas-video-generator
var browserify = require('browserify');
var path = require('path');
var bodyParser = require('body-parser');
var minimist = require('minimist');
var express = require('express');
var sprintf = require('sprintf').sprintf;
var tmp = require('tmp');
var cp = require('child_process');
var fs = require('fs');

var args = minimist(process.argv.slice(2));
if (args.h || args.help) {
  console.log('usage: cvg [options]');
  console.log();
  console.log('options:');
  console.log('  -h --help:     This help');
  console.log('  -p --port:     Port to use [3172]');
  console.log('  -o --odir:     Directory to store final video in [current working directory]');
  console.log('  -n --noclean:  Do not clean up temporary files [false]')
  process.exit();
}

var PORT = args.p || args.port || 3172;
var OUTDIR = args.o || args.odir || process.cwd();
var NOCLEAN = args.n || args.noclean || false;


var app = express.Router();
tempDir = tmp.dirSync({unsafeCleanup: true});


app.use(function(req, res, next) {
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", 0);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/cvg.js', function (req, res) {
  var b = browserify();
  b.add(path.join(__dirname, '../', 'web', 'js', 'lib', 'cvg.js'));
  b.bundle(function(err, buf) {
    if (err !== null) {
      console.log(err);
    }
    var authority = req.protocol + '://' + req.get('host');
    var src = buf.toString();
    src = src.replace('cvg_authority', authority);
    res.send(src);
  });
});

let fileWritePromises = {}

app.post('/addFrame', function(req, res) {
  var data = req.body.png.replace(/^data:image\/png;base64,/, "");
  var filename = sprintf('image-%010d.png', parseInt(req.body.frame));
  fileWritePromises[filename] = new Promise((resolve, reject) => {
    fs.writeFile(sprintf('%s/%s', tempDir.name, filename), data, 'base64', () => {
      process.stdout.write(sprintf('Recieved frame %s\r', String(req.body.frame)));
      delete fileWritePromises[filename]
      resolve()
    });
  })
  res.end();
});


app.post('/render', function(req, res) {
  const fps = req.params.fps || req.body.fps || 60

  // hardcoded for now -- maybe s3 or just direct file uploading could come later
  const audioPath = path.join(__dirname, '../web/example_data/sucker_punch.wav')

  Promise.all(Object.values(fileWritePromises)).then(() => {
    var oldTemp = tempDir;
    console.log("Begining rendering of your video. This might take a long time...")

    var ffmpeg = cp.spawn('ffmpeg', [
      '-framerate', fps,
      '-start_number', '0',
      '-i', 'image-%010d.png',
      '-i', audioPath,
      '-refs', '5',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '18',
      '-c:a', 'aac',
      '-map', '0:v:0',
      '-map', '1:a:0',
      sprintf('%s/%s.mp4', OUTDIR, req.body.filename)
    ], {
      cwd: oldTemp.name,
      stdio: 'inherit'
    });
    ffmpeg.on('close', function(code) {
      console.log(sprintf('Finished rendering video. You can find it at %s/%s.mp4', OUTDIR, req.body.filename));
      if (NOCLEAN) {
        console.log(sprintf('Not cleaning temp files. You can find them in %s', oldTemp.name));
      } else {
        console.log(sprintf('Cleaning up temp files in %s', oldTemp.name));
        oldTemp.removeCallback();
      }
    });
    tempDir = tmp.dirSync({unsafeCleanup: true});
    res.end();
  }).catch((err) => {
    res.status(err).send('error rendering: ' + err.message)
  })
});
module.exports = app;