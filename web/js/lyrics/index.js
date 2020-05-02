const PIXELS_PER_SEC = 50,
  FRAMES_PER_SECOND = 20,
  VIDEO_RENDER_HEIGHT = 720,
  VIDEO_RENDER_WIDTH = 1080,
  LYRIC_FONT = '22px "VCR"'


class AudioManipulator {
  /**
   * @param {AudioContext} audioContext
   * @param {MediaElementAudioSourceNode} sourceNode
   * */
  constructor(audioContext, sourceNode) {
    this._audioContext = audioContext
    this._sourceNode = sourceNode
    this._processor = null
  }
}

class LyricsBuilder {
  constructor() {
    this._currentLyricsObject = null
    this._currentStanza = null
    this._currentLine = null
    this._currentAudioManipulator = null
    this._rendering = false
    this._videoFrames = []
    this._options = {
      renderDashes: false,
      lineDecorators: {
        [Stanza.Type.CHORUS]: '♫'
      }
    }
  }

  skipVideoToTime(timeSeconds) {
    this._audioElement[0].currentTime = Math.floor(timeSeconds)
  }

  skipVideoToOffset(offset) {
    this._audioElement[0].pause()

    this._lineOverlay.empty()
    this._stanzaLinesOverlay.empty()

    this._currentStanza = null
    this._currentLine = null

    this.skipVideoToTime(offset)

    this._audioElement[0].play()
  }

  _createStanzaElement(stanza, index) {
    const percentage = stanza.offset / this._totalDuration
    const previewText = _.isEmpty(stanza.lines[0]) ? '' : stanza.lines[0].originalLine

    const $element = $(`
      <div class="track-element" data-stanza-index="${index}">
        <div class="arrow">
        </div>
        <div class="content">
          <a href="#" class="time-offset" data-seconds="${stanza.offset.toFixed(2)}">${getTimeHHMMSS(stanza.offset)}</a>
          -
          <a href="#" class="time-duration" data-seconds="${(stanza.offset + stanza.duration).toFixed(2)}">${getTimeHHMMSS(stanza.offset + stanza.duration)}</a>
          <span class="label">${_.truncate(previewText, { length: 20 })}</span>
          <select>
            <option disabled>
              Section
            </option>
            <option disabled>
              -----
            </option>
            ${Object.keys(Stanza.Type).map((typeKey) => {
              return `
                <option value="${typeKey}">
                  ${_.capitalize(typeKey)}
                </option>
              `
            })}
          </select>
        </div>
      </div>
    `)

    $element.find('select')
      .val(Stanza.Type[stanza.type])
      .on('change', (event) => {
        stanza.type = Stanza.Type[_.toUpper(event.target.value)]

        this.storeState()
      })

    $element.css({
      left: PIXELS_PER_SEC * stanza.offset
    })

    $element.find('.time-offset, .time-duration').click((event) => {
      event.preventDefault()

      this.skipVideoToTime(parseFloat($(event.target).attr('data-seconds')))
    })

    $element.on('drag', () => {
      const offset = ($element[0].offsetLeft - document.getElementById('track-elements').offsetLeft) / PIXELS_PER_SEC

      stanza.offset = offset

      this._currentLyricsObject.updateStanzaDurations(this._totalDuration)

      this.update(this._currentTime, { force: true })

      this.storeState()
    })

    return $element
  }

