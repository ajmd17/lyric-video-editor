class TVBackgroundEffect extends VideoRenderEffect {
  static HOLE_WIDTH = 900
  static HOLE_HEIGHT = 700
  static HOLE_X = 450
  static HOLE_Y = 150

  constructor(options = {}) {
    super(BlendMode.NO_TRANSPARENCY, VideoRenderEffect.EffectOrder.POST)

    this.imageData = null

    this.zoom = options.zoom || new DynamicTuple(1, 1)
    this.offset = options.offset || new DynamicTuple(0, 0)

    this.img = document.createElement('img')
    this.img.src = 'images/tv_gr_vignette4.png?time=' + Date.now()
    this.time = 0

    this._holeSubCanvas = document.createElement('canvas')
    document.getElementById('render-buffer-elements').appendChild(this._holeSubCanvas)
    this._holeSubCanvas.width = TVBackgroundEffect.HOLE_WIDTH
    this._holeSubCanvas.height = TVBackgroundEffect.HOLE_HEIGHT
    this._holeSubContext = this._holeSubCanvas.getContext('2d')

    this._tvSubCanvas = document.createElement('canvas')
    document.getElementById('render-buffer-elements').appendChild(this._tvSubCanvas)
    this._tvSubCanvas.width = TVBackgroundEffect.HOLE_WIDTH
    this._tvSubCanvas.height = TVBackgroundEffect.HOLE_HEIGHT
    this._tvSubContext = this._tvSubCanvas.getContext('2d')
  }

  _drawImageInHole(canvas, context) {
    // draw original image to fit in hole

    const scalingRatio = canvas.width / this._holeSubCanvas.width

    const ar = canvas.width / canvas.height

    this._holeSubCanvas.width =  ar * TVBackgroundEffect.HOLE_HEIGHT
    this._holeSubCanvas.height = TVBackgroundEffect.HOLE_HEIGHT

    // draw to subcanvas
    this._holeSubContext.clearRect(0, 0, this._holeSubCanvas.width, this._holeSubCanvas.height)
    this._holeSubContext.drawImage(canvas, 0, 0, this._holeSubCanvas.width, this._holeSubCanvas.height)
  }

  renderFrame(canvas, context, effectStateData) {
    this._tvSubCanvas.width = canvas.width
    this._tvSubCanvas.height = canvas.height

    this._drawImageInHole(canvas, context)

    this._tvSubContext.clearRect(0, 0, canvas.width, canvas.height)

    if (canvas.width == 0) {
      return null
    }

    const [zoomX, zoomY] = this.zoom.value(effectStateData),
          [offsetX, offsetY] = this.offset.value(effectStateData)

    const scalingRatio = (this.img.height / canvas.height)

    let width = (this.img.width / scalingRatio) * zoomX,
        height = canvas.height * zoomY,
        tvX = (canvas.width / 2) - (width / 2) + offsetX,
        tvY = (canvas.height / 2) - (height / 2) + offsetY,
        subImageOffsetX = 0,
        subImageOffsetY = 0

    //subImageOffsetX = 0.5 * ((this.time % 3) - 1)
    subImageOffsetY = 0.5 * ((this.time % 3) - 1)

    const wDiv = this._holeSubCanvas.width / TVBackgroundEffect.HOLE_WIDTH

    const ratioX = (width) / this.img.naturalWidth,
          ratioY = (height) / this.img.naturalHeight,
          subImageRatioX = this._holeSubCanvas.width / this.img.naturalWidth,
          subImageRatioY = this._holeSubCanvas.height / this.img.naturalHeight,
          subImageWidthScaled = subImageRatioX * width,
          subImageHeightScaled = subImageRatioY * height
    
    const holeWidth = subImageWidthScaled,
          holeHeight = subImageHeightScaled,
          holeX = ((TVBackgroundEffect.HOLE_X / wDiv) * ratioX) + tvX,
          holeY = ((TVBackgroundEffect.HOLE_Y) * ratioY) + tvY

    this._tvSubContext.drawImage(this._holeSubCanvas, holeX + subImageOffsetX, holeY + subImageOffsetX, holeWidth, holeHeight)

    this._tvSubContext.filter = 'saturation(70%)'

    this._tvSubContext.drawImage(
      this.img,
      0, 0,
      this.img.naturalWidth, this.img.naturalHeight,
      tvX, tvY,
      width, height
    )

    this._tvSubContext.filter = 'saturation(100%)'
    
    this.time++

    return {
      position: [0, 0],
      size: [canvas.width, canvas.height],
      imageData: this._tvSubContext.getImageData(0, 0, canvas.width, canvas.height)
    }
  }
}