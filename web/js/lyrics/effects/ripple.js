var Simple1DNoise = function() {
  var MAX_VERTICES = 256;
  var MAX_VERTICES_MASK = MAX_VERTICES -1;
  var amplitude = 1;
  var scale = 1;

  var r = [];

  for ( var i = 0; i < MAX_VERTICES; ++i ) {
      r.push(Math.random());
  }

  var getVal = function( x ){
      var scaledX = x * scale;
      var xFloor = Math.floor(scaledX);
      var t = scaledX - xFloor;
      var tRemapSmoothstep = t * t * ( 3 - 2 * t );

      var xMin = xFloor % MAX_VERTICES_MASK;
      var xMax = ( xMin + 1 ) % MAX_VERTICES_MASK;

      var y = lerp( r[ xMin ], r[ xMax ], tRemapSmoothstep );

      return y * amplitude;
  };

  /**
  * Linear interpolation function.
  * @param a The lower integer value
  * @param b The upper integer value
  * @param t The value between the two
  * @returns {number}
  */
  var lerp = function(a, b, t ) {
      return a * ( 1 - t ) + b * t;
  };

  // return the API
  return {
      getVal: getVal,
      setAmplitude: function(newAmplitude) {
          amplitude = newAmplitude;
      },
      setScale: function(newScale) {
          scale = newScale;
      }
  };
}

class TVRippleEffect extends VideoRenderEffect {
  constructor() {
    super(BlendMode.NORMAL, VideoRenderEffect.EffectOrder.POST)

    this.imageData = null
    this.resultImageData = null
    this.yoffset = 0
    this.time = 0

    this.generator = new PerlinNoise(1223)
    this.noise1d = new Simple1DNoise()
  }

  _noise1d(x) {
    var effect = 1,
        k = 1, 
        sum = 0, 
        octaves = 2, 
        fallout = 4.5;

    for (var i=0; i < octaves; ++i) {
        effect *= fallout;
        sum += effect * (1 + this.generator.noise1d(k*x))/2
        k *= 2;
    }
    return sum;
  }

  _noise(effect, x, y) {
    var k = 1, 
        sum = 0, 
        octaves = 4, 
        fallout = 4.5;

    for (var i=0; i < octaves; ++i) {
        effect *= fallout;
        sum += effect * (1 + this.generator.noise2d(k*x, k*y))/2
        k *= 2;
    }
    return sum;
  }

  // https://github.com/ArtBIT/html5-canvas-tv-glitch/blob/master/js/canvas.tv.glitch.js
  _apply(effect, x, y, w, h) {
    let iy = (lerp(y, y + this.yoffset, effect) | 0) % h
    let ix = (x + (this._noise(effect, y / h, this.time) | 0)) % w
    let idx = (iy * w + ix) * 4
    let px = this.imageData.data

    return [px[idx + 0], px[idx + 1], px[idx + 2], px[idx + 3]]
  }

  renderFrame(canvas, context, effectStateData) {
    this.imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    this.resultImageData = context.getImageData(0, 0, canvas.width, canvas.height)

    let effect = (Math.sin(this.time * 0.1) * 0.5 + 0.5) * (Math.cos(this.time * 0.1) * 0.5 + 0.5)//this.noise1d.getVal(this.time)
    console.log('effect = ', effect)
    


    this.yoffset += 10
    this.time++
    
    if (effect < 0.5) {
      return null
    }

    effect -= 0.5
    effect /= 0.5
    //this.options.opacity = effect

    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        let idx = (x + y * canvas.width) * 4

        let resultPixel = this._apply(effect, x, y, canvas.width, canvas.height)

        for (let i = 0; i < 4; i++) {
          this.resultImageData.data[idx + i] = resultPixel[i]
        }
      }
    }

    return {
      offset: [0, 0],
      size: [canvas.width, canvas.height],
      imageData: this.resultImageData
    }
  }
}