  _createLineElement(line, stanza, index) {
    const lineOffset = stanza.getAbsoluteTimeOfLine(line)

    const $lineElement = $(`
      <div class="line" data-line-index="${index}">
        <a href="#" class="time-offset" data-seconds="${lineOffset.toFixed(2)}">${getTimeHHMMSS(lineOffset)}</a>
        -
        <a href="#" class="time-duration" data-seconds="${(lineOffset + line.duration).toFixed(2)}">${getTimeHHMMSS(lineOffset + line.duration)}</a>
        <div class="progress-container">
          <span class="time-elapsed"></span>
          <progress value="0" max="100"></progress>
        </div>
        <div class="content">
          ${_.truncate(line.originalLine, { length: 40 })}
        </div>
        <a href="#" class="edit-link">Edit</a>&nbsp;
        <a href="#" class="delete-link">Delete</a>
        <div class="arrow"></div>
      </div>
    `)

    $lineElement.css({
      left: PIXELS_PER_SEC * (stanza.offset + line.offset)
    })

    $lineElement.find('.time-offset, .time-duration').click((event) => {
      event.preventDefault()

      this.skipVideoToTime(parseFloat($(event.target).attr('data-seconds')))
    })

    $lineElement.find('.delete-link').click((event) => {
      event.preventDefault()

      if (confirm('Are you sure you want to delete this line?')) {
        const lineIndex = stanza.lines.indexOf(line)

        if (lineIndex !== -1) {
          stanza.lines.splice(lineIndex, 1)
        }

        stanza.updateLineDurations()

        this.storeState()

        $lineElement.remove()
      }
    })

    $lineElement.find('.edit-link').click((event) => {
      event.preventDefault()

      const previousContent = $lineElement.find('.content').html(),
            $editContent = $(`
              <textarea class="line-value">${line.originalLine.trim()}</textarea>
              <hr/>
              <button class='cancel-btn'>Cancel</button>
              <button class='ok-btn'>OK</button>
            `)

      $lineElement.find('.content').html($editContent)

      $lineElement.find('.content .ok-btn').click(() => {
        const newLineContent = $lineElement.find('.content .line-value').val()

        line.setContent(newLineContent)

        $lineElement.find('.content').html(_.truncate(newLineContent, { length: 40 }))

        line.updateSyllableDurations()

        this.storeState()
      })

      $lineElement.find('.content .cancel-btn').click(() => {
        $lineElement.find('.content').html(previousContent)
      })
    })

    $lineElement.on('drag', () => {
      line.offset = (($lineElement[0].offsetLeft - this._stanzaLinesOverlay[0].offsetLeft) / PIXELS_PER_SEC) - stanza.offset

      stanza.updateLineDurations()
      this.storeState()
    })

    return $lineElement
  }

  _createSyllableElement(syllable, line, index) {
    const $syllable = $(`
      <span class="syllable" data-syllable-index="${index}">
        <div class="positive">
          <span>${syllable.syllable}</span>
        </div>
        <div class="negative">
          <span>${syllable.syllable}</span>
        </div>
      </span>
    `)

    $syllable.draggable({
      axis: 'x',
      containment: 'parent'
    })

    $syllable.on('drag', (event) => {
      const percentage = $syllable.position().left / this._videoPreviewContent.width(),
            offset = line.duration * percentage

      syllable.offset = offset

      line.updateSyllableDurations()

      this.storeState()
    })

    return $syllable
  }

  update(timeSeconds, options = { force: false }) {
    window.wavesurfer.seekTo(timeSeconds / this._totalDuration)

    if (!this._markersContainer.attr('scrolled')) {
      //this._markersContainer[0].scrollLeft = timeSeconds * PIXELS_PER_SEC
      $('#wavesurfer > wave')[0].scrollLeft = timeSeconds * PIXELS_PER_SEC
    }

    const newStanza = this._currentLyricsObject.stanzaAtTime(timeSeconds)

    this._currentLyricsObject.stanzas.forEach((stanza, stanzaIndex) => {
      if (!_.isEmpty(stanza.$element)) {
        if (!stanza.$element.hasClass('ui-draggable-dragging')) {
          stanza.$element.css({
            left: PIXELS_PER_SEC * stanza.offset
          })
        }

        stanza.lines.forEach((line) => {
          if (!_.isEmpty(line.$element)) {
            if (!line.$element.hasClass('ui-draggable-dragging')) {
              line.$element.css({
                left: PIXELS_PER_SEC * (stanza.offset + line.offset)
              })
            }
          }
        })
      }
    })

    this._currentStanza = newStanza

    if (this._currentStanza == null) {
      this._currentLine = null

      return
    }

    const currentLineIndex = this._currentStanza.lineIndexAtTime(timeSeconds)
    const newLine = this._currentStanza.lines[currentLineIndex]

    if (newLine != this._currentLine || options.force) {
      this._lineOverlay.width(this._videoPreviewContent.width())
      this._lineOverlay.height(this._videoPreviewContent.height())

      const $line = $('<div class="line"></div>')

      if (newLine && !_.isEmpty(newLine.syllables)) {
        newLine.syllables.forEach((syllable, syllableIndex) => {
          $line.append(this._createSyllableElement(syllable, newLine, syllableIndex))
        })
      }
      
      this._lineOverlay.empty().append($line)

      this._currentLine = newLine
    }

    if (this._currentLine != null) {
      const syllablePercentagePairs = this._currentLine.syllablePercentagesAtTime(timeSeconds, this._currentStanza.offset)

      syllablePercentagePairs.forEach(([syllable, percentage], index) => {
        const $element = this._lineOverlay.find(`[data-syllable-index=${index}]`)

        $element.find('.negative').css('width', (percentage * 100) + '%')
      })
    }
  }
  
