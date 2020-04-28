class MergeModifierEffect extends VideoRenderEffect {
  /**
   * 
   * @param {VideoRenderEffect} effect0
   * @param {VideoRenderEffect} effect1
   * @param {VideoRenderEffect.EffectOrder} order 
   */
  constructor(effect0, effect1, order = VideoRenderEffect.EffectOrder.POST) {
    super(BlendMode.NORMAL, order)

    this.effect0 = effect0
    this.effect1 = effect1
    this.imageData = null
  }

  renderFrame(canvas, context, effectStateData) {
    let effectResult0 = this.effect0.render(canvas, context, effectStateData).clone()
    let effectResult1 = this.effect1.render(canvas, context, effectStateData).clone()

    effectResult0.applyToImageData(effectResult1.resultData, canvas)

    return effectResult1
  }
}