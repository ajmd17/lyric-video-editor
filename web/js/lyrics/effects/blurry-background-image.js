class BlurryBackgroundImageEffect extends VideoRenderEffect {
  constructor(grayscale = 0.5) {
    super(BlendMode.NORMAL, VideoRenderEffect.EffectOrder.PRE)

    this.grayscale = grayscale
  }

  get _filter() {
    let filter = 'blur(4px)'

    if (this.grayscale > 0.0) {
      filter += ` grayscale(${this.grayscale * 100}%)`
    }

    return filter
  }

  renderFrame(canvas, context, effectStateData) {
    const scalingRatio = effectStateData.currentBackgroundImage.width / canvas.width

    let width = Math.floor(canvas.width),
        height = Math.floor(effectStateData.currentBackgroundImage.height / scalingRatio)

    context.filter = this._filter
    context.drawImage(
      effectStateData.currentBackgroundImage,
      0, 0,
      effectStateData.currentBackgroundImage.naturalWidth, effectStateData.currentBackgroundImage.naturalHeight,
      0, Math.floor((canvas.height / 2) - (height / 2)),
      width, height
    )
    context.filter = 'blur(0px) grayscale(0%)'

    return {
      offset: [0, 0],
      size: [canvas.width, canvas.height],
      imageData: context.getImageData(0, 0, canvas.width, canvas.height)
    }
  }
}