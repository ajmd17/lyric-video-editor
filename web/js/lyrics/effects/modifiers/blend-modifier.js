class BlendModifierEffect extends VideoRenderEffect {
  /**
   * 
   * @param {VideoRenderEffect} effect0
   * @param {VideoRenderEffect} effect1 
   * @param {number} blend
   * @param {VideoRenderEffect.EffectOrder} order 
   */
  constructor(effect0, effect1, blend = 0.5, order = VideoRenderEffect.EffectOrder.POST) {
    super(BlendMode.NORMAL, order)

    this.effect0 = effect0
    this.effect1 = effect1
    this.blend = blend
    this.imageData = null
  }

  renderFrame(canvas, context, effectStateData) {
    if (this.blend <= 0.01) {
      return this.effect0.render(canvas, context, effectStateData)
    }

    let effectResult1 = this.effect1.render(canvas, context, effectStateData).clone()

    if (this.blend >= 0.99) {
      return effectResult1
    }

    let effectResult0 = this.effect0.render(canvas, context, effectStateData).clone()

    effectResult0.applyToImageData(effectResult1.resultData, canvas, { opacity: 1.0 - this.blend })

    return effectResult1
  }
}