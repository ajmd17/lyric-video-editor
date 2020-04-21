class AnimateModifierEffect extends VideoRenderEffect {
  /**
   * 
   * @param {VideoRenderEffect} effect 
   * @param {number} timeStart 
   * @param {number} duration 
   * @param {VideoRenderEffect.EffectOrder} order 
   */
  constructor(effect, timeStart = 0, duration = 3, order = VideoRenderEffect.EffectOrder.POST) {
    super(BlendMode.NORMAL, order)

    this.effect = effect
    this.timeStart = timeStart
    this.duration = duration
    this.imageData = null
  }

  renderFrame(canvas, context, effectStateData) {
    if (effectStateData.timeSeconds - this.timeStart <= this.duration) {
      const percentage = (effectStateData.timeSeconds - this.timeStart) / this.duration,
            opacity = Math.pow(1 / percentage, 2)
      
      let effectResult = this.effect.render(canvas, context, effectStateData)

      if (effectResult === null) {
        return null
      }

      effectResult.options.opacity *= opacity

      return effectResult
    }

    return null
  }
}