class VideoOverlayEffect extends ImageOverlayEffect {
  constructor(source, width, height, currentTime = new DynamicNumber(0), blendMode = BlendMode.NORMAL, order = VideoRenderEffect.EffectOrder.POST, options = { opacity: 1.0 }) {
    super(source, width, height, blendMode, order, options)

    this._currentTime = currentTime
  }

  renderFrame(canvas, context, effectStateData) {
    this.source.currentTime = this._currentTime.value(effectStateData)

    return super.renderFrame(canvas, context, effectStateData)
  }
}