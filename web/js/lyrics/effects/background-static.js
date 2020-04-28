class TVStaticEffect extends VideoRenderEffect {
  static SAMPLES = 10
  static BLENDING_FRAMES = 1

  constructor(options = {}, blendMode = BlendMode.ADDITIVE, order = VideoRenderEffect.EffectOrder.POST) {
    super(blendMode, order)

    this.mode = options.mode || 0
    this.speed = options.speed || new DynamicNumber(20)
    this.opacity = options.opacity || new DynamicNumber(1)
    this.scanSize = 0
    this.scanOffsetY = 0
    this.sampleIndex = 0
    this.scaleFactor = 2.5
    this.imageData = null
    this.time = 0
  }

  _interpolate(x, x0, y0, x1, y1) {
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0))
  }

  _randomSample(context, w, h) {
    let intensity = []
		const factor = h / 50
		const trans = 1 - Math.random() * 0.05

    let intensityCurve = []

		for (let i = 0; i < Math.floor(h / factor) + factor; i++) {
      intensityCurve.push(Math.floor(Math.random() * 15))
    }

		for (let i = 0; i < h; i++) {
			const value = this._interpolate((i / factor), Math.floor(i / factor), intensityCurve[Math.floor(i / factor)], Math.floor(i / factor) + 1, intensityCurve[Math.floor(i / factor) + 1])

      intensity.push(value)
		}

		const imageData = context.createImageData(w, h)

		for (let i = 0; i < (w * h); i++) {
			const k = i * 4
      let color = Math.floor(36 * Math.random())
  
			// Optional: add an intensity curve to try to simulate scan lines
			color += intensity[Math.floor(i / w)]
			imageData.data[k] = imageData.data[k + 1] = imageData.data[k + 2] = color
			imageData.data[k + 3] = Math.round(255 * trans)
    }

		return imageData
  }

  _createSamples(canvas, context, width, height) {
    this.scanSize = (canvas.offsetHeight / this.scaleFactor) / 3

    this.samples = []

    let rawSamples = []

    for (let i = 0; i < TVStaticEffect.SAMPLES; i++) {
      rawSamples.push(this._randomSample(context, width, height))
    }

    rawSamples.forEach((sample, index) => {
      this.samples.push(sample)

      if (index == 0) {
        return
      }

      let prevSample = this.samples[this.samples.length - 1],
          blendSample = context.createImageData(width, height)

      for (let i = 1; i <= TVStaticEffect.BLENDING_FRAMES; i++) {
        const blend = i / (TVStaticEffect.BLENDING_FRAMES + 1)

        for (let x = 0; x < sample.width; x++) {
          for (let y = 0; y < sample.height; y++) {

            let idx = (x + y * sample.width) * 4

            blendSample.data[idx] = lerp(prevSample.data[idx], sample.data[idx], blend)
            blendSample.data[idx + 1] = lerp(prevSample.data[idx + 1], sample.data[idx + 1], blend)
            blendSample.data[idx + 2] = lerp(prevSample.data[idx + 2], sample.data[idx + 2], blend)
            blendSample.data[idx + 3] = lerp(prevSample.data[idx + 3], sample.data[idx + 3], blend)
          }
        }
      }

      this.samples.push(blendSample)
    })
  }

  renderFrame(canvas, context, effectStateData) {
    let imageData

    if (this.mode == 0) {
      if (_.isEmpty(this.samples)) {
        this._createSamples(canvas, context, canvas.width, canvas.height)
      }

      imageData = this.samples[Math.floor(this.sampleIndex)]

      this.sampleIndex += this.speed.value(effectStateData) / FRAMES_PER_SECOND
      
      if (this.sampleIndex >= this.samples.length) {
        this.sampleIndex = 0
      }
    } else if (this.mode == 1) {
      if (this.imageData == null) {
        this.imageData = context.createImageData(canvas.width, canvas.height)
      }

      imageData = this.imageData

      for (var i = 0; i < canvas.width * canvas.height * 4; i++) {
        imageData.data[i] = ((255 * Math.random()) | 0) << 24;
      }
    }

    this.options.opacity = this.opacity.value(effectStateData)

    return {
      offset: [0, 0],
      size: [canvas.width, canvas.height],
      imageData
    }
  }
}