cvg = (function() {
  var self = {};

  var AUTHORITY = 'cvg_authority';

  var frameCount = -1;

  self.begin = function () {
    return fetch(AUTHORITY + '/cvg/begin', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' }
    }).then((result) => {
      return result.text().then((text) => {
        return text
      })
    }).catch((err) => {
      console.error(err)
    })
  }

  self.addFrame = function(canvas, uuid) {
    frameCount++;

    return fetch(AUTHORITY + '/cvg/addFrame?uuid=' + uuid, {
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

  self.render = function(uuid, filename, fps = 60) {
    filename = filename || 'untitled';

    return fetch(AUTHORITY + '/cvg/render?uuid=' + uuid, {
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