class TVStaticEffect extends VideoRenderEffect {
  static SAMPLES = 10

  constructor(blendMode = BlendMode.ADDITIVE, order = VideoRenderEffect.EffectOrder.POST) {
    super(blendMode, order)

    this.scanSpeed = FRAMES_PER_SECOND * 15
    this.scanSize = 0
    this.scanOffsetY = 0
    this.sampleIndex = 0
    this.scaleFactor = 2.5
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

    for (let i = 0; i < TVStaticEffect.SAMPLES; i++) {
      this.samples.push(this._randomSample(context, width, height))
    }
  }

  renderFrame(canvas, context, effectStateData) {
    if (this.scanSize == 0) {
      this._createSamples(canvas, context, canvas.width, canvas.height)
    }

    let sampleData = this.samples[Math.floor(this.sampleIndex)]

    this.sampleIndex += 20 / FRAMES_PER_SECOND

    if (this.sampleIndex >= this.samples.length) {
      this.sampleIndex = 0
    }

    this.options.opacity = lerp(0.8, 1, (Math.sin(this.time) * 0.5 + 0.5))

    this.time += 0.2

    return {
      offset: [0, 0],
      size: [canvas.width, canvas.height],
      imageData: sampleData
    }
  }
}