cvg = (function() {
  var self = {};

  var AUTHORITY = 'cvg_authority';

  var frameCount = -1;

  self.addFrame = function(canvas) {
    frameCount++;

    return fetch(AUTHORITY + '/cvg/addFrame', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        png: canvas.toDataURL(),
        frame: frameCount
      })
    }).catch((err) => {
      console.error(err)
    })
  }

  self.render = function(filename, fps = 60) {
    filename = filename || 'untitled';

    return fetch(AUTHORITY + '/cvg/render', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        fps
      })
    }).catch((err) => {
      console.error(err)
    })
  }

  return self;
}());