class Renderer {
  constructor(options) {
    this._options = options
    this._rendering = false
  }

  set status(value) {
    if (typeof this._options.onStatusChange === 'function') {
      this._options.onStatusChange(value)
    }
  }

  get rendering() {
    return this._rendering
  }

  set rendering(value) {
    this._rendering = value
  }

  renderVideo() {
    this.rendering = true

    // hardcoded for now
    const videoEffects = [
      new TVStaticEffect({ speed: new DynamicNumber(20), opacity: new DynamicNumber(0.6) }),
      new BouncyBallEffect(),
      new AnimateModifierEffect(new BlendDeltaModifierEffect(new NoSignalEffect(), new TVStaticEffect({ speed: new DynamicNumber(30) }, BlendMode.NORMAL), 0.2, 1.0, 0, 4.0), AnimateModifierEffect.EffectType.FADE_OUT, 3.2, 0.8),
      new TVBackgroundEffect({
        zoom: new DynamicTuple(
          new Interpolation(1.0, 1.2, new Proc((effectStateData) => {
            return Math.min(1, effectStateData.timeSeconds / 2.0) // 1st 2 seconds
          }))
        ),
        offset: new DynamicTuple(
          new Interpolation(0, -30, new Proc((effectStateData) => {
            return Math.min(1, effectStateData.timeSeconds / 2.0) // 1st 2 seconds
          })),
          0
        )
      })
    ]

    this.status = 'Setting up ...'

    const renderedVideoHeight = VIDEO_RENDER_HEIGHT,
          renderedVideoWidth = VIDEO_RENDER_WIDTH,
          totalFrames = Math.ceil(this._totalDuration * FRAMES_PER_SECOND),
          ctx = this._renderingCanvas.getContext('gl') || this._renderingCanvas.getContext('2d')

    this._renderingCanvas.width = renderedVideoWidth
    this._renderingCanvas.height = renderedVideoHeight

    const backgroundImagePlacement = this._calculateBackgroundImagePlacement(renderedVideoWidth, renderedVideoHeight)

    ctx.drawImage(
      this._videoBackgroundImage[0],
      backgroundImagePlacement.x, backgroundImagePlacement.y,
      backgroundImagePlacement.widthScaled, backgroundImagePlacement.heightScaled
    )

    let self = this,
      currentFrame = 1030,
      frameCount = currentFrame + 1,
      stateData = new RenderState({
        totalDuration: this._totalDuration,
        lyrics: this._currentLyricsObject,
        lyricSection: new LyricSectionState(
          0,
          this._renderingCanvas.height - 100 - 30,
          this._renderingCanvas.width,
          100
        )
      })

      const updateStateData = () => {
        const videoPercentage = currentFrame / totalFrames

        stateData.lyrics = self._currentLyricsObject
        stateData.currentBackgroundImage = self._videoBackgroundImage[0]
        stateData.timeSeconds = videoPercentage * self._totalDuration
        stateData.currentStanza = self._currentLyricsObject.stanzaAtTime(stateData.timeSeconds)
        stateData.currentLineIndex = stateData.currentStanza != null
          ? stateData.currentStanza.lineIndexAtTime(stateData.timeSeconds)
          : -1
        stateData.currentLine = stateData.currentLineIndex != -1
          ? stateData.currentStanza.lines[stateData.currentLineIndex]
          : null
        stateData.syllablePercentages = stateData.currentLine != null
          ? stateData.currentLine.syllablePercentagesAtTime(stateData.timeSeconds, stateData.currentStanza.offset)
          : []
        stateData.syllablesGrouped = stateData.syllablePercentages.length != 0
          ? self._groupSyllables(stateData.syllablePercentages)
          : []

        const nextLineObject = self._getNextLine(
          stateData.currentLineIndex,
          stateData.currentStanza,
          stateData.timeSeconds
        )

        if (nextLineObject) {
          const { nextLine, nextLineIndex, nextStanza } = nextLineObject

          stateData.nextLine = nextLine
          stateData.nextLineIndex = nextLineIndex

          stateData.nextLineSyllablePercentages = stateData.nextLine.syllablePercentagesAtTime(nextStanza.getAbsoluteTimeOfLine(stateData.nextLine), nextStanza.offset)
          stateData.nextLineSyllablesGrouped = self._groupSyllables(stateData.nextLineSyllablePercentages)
        } else {
          stateData.nextLine = null
          stateData.nextLineIndex = -1
          stateData.nextLineSyllablePercentages = []
          stateData.nextLineSyllablesGrouped = []
        }
      }

      updateStateData()

      const renderEffect = (videoEffect) => {
        const result = videoEffect.render(self._renderingCanvas, ctx, stateData)

        if (result === null) {
          // do data returned, do not use
          return
        }

        const combinedData = ctx.getImageData(0, 0, self._renderingCanvas.width, self._renderingCanvas.height)

        result.applyToImageData(combinedData, self._renderingCanvas)

        ctx.putImageData(combinedData, 0, 0)
      }

      function renderTick() {
        frameCount++;

        updateStateData()

        try {
          if (frameCount >= totalFrames) {
            self.status = 'Rendering on server ...'

            cvg.render(`lyrics_video_${Date.now()}`, FRAMES_PER_SECOND)

            self.rendering = false

            return
          }

          self.status = `Rendering frame (${frameCount}/${totalFrames}) ...`

          ctx.fillStyle = 'black'
          ctx.fillRect(
            0, 0,
            self._renderingCanvas.width, self._renderingCanvas.height
          )

          _.filter(videoEffects, (effect) => effect.order == VideoRenderEffect.EffectOrder.PRE)
            .forEach(renderEffect)

          self._renderFrame(ctx, backgroundImagePlacement, stateData)

          _.filter(videoEffects, (effect) => effect.order == VideoRenderEffect.EffectOrder.POST)
            .forEach(renderEffect)

          cvg.addFrame(self._renderingCanvas)

          currentFrame = frameCount

          requestAnimationFrame(renderTick)
        } catch (err) {
          console.error(err)
          alert('Renderer error: ' + err.toString())

          self.rendering = false
        }
      }

    let waitInterval,
        waitTicksRemaining = 5

    waitInterval = setInterval(() => {
      this.status = `Allowing some buffering time to pre-load assets (${waitTicksRemaining}s)`

      waitTicksRemaining--

      if (waitTicksRemaining == 0) {
        clearInterval(waitInterval)

        setTimeout(() => {
          requestAnimationFrame(renderTick)
        }, 1000)
      }
    }, 1000)
  }

