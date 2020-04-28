class ImageOverlayEffect extends VideoRenderEffect {
  constructor(source, width, height, blendMode = BlendMode.NORMAL, order = VideoRenderEffect.EffectOrder.POST, options = { opacity: 1.0 }) {
    super(blendMode, order, options)

    this.source = source
    this.width = width
    this.height = height
    this._subCanvas = document.createElement('canvas')

    document.getElementById('render-buffer-elements').appendChild(this._subCanvas)

    this._subCanvas.width = width
    this._subCanvas.height = height
    this._subContext = this._subCanvas.getContext('2d')
  }

  _drawImageOnSubcanvas() {
    this._subContext.clearRect(0, 0, this._subCanvas.width, this._subCanvas.height)
    this._subContext.drawImage(this.source, 0, 0, this.width, this.height)

    return this._subContext.getImageData(0, 0, this.width, this.height)
  }

  _updateSubcanvasSize(canvas) {
    this._subCanvas.width = canvas.width
    this._subCanvas.height = canvas.height

    if (this.width === null) {
      this.width = canvas.width
    }

    if (this.height === null) {
      this.height = canvas.height
    }
  }

  renderFrame(canvas, context, effectStateData) {
    this._updateSubcanvasSize(canvas)

    return {
      offset: [0, 0],
      size: [this.width, this.height],
      imageData: this._drawImageOnSubcanvas()
    }
  }
}