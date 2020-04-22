const PIXELS_PER_SEC = 10,
  FRAMES_PER_SECOND = 20,
  VIDEO_RENDER_HEIGHT = 720,
  VIDEO_RENDER_WIDTH = 1080


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
      lineDecorators: {
        [Stanza.Type.CHORUS]: '♫'
      },
      keepFocusOnLine: false,
      keepFocusOnStanza: false
    }
  }

  // createAudioSourceFromVideo() {
  //   const videoElement = document.getElementById('main-video'),
  //     audioElement = document.createElement('audio'),
  //     audioContext = new AudioContext()
  
  //   audioElement.setAttribute('src', videoElement.getAttribute('src'))
  //   audioElement.setAttribute('controls', 'true')
  
  //   this._audioContainer.innerHTML = ''
  //   this._audioContainer.appendChild(audioElement)
    
  //   let sourceNode = audioContext.createMediaElementSource(audioElement)

  //   this._currentAudioManipulator = new AudioManipulator(audioContext, sourceNode)

  //   return sourceNode
  // }

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

    $element.find('select').on('change', (event) => {
      console.log('value = ', event.target.value)

      stanza.type = Stanza.Type[_.toUpper(event.target.value)]
    })

    $element.css({
      left: PIXELS_PER_SEC * stanza.offset
    })

    $element.find('.time-offset').click((event) => {
      event.preventDefault()

      this.skipVideoToTime(parseFloat($element.find('.time-offset').attr('data-seconds')))
    })

    $element.on('drag', () => {
      // const percentage = $element.position().left / $('#track-elements').width(),
      //   offset = this._totalDuration * percentage

      const offset = $element.position().left / PIXELS_PER_SEC

      stanza.offset = offset

      this._currentLyricsObject.updateStanzaDurations(this._totalDuration)

      $element.find('.time-offset')
        .attr('data-seconds', offset.toFixed(2))
        .html(getTimeHHMMSS(offset))

      this.update(this._currentTime, { force: true })

      this.storeState()
    })

    return $element
  }

  _createLineElement(line, stanza, index) {
    const $lineElement = $(`
      <div class="line" data-line-index="${index}">
        <div class="progress-container">
          <span class="time-elapsed"></span>
          <progress value="0" max="100"></progress>
        </div>
        <div class="content">
        ${_.truncate(line.originalLine, { length: 40 })}
        </div>
        <div class="arrow"></div>
      </div>
    `)

    $lineElement.offset({
      left: PIXELS_PER_SEC * (stanza.offset + line.offset)
    })

    $lineElement.on('drag', () => {
      //const percentage = (stanza.$element.position().left - $lineElement.position().left

      line.offset = (($lineElement.position().left) / PIXELS_PER_SEC) - (stanza.$element.position().left / PIXELS_PER_SEC)

      stanza.updateLineDurations()

      this.storeState()
    })

    return $lineElement
  }

  update(timeSeconds, options = { force: false }) {
    window.wavesurfer.seekTo(timeSeconds / this._totalDuration)
    const newStanza = this._currentLyricsObject.stanzaAtTime(timeSeconds)

    this._currentLyricsObject.stanzas.forEach((stanza) => {
      if (!_.isEmpty(stanza.$element)) {
        if (!stanza.$element.hasClass('ui-draggable-dragging')) {
          stanza.$element.offset({
            left: PIXELS_PER_SEC * stanza.offset
          })
        }

        stanza.lines.forEach((line) => {
          if (!_.isEmpty(line.$element)) {
            if (!line.$element.hasClass('ui-draggable-dragging')) {
              line.$element.offset({
                left: PIXELS_PER_SEC * (stanza.offset + line.offset)
              })
            }
          }
        })
      }
    })

    this._currentStanza = newStanza

    const currentLineIndex = this._currentStanza.lineIndexAtTime(timeSeconds)
    //const linesSorted = _.map(linesSortedIndices, ({ index }) => this._currentStanza.lines[index])

    const newLine = this._currentStanza.lines[currentLineIndex]

    if (newLine != this._currentLine || options.force) {
      this._lineOverlay.width(this._videoPreviewContent.width())
      this._lineOverlay.height(this._videoPreviewContent.height())

      const $line = $('<div class="line"></div>')

      if (newLine && !_.isEmpty(newLine.syllables)) {
        newLine.syllables.forEach((syllable, syllableIndex) => {
          const $syllable = $(`
            <span class="syllable" data-syllable-index="${syllableIndex}">
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
              offset = newLine.duration * percentage

            syllable.offset = offset

            newLine.updateSyllableDurations()

            this.storeState()
          })

          $line.append($syllable)
        })
      }
      
      this._lineOverlay.empty().append($line)

      this._currentLine = newLine
    }

    const syllablePercentagePairs = this._currentLine.syllablePercentagesAtTime(timeSeconds, this._currentStanza.offset)

    syllablePercentagePairs.forEach(([syllable, percentage], index) => {
      const $element = this._lineOverlay.find(`[data-syllable-index=${index}]`)

      $element.find('.negative').css('width', (percentage * 100) + '%')
    })
  }
  
  build() {
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

  renderVideo() {
    this.rendering = true

    // hardcoded for now
    const videoEffects = [
      new TVStaticEffect(),
      new BouncyBallEffect(),
      new AnimateModifierEffect(new BlendDeltaModifierEffect(new NoSignalEffect(), new TVStaticEffect(BlendMode.NORMAL), 0.2, 1.0, 0, 1.0), AnimateModifierEffect.EffectType.FADE_OUT, 1.0, 0.5),
      new TVBackgroundEffect()
    ]

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
      stateData = {
        timeSeconds: 0,
        totalDuration: this._totalDuration,
        lyrics: this._currentLyricsObject,
        currentBackgroundImage: null,
        currentStanza: null,
        currentLineIndex: 0,
        currentLine: null,
        syllablePercentages: [],
        syllablesGrouped: [],
        lyricSection: {
          syllablePositions: {}, // set during render of frame -- maps syllable to pixel position
          x: 0,
          y: this._renderingCanvas.height - 100 - 30,
          width: this._renderingCanvas.width,
          height: 100
        }
      }

      const updateStateData = () => {
        const videoPercentage = currentFrame / totalFrames

        stateData.lyrics = self._currentLyricsObject
        stateData.currentBackgroundImage = self._videoBackgroundImage[0]
        stateData.timeSeconds = videoPercentage * self._totalDuration
        stateData.currentStanza = self._currentLyricsObject.stanzaAtTime(stateData.timeSeconds)
        stateData.currentLineIndex = stateData.currentStanza.lineIndexAtTime(stateData.timeSeconds)
        stateData.currentLine = stateData.currentStanza.lines[stateData.currentLineIndex]
        stateData.syllablePercentages = stateData.currentLine.syllablePercentagesAtTime(stateData.timeSeconds, stateData.currentStanza.offset)
        stateData.syllablesGrouped = self._groupSyllables(stateData.syllablePercentages)
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
            self._renderVideoStatusLabel.html('Rendering on server ...')

            cvg.render(`lyrics_video_${Date.now()}`)

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

          cvg.addFrame(self._renderingCanvas)

          // const buffer = Math.floor(60 / FRAMES_PER_SECOND)

          // // re-add frame to fill 60 fps
          // if (buffer > 1) {
          //   for (let i = 0; i < buffer - 1; i++) {
          //     cvg.addFrame(self._renderingCanvas)
          //   }
          // }

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
      this._renderVideoStatusLabel.html(`Allowing some buffering time to pre-load assets (${waitTicksRemaining}s)`)

      waitTicksRemaining--

      if (waitTicksRemaining == 0) {
        clearInterval(waitInterval)

        setTimeout(() => {
          requestAnimationFrame(renderTick)
        }, 1000)
      }
    }, 1000)
  }

  _renderFrame(ctx, backgroundImagePlacement = null, stateData = {}) {
    const renderDashes = false

    if (backgroundImagePlacement != null) {
      ctx.drawImage(
        this._videoBackgroundImage[0],
        backgroundImagePlacement.x, backgroundImagePlacement.y,
        backgroundImagePlacement.widthScaled, backgroundImagePlacement.heightScaled
      )
    }

    let textOffset = 0,
        totalTextWidth = 0,
        textBackgroundPadding = 5,
        textPosition,
        textHeight = 32

    ctx.font = '32px "Postface"'

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      totalTextWidth += ctx.measureText(this._options.lineDecorators[stateData.currentStanza.type] + ' ').width
    }
    
    // calculate total text width 
    stateData.syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable], index) => {
        let part = syllable.syllable

        if (renderDashes && index < group.length - 1) {
          part += '-'
        }

        totalTextWidth += ctx.measureText(part).width
      })

      if (groupIndex != stateData.syllablesGrouped.length - 1) {
        totalTextWidth += ctx.measureText(' ').width
      }
    })

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      totalTextWidth += ctx.measureText(' ' + this._options.lineDecorators[stateData.currentStanza.type]).width
    }

    textPosition = (this._renderingCanvas.width / 2) - (totalTextWidth / 2)
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

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      ctx.fillText(this._options.lineDecorators[stateData.currentStanza.type] + ' ', textPosition, stateData.lyricSection.y + (stateData.lyricSection.height / 2))
      textOffset += ctx.measureText(this._options.lineDecorators[stateData.currentStanza.type] + ' ').width
    }

    stateData.syllablesGrouped.forEach((group, groupIndex) => {
      group.forEach(([syllable, percentage], index) => {
        let part = syllable.syllable

        if (renderDashes && index < group.length - 1) {
          part += '-'
        }

        if (percentage < 1.0 && percentage > 0.0) {
          // currently focused word
          ctx.fillStyle = '#eee'
        } else {
          ctx.fillStyle = '#fff'
        }
        ctx.textBaseline = "middle"

        let syllableX = textPosition + textOffset,
            syllableY =  stateData.lyricSection.y + (stateData.lyricSection.height / 2)

        ctx.fillText(part, syllableX, syllableY)

        stateData.lyricSection.syllablePositions[`${groupIndex}_${index}`] = [syllableX, syllableY]

        textOffset += ctx.measureText(part).width
      })

      if (groupIndex != stateData.syllablesGrouped.length - 1) {
        textOffset += ctx.measureText(' ').width
      }
    })

    ctx.fillStyle = '#fff'

    if (stateData.currentStanza.type in this._options.lineDecorators) {
      ctx.fillText(' ' + this._options.lineDecorators[stateData.currentStanza.type] + ' ', textPosition + textOffset, stateData.lyricSection.y + (stateData.lyricSection.height / 2))
      textOffset += ctx.measureText(' ' + this._options.lineDecorators[stateData.currentStanza.type]).width
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
      let stanza = new Stanza(null, stanzaJson.type, stanzaJson.duration, stanzaJson.offset)

      if (!_.isEmpty(stanzaJson.lines)) {
        stanzaJson.lines.forEach((lineJson) => {
          let line = new Line(lineJson.originalLine, lineJson.duration, lineJson.offset)

          line.syllables = []

          if (!_.isEmpty(lineJson.syllables)) {
            lineJson.syllables.forEach((syllableJson) => {
              line.syllables.push(new Syllable(syllableJson.syllable, syllableJson.originalWord, syllableJson.duration, syllableJson.offset))
            })
          }

          stanza.lines.push(line)
        })
      }

      this._currentLyricsObject.stanzas.push(stanza)

      _.tap(this._createStanzaElement(stanza, index), ($stanza) => {
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

      $('#track-elements')[0].scrollLeft = $('#track-elements').width() * scrollRatio
      $('#stanza-lines-overlay')[0].scrollLeft = $('#stanza-lines-overlay').width() * scrollRatio
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

    this._rendering = value
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
  lyricsBuilder._audioElement.on('timeupdate', () => {
    if (!lyricsBuilder.rendering) {
      lyricsBuilder.update(lyricsBuilder._currentTime)
    }
    // video.setAttribute('controls', 'controls')
  })

})

window.lyricsBuilder = new LyricsBuilder()
