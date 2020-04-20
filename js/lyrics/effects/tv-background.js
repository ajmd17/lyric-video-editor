class TVBackgroundEffect extends VideoRenderEffect {
  static HOLE_WIDTH = 900
  static HOLE_HEIGHT = 700
  static HOLE_X = 450
  static HOLE_Y = 150

  constructor() {
    super(BlendMode.NORMAL, VideoRenderEffect.EffectOrder.POST)

    this.imageData = null

    this.img = document.createElement('img')
    this.img.src = 'images/tv_gr2.png'

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

    const scalingRatio = this.img.height / canvas.height

    let width = Math.floor(this.img.width / scalingRatio),
        height = Math.floor(canvas.height),
        tvX = Math.floor((canvas.width / 2) - (width / 2)),
        tvY = Math.floor((canvas.height / 2) - (height / 2))

    const wDiv = this._subCanvas.width / TVBackgroundEffect.HOLE_WIDTH

    const ratioX = width / this.img.naturalWidth,
          ratioY = height / this.img.naturalHeight,
          subImageRatioX = this._subCanvas.width / this.img.naturalWidth,
          subImageRatioY = this._subCanvas.height / this.img.naturalHeight,
          subImageWidthScaled = subImageRatioX * width,
          subImageHeightScaled = subImageRatioY * height
    
    const holeWidth = subImageWidthScaled,
          holeHeight = subImageHeightScaled,
          holeX = ((TVBackgroundEffect.HOLE_X / wDiv) * ratioX) + tvX,
          holeY = ((TVBackgroundEffect.HOLE_Y) * ratioY)


    context.drawImage(this._subCanvas, holeX, holeY, holeWidth, holeHeight)

    // const vignetteWidth = (TVBackgroundEffect.HOLE_WIDTH * subImageRatioX) / 2,
    //       vignetteHeight = (TVBackgroundEffect.HOLE_HEIGHT * subImageRatioY) / 2

		// var outerRadius = vignetteWidth * .5;
		// var innerRadius = vignetteHeight * .2;
    // var gradient = context.createRadialGradient(holeX / 2, holeY / 2, vignetteWidth, holeX / 2, holeY / 2, vignetteHeight);

    // // Add three color stops
    // gradient.addColorStop(0, 'pink');
    // gradient.addColorStop(.9, 'white');
    // gradient.addColorStop(1, 'green');

		// context.fillStyle = gradient;
		// context.fillRect(holeX, holeY, holeWidth, holeHeight)

    context.drawImage(
      this.img,
      0, 0,
      this.img.naturalWidth, this.img.naturalHeight,
      tvX, tvY,
      width, height
    )

    return null
  }
}