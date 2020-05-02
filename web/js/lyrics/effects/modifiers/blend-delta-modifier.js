class BlendDeltaModifierEffect extends VideoRenderEffect {
  /**
   * 
   * @param {VideoRenderEffect} effect0
   * @param {VideoRenderEffect} effect1
   * @param {number} startBlend
   * @param {number} endBlend
   * @param {number} startTime
   * @param {number} duration
   * @param {BlendMode} blendMode
   * @param {VideoRenderEffect.EffectOrder} order 
   */
  constructor(effect0, effect1, startBlend, endBlend, startTime, duration, blendMode = BlendMode.NORMAL, order = VideoRenderEffect.EffectOrder.POST) {
    super(blendMode, order)

    this.effect0 = effect0
    this.effect1 = effect1
    this.startBlend = startBlend
    this.endBlend = endBlend
    this.startTime = startTime
    this.duration = duration
    this.blendModifier0 = new BlendModifierEffect(effect0, effect1, startBlend)
    this.blendModifier1 = new BlendModifierEffect(effect0, effect1, endBlend)
    this.animateModifier = new AnimateModifierEffect(this.blendModifier0, AnimateModifierEffect.EffectType.FADE_OUT, startTime, duration)
  }

  renderFrame(canvas, context, effectStateData) {
    let animEffectResult = this.animateModifier.render(canvas, context, effectStateData)
    let targetEffectResult = this.blendModifier1.render(canvas, context, effectStateData).clone()

    if (animEffectResult) {
      animEffectResult.applyToImageData(targetEffectResult.resultData, canvas)
    }

    return new EffectResult(
      this.blendMode,
      targetEffectResult.resultData,
      targetEffectResult.offset,
      targetEffectResult.size,
      { opacity: this.options.opacity }
    )
  }
}