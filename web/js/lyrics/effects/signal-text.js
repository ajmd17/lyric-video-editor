class SignalTextEffect extends VideoRenderEffect {
  static ANIMATION_FRAMES = [
    { "x": 1, "y": 1, "redShadowX": 6, "blueShadowX": -6 },
    { "x": 1, "y": 1, "redShadowX": 3, "blueShadowX": -3 },
    { "x": 1, "y": 1, "redShadowX": 5, "blueShadowX": -5 },
    { "x": 1, "y": 1, "redShadowX": 7, "blueShadowX": -7 },
    { "x": 1, "y": 2, "redShadowX": 2, "blueShadowX": -2 },
    { "x": 1, "y": 2, "redShadowX": 2, "blueShadowX": -2 },
    { "x": 1, "y": 2, "redShadowX": 3, "blueShadowX": -3 },
    { "x": 1, "y": 2, "redShadowX": 2, "blueShadowX": -2 },
    { "x": 2, "y": 1, "redShadowX": 2, "blueShadowX": -2 },
    { "x": 2, "y": 1, "redShadowX": 3, "blueShadowX": -3 },
    { "x": 2, "y": 1, "redShadowX": 3, "blueShadowX": -3 },
    { "x": 2, "y": 1, "redShadowX": 4, "blueShadowX": -4 },
    { "x": 1, "y": 1, "redShadowX": 2, "blueShadowX": -2 },
    { "x": 1, "y": 1, "redShadowX": 5, "blueShadowX": -5 },
    { "x": 1, "y": 1, "redShadowX": 3, "blueShadowX": -3 },
    { "x": 1, "y": 1, "redShadowX": 2, "blueShadowX": -2 },
    { "x": 2, "y": 1, "redShadowX": 5, "blueShadowX": -5 },
    { "x": 2, "y": 1, "redShadowX": 3, "blueShadowX": -3 },
    { "x": 2, "y": 2, "redShadowX": 5, "blueShadowX": -5 },
    { "x": 2, "y": 2, "redShadowX": 2, "blueShadowX": -2 },
    { "x": 1, "y": 2, "redShadowX": 3, "blueShadowX": -3 }
  ]

  constructor(text, textX = new DynamicNumber(0), textY = new DynamicNumber(0), fontSize = 40, movement = 0.3, blendMode = BlendMode.NORMAL_MUL_ALPHA, order = VideoRenderEffect.EffectOrder.POST, options = { opacity: 1.0 }) {
    super(blendMode, order, options)

    this.text = text
    this.textX = textX
    this.textY = textY
    this.movement = movement
    this.fontSize = fontSize
    this._frame = 0

    this._subCanvas = document.createElement('canvas')
    document.getElementById('render-buffer-elements').appendChild(this._subCanvas)

    this._subContext = this._subCanvas.getContext('2d')
  }

  get _currentTextFrame() {
    return SignalTextEffect.ANIMATION_FRAMES[Math.floor(this._frame)]
  }

  renderFrame(canvas, context, effectStateData) {
    const padding = 40

    this._subCanvas.width = canvas.width
    this._subCanvas.height = canvas.height

    const textFrame = this._currentTextFrame,
          textX = this.textX.value(effectStateData),
          textY = this.textY.value(effectStateData)

    this._subContext.clearRect(0, 0, this._subCanvas.width, this._subCanvas.height)

    this._subContext.fillStyle = '#00f'
    this._subContext.font = `${this.fontSize}px "VCR"`

    this._subContext.fillText(
      this.text,
      textX + (textFrame.blueShadowX * this.movement),
      textY
    )

    this._subContext.fillStyle = '#f00'

    this._subContext.fillText(
      this.text,
      textX + (textFrame.redShadowX * this.movement),
      textY
    )

    this._subContext.fillStyle = '#fff'

    this._subContext.fillText(
      this.text,
      textX + (textFrame.x * this.movement),
      textY + (textFrame.y * this.movement)
    )

    this._frame++

    if (this._frame >= SignalTextEffect.ANIMATION_FRAMES.length) {
      this._frame = 0
    }

    return {
      offset: [0, 0],
      size: [this._subCanvas.width, this._subCanvas.height],
      imageData: this._subContext.getImageData(0, 0, this._subCanvas.width, this._subCanvas.height)
    }
  }
}