  _calcTextWidth(canvas, context, syllablesGrouped, stateData) {
    let totalTextWidth = 0

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      totalTextWidth += context.measureText(this._options.lineDecorators[stateData.currentStanza.type] + ' ').width
    }

    syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable, percentage], index) => {
        let part = syllable.syllable

        if (stateData.renderDashes && index < group.length - 1) {
          part += '-'
        }

        totalTextWidth += context.measureText(part).width
      })

      if (groupIndex != syllablesGrouped.length - 1) {
        totalTextWidth += context.measureText(' ').width
      }
    })

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      totalTextWidth += context.measureText(' ' + this._options.lineDecorators[stateData.currentStanza.type]).width
    }

    return totalTextWidth
  }

  _setTextPositions(canvas, context, syllablesGrouped, stateData, prefix = 'current') {
    let textOffset = 0,
        totalTextWidth = this._calcTextWidth(canvas, context, syllablesGrouped, stateData)

    let textPosition = (canvas.width / 2) - (totalTextWidth / 2)

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      totalTextWidth += context.measureText(this._options.lineDecorators[stateData.currentStanza.type] + ' ').width
    }

    syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable, percentage], index) => {
        let part = syllable.syllable

        if (stateData.renderDashes && index < group.length - 1) {
          part += '-'
        }

        let syllableX = textPosition + textOffset,
            syllableY =  stateData.lyricSection.y + (stateData.lyricSection.height / 2)

        stateData.lyricSection.setSyllablePosition(prefix, groupIndex, index, syllableX, syllableY)

        textOffset += context.measureText(part).width
      })

      if (groupIndex != syllablesGrouped.length - 1) {
        textOffset += context.measureText(' ').width
      }
    })

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      totalTextWidth += context.measureText(' ' + this._options.lineDecorators[stateData.currentStanza.type]).width
    }

    return {
      textOffset,
      totalTextWidth
    }
  }

  _renderFrame(ctx, backgroundImagePlacement = null, stateData = {}) {
    if (backgroundImagePlacement != null) {
      ctx.drawImage(
        this._videoBackgroundImage[0],
        backgroundImagePlacement.x, backgroundImagePlacement.y,
        backgroundImagePlacement.widthScaled, backgroundImagePlacement.heightScaled
      )
    }

    let textBackgroundPadding = 5,
        textHeight = 32

    ctx.font = '32px "Postface"'

    let { totalTextWidth, textPosition } = this._setTextPositions(this._renderingCanvas, ctx, stateData.syllablesGrouped, stateData, 'current')
    this._setTextPositions(this._renderingCanvas, ctx, stateData.nextLineSyllablesGrouped, stateData, 'next')

    stateData.lyricSection.x = textPosition - textBackgroundPadding
    stateData.lyricSection.width = totalTextWidth + (textBackgroundPadding * 2)
    stateData.lyricSection.height = textHeight + (textBackgroundPadding * 2)

    ctx.fillStyle = 'rgba(150, 150, 150, 0.7)'
    ctx.fillRect(
      stateData.lyricSection.x,
      stateData.lyricSection.y,
      stateData.lyricSection.width,
      stateData.lyricSection.height
    )

    ctx.fillStyle = '#fff'

    let positionsKey = 'current',
        syllablesGrouped = stateData.syllablesGrouped

    // transition to next line
    if (stateData.syllablePercentages.length != 0 && stateData.syllablePercentages[stateData.syllablePercentages.length - 1][1] >= 0.5) {
      syllablesGrouped = stateData.nextLineSyllablesGrouped
      positionsKey = 'next'
    }

    syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable, percentage], index) => {
        let part = syllable.syllable

        if (stateData.renderDashes && index < group.length - 1) {
          part += '-'
        }

        if (percentage < 1.0 && percentage > 0.0) {
          ctx.fillStyle = '#eee'
        } else {
          ctx.fillStyle = '#fff'
        }

        ctx.textBaseline = 'middle'

        let [syllableX, syllableY] = stateData.lyricSection.getSyllablePosition(positionsKey, groupIndex, index)

        ctx.fillText(part, syllableX, syllableY)
      })
    })

    ctx.fillStyle = '#fff'
  }
}