class TVBackgroundEffect extends VideoRenderEffect {
  static HOLE_WIDTH = 900
  static HOLE_HEIGHT = 700
  static HOLE_X = 450
  static HOLE_Y = 150

  constructor(options = {}) {
    super(BlendMode.NORMAL, VideoRenderEffect.EffectOrder.POST)

    this.imageData = null

    this.zoom = options.zoom || new DynamicTuple(1, 1)
    this.offset = options.offset || new DynamicTuple(0, 0)

    this.img = document.createElement('img')
    this.img.src = 'images/tv_gr_vignette4.png?time=' + Date.now()

    this._subCanvas = document.getElementById('sub-canvas')
    this._subCanvas.width = TVBackgroundEffect.HOLE_WIDTH
    this._subCanvas.height = TVBackgroundEffect.HOLE_HEIGHT
    this._subContext = this._subCanvas.getContext('2d')
  }

  _drawImageInHole(canvas, context) {
    // draw original image to fit in hole

    const scalingRatio = canvas.width / this._subCanvas.width

    const ar = canvas.width / canvas.height

    this._subCanvas.width =  ar * TVBackgroundEffect.HOLE_HEIGHT
    this._subCanvas.height = TVBackgroundEffect.HOLE_HEIGHT

    // draw to subcanvas
    this._subContext.clearRect(0, 0, this._subCanvas.width, this._subCanvas.height)
    this._subContext.drawImage(canvas, 0, 0, this._subCanvas.width, this._subCanvas.height)
  }

  renderFrame(canvas, context, effectStateData) {
    this._drawImageInHole(canvas, context)

    context.clearRect(0, 0, canvas.width, canvas.height)

    if (canvas.width == 0) {
      return null
    }

    const [zoomX, zoomY] = this.zoom.value(effectStateData),
          [offsetX, offsetY] = this.offset.value(effectStateData)

    const scalingRatio = (this.img.height / canvas.height)

    let width = (this.img.width / scalingRatio) * zoomX,
        height = canvas.height * zoomY,
        tvX = (canvas.width / 2) - (width / 2) + offsetX,
        tvY = (canvas.height / 2) - (height / 2) + offsetY

    const wDiv = this._subCanvas.width / TVBackgroundEffect.HOLE_WIDTH

    const ratioX = (width) / this.img.naturalWidth,
          ratioY = (height) / this.img.naturalHeight,
          subImageRatioX = this._subCanvas.width / this.img.naturalWidth,
          subImageRatioY = this._subCanvas.height / this.img.naturalHeight,
          subImageWidthScaled = subImageRatioX * width,
          subImageHeightScaled = subImageRatioY * height
    
    const holeWidth = subImageWidthScaled,
          holeHeight = subImageHeightScaled,
          holeX = ((TVBackgroundEffect.HOLE_X / wDiv) * ratioX) + tvX,
          holeY = ((TVBackgroundEffect.HOLE_Y) * ratioY) + tvY

    context.drawImage(this._subCanvas, holeX, holeY, holeWidth, holeHeight)

    context.filter = 'saturation(70%)'// brightness(129%) contrast(82%)'

    context.drawImage(
      this.img,
      0, 0,
      this.img.naturalWidth, this.img.naturalHeight,
      tvX, tvY,
      width, height
    )

    context.filter = 'saturation(100%)'// brightness(100%) contrast(100%)'

    return null
  }
}