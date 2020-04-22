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
    this.startTime = startTime
    this.duration = duration
    this.blendModifier0 = new BlendModifierEffect(effect0, effect1, startBlend)
    this.blendModifier1 = new BlendModifierEffect(effect0, effect1, endBlend)
    this.animateModifier = new AnimateModifierEffect(this.blendModifier0, AnimateModifierEffect.EffectType.FADE_OUT, startTime, duration)
  }

  renderFrame(canvas, context, effectStateData) {

    let animEffectResult = this.animateModifier.render(canvas, context, effectStateData)
    let targetEffectResult = this.blendModifier1.render(canvas, context, effectStateData).clone()

    // console.log('b1 = ', targetEffectResult.options.opacity)
    // if (effectStateData.timeSeconds < this.startTime) {
    //   return this.blendModifier0.render(canvas, context, effectStateData)
    // }

    // if (effectStateData.timeSeconds > this.startTime + this.duration) {
    //   return targetEffectResult
    // }

    //return animEffectResult
    if (animEffectResult != null) {
      animEffectResult.applyToImageData(targetEffectResult.resultData, canvas)
    }

    return targetEffectResult
  }
}