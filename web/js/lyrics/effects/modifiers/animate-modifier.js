class AnimateModifierEffect extends VideoRenderEffect {
  static EffectType = {
    FADE_OUT: 0,
    FADE_IN: 1,
    STATIC_OVERLAY: 2
  }

  /**
   * 
   * @param {VideoRenderEffect} effect 
   * @param {AnimateModifierEffect.EffectType} effectType
   * @param {number} timeStart 
   * @param {number} duration 
   * @param {BlendMode} blendMode 
   * @param {VideoRenderEffect.EffectOrder} order 
   */
  constructor(effect, effectType, timeStart, duration, blendMode = effect.blendMode, order = VideoRenderEffect.EffectOrder.POST) {
    super(blendMode, order)

    this.effect = effect
    this.effectType = effectType
    this.timeStart = timeStart
    this.duration = duration
    this.imageData = null
  }

  _fadeOut(canvas, context, effectStateData) {
    if (effectStateData.timeSeconds < this.timeStart) {
      return this.effect.render(canvas, context, effectStateData)
    }

    if (effectStateData.timeSeconds > this.timeStart + this.duration) {
      return null
    }

    const percentage = (effectStateData.timeSeconds - this.timeStart) / this.duration,
          opacity = 1 - Math.pow(percentage, 2)

    let effectResult = this.effect.render(canvas, context, effectStateData)

    if (effectResult === null) {
      return null
    }

    return new EffectResult(
      this.blendMode,
      effectResult.resultData,
      effectResult.offset,
      effectResult.size,
      { opacity: effectResult.options.opacity * opacity }
    )
  }

  _fadeIn(canvas, context, effectStateData) {
    if (effectStateData.timeSeconds < this.timeStart) {
      return null
    }

    if (effectStateData.timeSeconds > this.timeStart + this.duration) {
      return this.effect.render(canvas, context, effectStateData)
    }

    const percentage = (effectStateData.timeSeconds - this.timeStart) / this.duration,
          opacity = 1 - Math.pow(1 - percentage, 2)

    let effectResult = this.effect.render(canvas, context, effectStateData)

    if (effectResult === null) {
      return null
    }

    return new EffectResult(
      this.blendMode,
      effectResult.resultData,
      effectResult.offset,
      effectResult.size,
      { opacity: effectResult.options.opacity * opacity }
    )
  }

  _staticOverlay(canvas, context, effectStateData) {
    if (effectStateData.timeSeconds < this.timeStart) {
      return null
    }

    if (effectStateData.timeSeconds > this.timeStart + this.duration) {
      return null
    }

    return this.effect.render(canvas, context, effectStateData)
  }

  renderFrame(canvas, context, effectStateData) {
    switch (this.effectType) {
      case AnimateModifierEffect.EffectType.FADE_OUT:
        return this._fadeOut(canvas, context, effectStateData)
      case AnimateModifierEffect.EffectType.FADE_IN:
        return this._fadeIn(canvas, context, effectStateData)
      case AnimateModifierEffect.EffectType.STATIC_OVERLAY:
        return this._staticOverlay(canvas, context, effectStateData)
    }

    return null
  }
}