  autoGeneratePlacements() {
    this._initialize()
    this._buildDefaultConfiguration()
  }

  loadFromSave() {
    this._initialize()
    this._loadState()
  }

  _calculateBackgroundImagePlacement(canvasWidth, canvasHeight) {
    const imageWidth = this._videoBackgroundImage.width(),
          imageHeight = this._videoBackgroundImage.height()

    // amount we have to scale by : we want image height to be same as canvas height
    const scaleRatio = imageHeight / canvasHeight,
      imageWidthScaled = imageWidth * scaleRatio,
      imageHeightScaled = imageHeight * scaleRatio

    return {
      x: Math.floor((canvasWidth / 2) - (imageWidthScaled / 2)),
      y: 0,
      widthScaled: Math.floor(imageWidthScaled),
      heightScaled: Math.floor(imageHeightScaled)
    }
  }

  _getCurrentLine(timeSeconds) {
    const currentStanza = this._currentLyricsObject.stanzaAtTime(timeSeconds)
    const currentLineIndex = currentStanza != null
        ? currentStanza.lineIndexAtTime(timeSeconds)
        : -1
    const currentLine = currentLineIndex != -1
        ? currentStanza.lines[currentLineIndex]
        : null

    return {
      currentStanza,
      currentLineIndex,
      currentLine
    }
  }

  _getNextLine(currentLineIndex, currentStanza, timeSeconds) {
    let nextLineIndex = -1,
        nextLine = null,
        stanzaIndex = this._currentLyricsObject.stanzaIndexAtTime(timeSeconds),
        nextStanza = currentStanza

    if (currentStanza == null) {
      nextStanza = this._currentLyricsObject.stanzas[0]

      if (nextStanza != null && !_.isEmpty(nextStanza.lines)) {
        nextLineIndex = 0
      }
    } else if (currentLineIndex >= currentStanza.lines.length - 1) {
      if (stanzaIndex === -1) {
        throw Error('stanza not in lyrics object')
      }

      if (stanzaIndex >= this._currentLyricsObject.stanzas.length - 1) {
        return null // out of bounds
      } else {
        nextStanza = this._currentLyricsObject.stanzas[stanzaIndex + 1]
      }

      nextLineIndex = 0
    } else {
      nextLineIndex = currentLineIndex + 1
    }

    nextLine = nextStanza.lines[nextLineIndex]

    // if (nextLine != null && nextStanza != null && nextLineIndex !== -1 &&
    //     nextLine.isBlankLine && this.options.skipBlankLinesInCursor) {
    //   return this._getNextLine(nextLineIndex, nextStanza, nextStanza.getAbsoluteTimeOfLine(nextLine))
    // }

    return {
      nextLine,
      nextLineIndex,
      nextStanza
    }
  }

  renderVideo(videoEffects = []) {
    this.rendering = true

    this._renderVideoStatusLabel.html('Setting up ...')

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
      currentFrame = 0,
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

      const currentLineObject = self._getCurrentLine(stateData.timeSeconds)

      if (currentLineObject.currentLineIndex !== -1) {
        stateData.currentLine = currentLineObject.currentLine
        stateData.currentLineIndex = currentLineObject.currentLineIndex
      }

      stateData.currentStanza = currentLineObject.currentStanza

      // stateData.currentStanza = self._currentLyricsObject.stanzaAtTime(stateData.timeSeconds)
      // stateData.currentLineIndex = stateData.currentStanza != null
      //   ? stateData.currentStanza.lineIndexAtTime(stateData.timeSeconds)
      //   : -1
      // stateData.currentLine = stateData.currentLineIndex != -1
      //   ? stateData.currentStanza.lines[stateData.currentLineIndex]
      //   : null
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

        stateData.nextLineStanza = nextStanza
        stateData.nextLine = nextLine
        stateData.nextLineIndex = nextLineIndex

        stateData.nextLineSyllablePercentages = stateData.nextLine != null
          ? stateData.nextLine.syllablePercentagesAtTime(nextStanza.getAbsoluteTimeOfLine(stateData.nextLine), nextStanza.offset)
          : []
        stateData.nextLineSyllablesGrouped = self._groupSyllables(stateData.nextLineSyllablePercentages)
      } else {
        stateData.nextLineStanza = null
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
        // no data returned, do not use
        return
      }

