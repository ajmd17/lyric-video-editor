class BlendDeltaModifierEffect extends VideoRenderEffect {
  /**
   * 
   * @param {VideoRenderEffect} effect0
   * @param {VideoRenderEffect} effect1
   * @param {number} startBlend
   * @param {number} endBlend
   * @param {number} startTime
   * @param {number} duration
   * @param {VideoRenderEffect.EffectOrder} order 
   */
  constructor(effect0, effect1, startBlend, endBlend, startTime, duration, order = VideoRenderEffect.EffectOrder.POST) {
    super(BlendMode.NORMAL, order)

    this.effect0 = effect0
    this.effect1 = effect1
    this.startBlend = startBlend
    this.endBlend = endBlend
    this.blendModifier0 = new BlendModifierEffect(effect0, effect1, startBlend)
    this.blendModifier1 = new BlendModifierEffect(effect0, effect1, endBlend)
    this.animateModifier = new AnimateModifierEffect(this.blendModifier0, startTime, duration)
  }

  renderFrame(canvas, context, effectStateData) {
    let animEffectResult = this.animateModifier.render(canvas, context, effectStateData),
        targetEffectResult = this.blendModifier1.render(canvas, context, effectStateData)

    if (animEffectResult == null) {
      return null
    }

    animEffectResult.applyToImageData(targetEffectResult.resultData, canvas)
    animEffectResult.options.opacity = 1.0

    return targetEffectResult
  }
}