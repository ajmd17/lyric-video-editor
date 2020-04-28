class MergeModifierEffect extends VideoRenderEffect {
  /**
   * 
   * @param {VideoRenderEffect[]} effects
   * @param {BlendMode} blendMode
   * @param {VideoRenderEffect.EffectOrder} order 
   */
  constructor(effects, blendMode = BlendMode.NORMAL, order = VideoRenderEffect.EffectOrder.POST) {
    super(blendMode, order)

    this.effects = effects
  }

  renderFrame(canvas, context, effectStateData) {
    if (this.effects.length == 0) {
      return null
    }

    if (this.effects.length == 1) {
      return this.effects[0].render(canvas, context, effectStateData)
    }

    let prevResult = this.effects[0].render(canvas, context, effectStateData)

    for (let i = 1; i < this.effects.length; i++) {
      let nextResult = this.effects[i].render(canvas, context, effectStateData).clone()

      if (prevResult == null) {
        prevResult = nextResult
      } else {
        nextResult.applyToImageData(prevResult.resultData, canvas, {opacity: 1})
      }
    }

    prevResult.blendMode = this.blendMode

    return prevResult
  }
}