      const combinedData = ctx.getImageData(0, 0, self._renderingCanvas.width, self._renderingCanvas.height)

      result.applyToImageData(combinedData, self._renderingCanvas)

      ctx.putImageData(combinedData, 0, 0)
    }

    function renderTick(uuid) {
      frameCount++;

      updateStateData()

      try {
        if (frameCount >= totalFrames) {
          self._renderVideoStatusLabel.html('Rendering on server ...')

          cvg.render(uuid, `lyrics_video_${Date.now()}`, FRAMES_PER_SECOND)

          self.rendering = false

          return
        }

        self._renderVideoStatusLabel.html(`Rendering frame (${frameCount}/${totalFrames}) ...`)

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

        cvg.addFrame(self._renderingCanvas, uuid)

        currentFrame = frameCount

        requestAnimationFrame(() => renderTick(uuid))
      } catch (err) {
        console.error(err)
        alert('Renderer error: ' + err.toString())

        self.rendering = false
      }
    }

    let waitInterval,
        waitTicksRemaining = 5

    waitInterval = setInterval(() => {
      ctx.font = LYRIC_FONT
      ctx.fillText('Waiting...', 50, 50)

      this._renderVideoStatusLabel.html(`Allowing some buffering time to pre-load assets (${waitTicksRemaining}s)`)

      waitTicksRemaining--

      if (waitTicksRemaining == 0) {
        clearInterval(waitInterval)

        cvg.begin().then((uuid) => {
          requestAnimationFrame(() => renderTick(uuid))
        })
      }
    }, 1000)
  }

  _calcTextWidth(context, syllablesGrouped, stanza) {
    let totalTextWidth = 0

    if (stanza.type in this.options.lineDecorators) {
      totalTextWidth += context.measureText(this.options.lineDecorators[stanza.type] + ' ').width
    }

    syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable, percentage], index) => {
        let part = syllable.stringValue

        if (this.options.renderDashes && index < group.length - 1) {
          part += '-'
        }

        totalTextWidth += context.measureText(part).width
      })

      if (groupIndex != syllablesGrouped.length - 1) {
        totalTextWidth += context.measureText(' ').width
      }
    })

    if (stanza.type in this.options.lineDecorators) {
      totalTextWidth += context.measureText(' ' + this.options.lineDecorators[stanza.type]).width
    }

    return totalTextWidth
  }

  _setTextPositions(canvas, context, syllablesGrouped, stanza, stateData, prefix = 'current') {
    let textOffset = 0,
        totalTextWidth = this._calcTextWidth(context, syllablesGrouped, stanza)

    let textPosition = (canvas.width / 2) - (totalTextWidth / 2)

    if (stanza.type in this.options.lineDecorators) {
      let syllableX = textPosition + textOffset,
          syllableY = stateData.lyricSection.y + (stateData.lyricSection.height / 2)
      
      textOffset += context.measureText(this.options.lineDecorators[stanza.type] + ' ').width

      stateData.lyricSection.setSyllablePosition(prefix, 'dec', 0, syllableX, syllableY)
    }

    syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable, percentage], index) => {
        let part = syllable.stringValue

        if (this.options.renderDashes && index < group.length - 1) {
          part += '-'
        }

        let syllableX = textPosition + textOffset,
            syllableY = stateData.lyricSection.y + (stateData.lyricSection.height / 2)

        stateData.lyricSection.setSyllablePosition(prefix, groupIndex, index, syllableX, syllableY)

        textOffset += context.measureText(part).width
      })

      if (groupIndex != syllablesGrouped.length - 1) {
        textOffset += context.measureText(' ').width
      }
    })

    if (stanza.type in this.options.lineDecorators) {
      let syllableX = textPosition + textOffset,
          syllableY = stateData.lyricSection.y + (stateData.lyricSection.height / 2)

      textOffset += context.measureText(' ' + this.options.lineDecorators[stanza.type]).width

      stateData.lyricSection.setSyllablePosition(prefix, 'dec', 1, syllableX, syllableY)
    }

    return {
      textOffset,
      totalTextWidth
    }
  }

  _renderFrame(ctx, backgroundImagePlacement, stateData) {    
    ctx.font = LYRIC_FONT

    if (backgroundImagePlacement != null) {
      ctx.drawImage(
        this._videoBackgroundImage[0],
        backgroundImagePlacement.x, backgroundImagePlacement.y,
        backgroundImagePlacement.widthScaled, backgroundImagePlacement.heightScaled
      )
    }

    const textBackgroundPadding = 5,
          textHeight = 40,
          textProperties = {} // text properties keyed by state (current/next)

    stateData.lyricSection.height = textHeight + (textBackgroundPadding * 2)

    let positionsKey = 'current',
        stanza = stateData.currentStanza,
        syllablesGrouped,
        preTransitionPercentage = 0

    if (stateData.currentLine != null) {
      textProperties['current'] = this._setTextPositions(
        this._renderingCanvas,
        ctx,
        stateData.syllablesGrouped,
        stateData.currentStanza,
        stateData,
        'current'
      )


      syllablesGrouped = stateData.syllablesGrouped
      preTransitionPercentage = stateData.syllablePercentages.length != 0
        ? stateData.syllablePercentages[stateData.syllablePercentages.length - 1][1]
        : 0
    }

    if (stateData.nextLine != null) {
      textProperties['next'] = this._setTextPositions(
        this._renderingCanvas,
        ctx,
        stateData.nextLineSyllablesGrouped,
        stateData.nextLineStanza,
        stateData,
        'next'
      )

      // first real line
      if (stateData.currentLine === null || (stateData.currentLine.isBlankLine || stateData.currentStanza.isContextual)) {
        const transitionLength = 0.5,
              nextLineStart = stateData.nextLineStanza.getAbsoluteTimeOfLine(stateData.nextLine)
        console.log('nextLine : ', stateData.nextLine)
        preTransitionPercentage = Math.max(0, stateData.timeSeconds - (nextLineStart - transitionLength)) / transitionLength
      }
    }

    // transition to next line
    if (preTransitionPercentage >= 0.5) {
      stanza = stateData.nextLineStanza
      syllablesGrouped = stateData.nextLineSyllablesGrouped
      positionsKey = 'next'

      if (!stateData.nextLine || stateData.nextLine.isBlankLine) {
        return
      }
    } else {
      if (!stateData.currentLine || stateData.currentLine.isBlankLine) {
        return
      }
    }

    stateData.lyricSection.width = textProperties[positionsKey].textOffset + (textBackgroundPadding * 2)
    stateData.lyricSection.x = (this._renderingCanvas.width / 2) - (stateData.lyricSection.width / 2)

    ctx.fillStyle = '#1700FF'
    ctx.fillRect(
      stateData.lyricSection.x,
      stateData.lyricSection.y,
      stateData.lyricSection.width,
      stateData.lyricSection.height
    )

    ctx.fillStyle = '#fff'

    // console.log('currentline = ', stateData.currentLine)
    // console.log('currentstanza = ', stateData.currentStanza)
    // console.log('syllablesGrouped = ', syllablesGrouped)
    // console.log('preTransitionPercentage = ', preTransitionPercentage)

    if (stanza.type in this.options.lineDecorators) {
      let [syllableX, syllableY] = stateData.lyricSection.getSyllablePosition(positionsKey, 'dec', 0)
      ctx.fillText(this.options.lineDecorators[stanza.type] + ' ', syllableX, syllableY)
    }

    syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable, percentage], index) => {
        let part = syllable.stringValue

        if (this.options.renderDashes && index < group.length - 1) {
          part += '-'
        }

        ctx.textBaseline = 'middle'

        let [syllableX, syllableY] = stateData.lyricSection.getSyllablePosition(positionsKey, groupIndex, index)

        ctx.fillText(part, syllableX, syllableY)
      })
    })

    if (stanza.type in this.options.lineDecorators) {
      let [syllableX, syllableY] = stateData.lyricSection.getSyllablePosition(positionsKey, 'dec', 1)
      ctx.fillText(' ' + this.options.lineDecorators[stanza.type], syllableX, syllableY)
    }
  }

  _groupSyllables(frameSyllablePercentages) {
    let syllablesGrouped = []

    for (let i = 0; i < frameSyllablePercentages.length;) {
      let originalObject = frameSyllablePercentages[i]

      syllablesGrouped.push([originalObject])

      i++

      let j = i

      while (j < frameSyllablePercentages.length && frameSyllablePercentages[j][0].originalWord == originalObject[0].originalWord) {
        syllablesGrouped[syllablesGrouped.length - 1].push(frameSyllablePercentages[j])

        j++, i++
      }
    }

    return syllablesGrouped
  }

  _initialize() {
    this._reset()

    this._controlsOverlay.width(this._videoPreviewContent.width())
    this._controlsOverlay.height(this._videoPreviewContent.height())

    $('#prev-stanza').click(() => {
      const newStanza = this._currentLyricsObject.stanzas[Math.max(this._currentStanzaIndex - 1, 0)]

      this.skipVideoToOffset(newStanza.offset)
    })

    $('#prev-line').click(() => {
      const currentLineIndex = this._currentStanza.lines.indexOf(this._currentLine)
      let newLine,
        offset

      if (currentLineIndex == 0) {
        let newStanzaIndex = Math.max(this._currentStanzaIndex - 1, 0),
          newStanza = this._currentLyricsObject.stanzas[newStanzaIndex]
        
        if (this._currentStanzaIndex == newStanzaIndex) {
          newLine = newStanza.lines[0] // go to start of current stanza
        } else {
          newLine = newStanza.lines[newStanza.lines.length - 1]
        }

        offset = newStanza.offset + newLine.offset
      } else {
        newLine = this._currentStanza.lines[currentLineIndex - 1]

        offset = this._currentStanza.offset + newLine.offset
      }

      this.skipVideoToOffset(offset)
    })

    $('#next-line').click(() => {
      const currentLineIndex = this._currentStanza.lines.indexOf(this._currentLine)
      let newLine,
        offset

      if (currentLineIndex == this._currentStanza.lines.length - 1) {
        let newStanza = this._currentLyricsObject.stanzas[Math.min(this._currentStanzaIndex + 1, this._currentLyricsObject.stanzas.length - 1)]

        newLine = newStanza.lines[0]

        offset = newStanza.offset + newLine.offset
      } else {
        newLine = this._currentStanza.lines[currentLineIndex + 1]

        offset = this._currentStanza.offset + newLine.offset
      }

      this.skipVideoToOffset(offset)
    })

    $('#next-stanza').click(() => {
      const newStanza = this._currentLyricsObject.stanzas[Math.min(this._currentStanzaIndex + 1, this._currentLyricsObject.stanzas.length - 1)]

      this.skipVideoToOffset(newStanza.offset)
    })

    const lyricsContent = document.getElementById('lyrics-content')
  
    this._currentLyricsObject = new Lyrics(lyricsContent.innerHTML)

    $('#markers-container').children().width(PIXELS_PER_SEC * this._totalDuration)
    $('#markers-container').bind('contextmenu', (event) => {
      event.stopPropagation()

      $('#markers-context-menu')
        .css({
          left: event.pageX,
          top: event.pageY
        })
        .show()

      return false
    })

    $('#markers-context-menu')
      .find('.create-stanza')
      .click((event) => {
        const xRelative = event.pageX - $('#markers-container').offset().left + $('#markers-container')[0].scrollLeft
        const timeAtClick = xRelative / PIXELS_PER_SEC
        const stanza = new Stanza('', Stanza.Type.UNSET, null, timeAtClick)
        const stanzaIndex = this._currentLyricsObject.stanzaIndexAtTime(timeAtClick) + 1

        this._currentLyricsObject.stanzas.splice(stanzaIndex, 0, stanza)
        this._currentLyricsObject.updateStanzaDurations(this._totalDuration)
  
        _.tap(this._createStanzaElement(stanza, stanzaIndex), ($stanza) => {
          stanza.$element = $stanza
          $('#track-elements').append($stanza)
  
          $stanza.draggable({ axis: 'x', containment: 'parent' })
        })
      })

    $('#markers-context-menu')
      .find('.create-line')
      .click((event) => {
        const xRelative = event.pageX - $('#markers-container').offset().left + $('#markers-container')[0].scrollLeft
        const timeAtClick = xRelative / PIXELS_PER_SEC

        const stanzaAtTime = this._currentLyricsObject.stanzaAtTime(timeAtClick)

        if (stanzaAtTime == null) {
          console.error(`Could not create line at time (${timeAtClick} seconds) because there was no stanza associated with this time`)

          return
        }

        let lineIndex = stanzaAtTime.lineIndexAtTime(timeAtClick),
            newLine = new Line('', null, timeAtClick - stanzaAtTime.offset)

        if (lineIndex === -1) {
          lineIndex = 0
          stanzaAtTime.lines.push(newLine)
        } else {
          lineIndex += 1
          stanzaAtTime.lines.splice(lineIndex, 0, newLine)
        }

        stanzaAtTime.updateLineDurations()

        console.log(`Create line at time ${timeAtClick}`)
        console.log(stanzaAtTime.lines)

        // create element for line
        const $lineElement = this._createLineElement(newLine, stanzaAtTime, lineIndex)
        newLine.$element = $lineElement

        this._stanzaLinesOverlay.append($lineElement)

        $lineElement.draggable({
          axis: 'x',
          containment: 'parent'
        })

        this.storeState()
      })

    this._initializeWaveSurfer()
  }

  _buildDefaultConfiguration() {
    const trackElements = document.getElementById('track-elements')

    this._currentLyricsObject.stanzas.forEach((stanza, index) => {
      const percentage = index / this._currentLyricsObject.stanzas.length
      const timeSeconds = percentage * this._totalDuration

      stanza.offset = timeSeconds

      const $element = this._createStanzaElement(stanza, index)

      stanza.$element = $element

      $(trackElements).append($element)

      $element.draggable({
        axis: 'x',
        containment: 'parent'
      })

    })

    // setup stanza durations
    this._currentLyricsObject.updateStanzaDurations(this._totalDuration)

    // setup initial positions for lines
    this._currentLyricsObject.stanzas.forEach((stanza) => {
      stanza.lines.forEach((line, lineIndex) => {
        line.offset = (lineIndex / stanza.lines.length) * stanza.duration

        // create element for line
        const $lineElement = this._createLineElement(line, stanza, lineIndex)
        line.$element = $lineElement

        this._stanzaLinesOverlay.append($lineElement)

        $lineElement.draggable({
          axis: 'x',
          containment: 'parent'
        })
      })

      stanza.updateLineDurations()

      // setup initial positions of syllables
      stanza.lines.forEach((line, lineIndex) => {
        line.syllables.forEach((syllable, syllableIndex) => {
          syllable.offset = (syllableIndex / line.syllables.length) * line.duration
        })

        line.updateSyllableDurations()
      })
    })

    this.storeState()
  }

  storeState() {
    const outputJsonElement = document.getElementById('output-json')

    if (outputJsonElement) {
      outputJsonElement.innerHTML = JSON.stringify(this._currentLyricsObject.toJSON(), null, '  ').replace('\n', '<br>')
    }

    localStorage.setItem('lyric-video-save', JSON.stringify(this._currentLyricsObject.toJSON()))
  }

  _loadState() {
    let json = localStorage.getItem('lyric-video-save'),
      jsonObj

    if (!json) {
      return
    }

    try {
      jsonObj = JSON.parse(json)
    } catch (err) {
      throw Error('Failed to parse JSON from saved state. Corrupted.')
    }

    this._currentLyricsObject.stanzas = []

    jsonObj.stanzas.forEach((stanzaJson, index) => {
      let stanza = new Stanza(null, stanzaJson.type, stanzaJson.duration || 0, stanzaJson.offset || 0)

      if (!_.isEmpty(stanzaJson.lines)) {
        stanzaJson.lines.forEach((lineJson, lineIndex) => {
          let line = new Line(lineJson.originalLine, lineJson.duration || 0, lineJson.offset || 0)

          line.syllables = []

          if (!_.isEmpty(lineJson.syllables)) {
            lineJson.syllables.forEach((syllableJson) => {
              line.syllables.push(new Syllable(syllableJson.syllable, syllableJson.originalWord, syllableJson.duration || 0, syllableJson.offset || 0))
            })
          }

          stanza.lines.push(line)

          // create element for line

          _.tap(this._createLineElement(line, stanza, lineIndex), ($line) => {
            line.$element = $line
            this._stanzaLinesOverlay.append($line)

            $line.draggable({ axis: 'x', containment: 'parent' })
          })
        })
      }

      this._currentLyricsObject.stanzas.push(stanza)

      _.tap(this._createStanzaElement(stanza, index), ($stanza) => {
        stanza.$element = $stanza
        $('#track-elements').append($stanza)

        $stanza.draggable({ axis: 'x', containment: 'parent' })
      })
    })
  }

  _initializeWaveSurfer() {
    window.wavesurfer = WaveSurfer.create({
      container: document.querySelector('#wavesurfer'),
      backend: 'MediaElement',
      fillParent: true,
      interact: false,
      pixelRatio: 1,
      loopSelection: false
    })

    window.wavesurfer.load(this._audioElement[0].src)
    window.wavesurfer.zoom(PIXELS_PER_SEC)
    window.wavesurfer.on('scroll', (event) => {
      let scrollRatio = event.target.scrollLeft / $(event.target).width()

      $('#markers-container')[0].scrollLeft = $('#markers-container').width() * scrollRatio //(PIXELS_PER_SEC * this._totalDuration) * scrollRatio

      if (event.originalEvent !== undefined) {
        $('#markers-container').attr('scrolled', 'scrolled')
      }

      // $('#track-elements')[0].scrollLeft = $('#track-elements').width() * scrollRatio
      // $('#stanza-lines-overlay')[0].scrollLeft = $('#stanza-lines-overlay').width() * scrollRatio
    })
  }

  _reset() {
    this._currentLyricsObject = null
    this._currentStanza = null
    this._currentLine = null
    this._currentAudioManipulator = null
    this.rendering = false
    this._videoFrames = []
    this._trackElements.remove()
    this._renderVideoStatusLabel.html('')

    this._lineOverlay.empty()
    this._stanzaLinesOverlay.empty()
    this._audioContainer.innerHTML = ''
  }
  
  get options() {
    return this._options
  }

  get rendering() {
    return this._rendering
  }

  set rendering(value) {
    if (value) {
      this._loadSavedButton.attr('disabled', 'disabled')
      this._generateLyricsButton.attr('disabled', 'disabled')
    } else {
      this._loadSavedButton.removeAttr('disabled')
      this._generateLyricsButton.removeAttr('disabled')

      this._renderVideoStatusLabel.html('Client idle')
    }

    // clear temporary elements used for rendering process (sub canvas, video elements, etc)
    $('#render-buffer-items').html('')

    this._rendering = value
  }

  get _markersContainer() {
    return $('#markers-container')
  }

  get _videoBackgroundImage() {
    return $('#video-background-image')
  }

  get _videoPreviewContent() {
    return $('#video-preview-content')
  }

  get _audioElement() {
    return $('#audio-element')
  }

  get _loadSavedButton() {
    return $('#load-saved-btn')
  }

  get _generateLyricsButton() {
    return $('#generate-lyrics-btn')
  }

  get _renderVideoStatusLabel() {
    return $('#render-video-status-label')
  }

  /** @returns {HTMLCanvasElement} */
  get _renderingCanvas() {
    return $('#rendering-canvas')[0]
  }

  get _currentStanzaIndex() {
    return this._currentLyricsObject.stanzas.indexOf(this._currentStanza)
  }

  get _currentTime() {
    return this._audioElement[0].currentTime
  }

  get _totalDuration() {
    return this._audioElement[0].duration
  }

  get _mainVideoElement() {
    return $('#main-video')
  }

  get _trackElements() {
    return $('#track-elements').children('.track-element')
  }

  get _controlsOverlay() {
    return $('#controls-overlay')
  }

  get _lineOverlay() {
    return $('#line-overlay')
  }

  get _stanzaLinesOverlay() {
    return $('#stanza-lines-overlay')
  }

  get _audioContainer() {
    return document.getElementById('audio-container')
  }
}

function getTimeHHMMSS(timeSeconds) {
  let hours = Math.floor(timeSeconds / 3600)
  let minutes = Math.floor((timeSeconds - (hours * 3600)) / 60)
  let seconds = Math.floor(timeSeconds - (hours * 3600) - (minutes * 60))

  if (hours < 10) {
    hours = '0' + hours
  }

  if (minutes < 10) {
    minutes = '0' + minutes
  }

  if (seconds < 10) {
    seconds = '0' + seconds
  }

  return minutes + ':' + seconds
}
$(function () {
  $('body').click(function () {
    $('#markers-context-menu').hide()
  })

  lyricsBuilder._audioElement.on('timeupdate', () => {
    if (!lyricsBuilder.rendering) {
      lyricsBuilder.update(lyricsBuilder._currentTime)
    }
  })

  lyricsBuilder._audioElement.on('play', () => {
    lyricsBuilder._markersContainer.removeAttr('scrolled')
  })

})

window.lyricsBuilder = new LyricsBuilder()
