const PIXELS_PER_SEC = 10,
  FRAMES_PER_SECOND = 30

class Lyrics {
  constructor(lyrics) {
    this.originalLyrics = lyrics

    /** @type {Stanza[]} */
    this.stanzas = this._buildStanzas()
  }

  stanzaAtTime(timeSeconds) {
    // update current overlay on screen
    const stanzasSorted = _.sortBy(
      _.filter(
        this.stanzas,
        (stanza) => timeSeconds >= stanza.offset 
      ),
      'offset'
    )

    return _.last(stanzasSorted)
  }

  updateStanzaDurations(videoDuration) {
    _.sortBy(_.map(this.stanzas, (stanza, index) => ({ stanza, index })), 'stanza.offset').forEach(({ stanza, index }) => {
      let stanzaDuration

      if (index == this.stanzas.length - 1) {
        stanzaDuration = videoDuration - stanza.offset
      } else {
        stanzaDuration = this.stanzas[index + 1].offset - stanza.offset
      }

      stanza.duration = stanzaDuration

      stanza.updateLineDurations()
    })
  }

  _buildStanzas() {
    return _.filter(this.originalLyrics.split(/(?:\r?\n|\u00a0|\u000a)\s*(?:\r?\n|\u00a0|\u000a)/g), (str) => !_.isEmpty(str))
      .map((stanza) => new Stanza(stanza))
  }

  toJSON() {
    return {
      stanzas: this.stanzas.map((stanza) => stanza.toJSON())
    }
  }
}

class Stanza {
  constructor(stanza, duration = 0, offset = 0) {
    this.originalStanza = stanza
    this.duration = duration
    this.offset = offset
    this.$element = null

    if (_.isEmpty(stanza)) {
      this.lines = []
    } else {
      /** @type {Line} */
      this.lines = this._buildLines()
    }
  }

  lineIndexAtTime(timeSeconds) {
    const linesSortedIndices = _.sortBy(
      _.filter(
        this.lines.map((line, index) => ({ time: this.getAbsoluteTimeOfLine(line), index })),
        ({ time }) => timeSeconds >= time 
      ),
      'time'
    )

    return _.isEmpty(linesSortedIndices) ? -1 : _.last(linesSortedIndices).index
  }

  updateLineDurations() {
    // setup line durations
    this.lines.forEach((line, lineIndex) => {
      if (lineIndex == this.lines.length - 1) {
        line.duration = this.duration - line.offset
      } else {
        line.duration = this.lines[lineIndex + 1].offset - line.offset
      }

      line.updateSyllableDurations()
    })
  }

  /** @param {Line} line */
  getAbsoluteTimeOfLine(line) {
    return this.offset + line.offset
  }

  _buildLines() {
    return this.originalStanza.split(/(?:\r?\n|\u00a0|\u000a)/g).map((line) => new Line(line))
  }

  toJSON() {
    return {
      offset: parseFloat(this.offset.toFixed(2)),
      duration: parseFloat(this.duration.toFixed(2)),
      lines: this.lines.map((line) => line.toJSON())
    }
  }
}

class Line {
  constructor(line, duration = 0, offset = 0) {
    this.originalLine = line
    this.duration = duration
    this.offset = offset
    this.$element = null

    /** @type {string[]} */
    this.syllables = this._buildSyllables()
  }

  syllablePercentagesAtTime(timeSeconds, stanzaOffset) {
    const syllablesSortedIndices = _.sortBy(
      _.filter(
        this.syllables.map((syllable, index) => ({ time: this.getAbsoluteTimeOfSyllable(syllable), index })),
        ({ time }) => timeSeconds >= time 
      ),
      'time'
    )

    const syllablesSorted = _.map(syllablesSortedIndices, ({ index }) => this.syllables[index])

    // [[syllable, percentage], ...]

    // update syllable progress
    return syllablesSorted.map((syllable) => {
      const relativeTime = Math.min(timeSeconds - (stanzaOffset + this.offset + syllable.offset), syllable.duration),
        progressValue = (relativeTime / syllable.duration)

      return [syllable, progressValue]
    })
  }

  updateSyllableDurations() {
    this.syllables.forEach((syllable, syllableIndex) => {
      if (syllableIndex == this.syllables.length - 1) {
        syllable.duration = this.duration - syllable.offset
      } else {
        syllable.duration = this.syllables[syllableIndex + 1].offset - syllable.offset
      }
    })
  }

  /** @param {Syllable} syllable */
  getAbsoluteTimeOfSyllable(syllable) {
    return this.offset + syllable.offset
  }

  _buildSyllables() {
    return _.map(_.flatten(syllables(this.originalLine)), (syllable) => new Syllable(syllable))
  }

  toJSON() {
    return {
      offset: parseFloat(this.offset.toFixed(2)),
      duration: parseFloat(this.duration.toFixed(2)),
      originalLine: this.originalLine,
      syllables: this.syllables
    }
  }
}

class Syllable {
  constructor(syllable, duration = 0, offset = 0) {
    this.syllable = syllable
    this.duration = duration
    this.offset = offset
  }

  toJSON() {
    return {
      offset: parseFloat(this.offset.toFixed(2)),
      duration: parseFloat(this.duration.toFixed(2)),
      syllable: this.syllable
    }
  }
}

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

  isolateVocals() {
    let filterLowPass = this._audioContext.createBiquadFilter(),
        filterHighPass = this._audioContext.createBiquadFilter(),
        mix = this._audioContext.createGain(),
        mix2 = this._audioContext.createGain()

    this._sourceNode.connect(filterLowPass)

    filterLowPass.type = 'lowpass'
    filterLowPass.frequency.value = 120

    this._sourceNode.connect(filterHighPass)

    filterHighPass.type = 'highpass'
    filterHighPass.frequency.value = 120

    this._sourceNode.connect(mix2)

    mix2.connect(this._audioContext.destination)

    mix.gain.value = 1
    mix2.gain.value = 0

    this._processor = this._audioContext.createScriptProcessor(2048, 2, 1)

    filterHighPass.connect(this._processor)
    filterLowPass.connect(mix)
    this._processor.connect(mix)
    mix.connect(this._audioContext.destination)

    let lastTime = null

    this._processor.onaudioprocess = function channelPhaseFlip(event) {
      const leftChannel = event.inputBuffer.getChannelData(0),
            rightChannel = event.inputBuffer.getChannelData(1),
            outputChannel = event.outputBuffer.getChannelData(0)


      for (let i = 0; i < leftChannel.length; i++) {
        let removed = leftChannel[i] - rightChannel[i]
        
        let mono = (leftChannel[i] + rightChannel[i]) / 2
        const now = Date.now()

        let ampMono = Math.abs(mono),
          ampRemoved = Math.abs(removed)

        if (ampMono - ampRemoved >= 0.8) {
          //console.log(ampMono - ampRemoved)

          if (lastTime == null || (now - lastTime >= 400/*ms*/)) {
            console.log('newsection', now - lastTime)
          }

          lastTime = now
        }

        outputChannel[i] = mono
        
        // outputChannel[i] = mono - removed
      }
    }
  }
}

class LyricsBuilder {
  constructor() {
    this._currentLyricsObject = null
    this._currentStanza = null
    this._currentLine = null
    this._currentAudioManipulator = null
    this._options = {
      keepFocusOnLine: false,
      keepFocusOnStanza: false
    }
  }

  createAudioSourceFromVideo() {
    const videoElement = document.getElementById('main-video'),
      audioElement = document.createElement('audio'),
      audioContext = new AudioContext()
  
    audioElement.setAttribute('src', videoElement.getAttribute('src'))
    audioElement.setAttribute('controls', 'true')
  
    this._audioContainer.innerHTML = ''
    this._audioContainer.appendChild(audioElement)
    
    let sourceNode = audioContext.createMediaElementSource(audioElement)

    this._currentAudioManipulator = new AudioManipulator(audioContext, sourceNode)

    return sourceNode
  }

  skipVideoToTime(timeSeconds) {
    document.getElementById('main-video').currentTime = Math.floor(timeSeconds)
  }

  skipVideoToOffset(offset) {
    this._mainVideoElement[0].pause()

    this._lineOverlay.empty()
    this._stanzaLinesOverlay.empty()

    this._currentStanza = null
    this._currentLine = null

    this.skipVideoToTime(offset)

    this._mainVideoElement[0].play()
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
        </div>
      </div>
    `)

    // $element.offset({
    //   top: this._mainVideoElement.position().top + this._mainVideoElement.height(),
    //   left: this._mainVideoElement.position().left + (this._mainVideoElement.width() * percentage)
    // })

    $element.css({
      //'margin-left': this._mainVideoElement.position().top + this._mainVideoElement.height(),
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

    // const percentage = line.offset / stanza.duration

    // $lineElement.offset({
    //   top: this._mainVideoElement.position().top + this._mainVideoElement.height() - 150,
    //   left: this._mainVideoElement.position().left + (this._mainVideoElement.width() * percentage)
    // })

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
      this._lineOverlay.width(this._mainVideoElement.width())
      this._lineOverlay.height(this._mainVideoElement.height())

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
            const percentage = $syllable.position().left / this._mainVideoElement.width(),
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

  renderVideo() {
    this._renderVideoStatusLabel.html('Begin render ...')

    const totalFrames = 1000//Math.ceil(this._totalDuration * FRAMES_PER_SECOND)

    let self = this,
      frameCount = 0,
      currentFrame = 0

    function renderTick() {
      frameCount++;

      if (frameCount == totalFrames) {
        self._renderVideoStatusLabel.html('Rendering on server ...')

        cvg.render(`lyrics_video_${Date.now()}`)

        return
      }


      self._renderVideoStatusLabel.html(`Rendering frame (${frameCount}/${totalFrames}) ...`)

      self._renderFrame(currentFrame)

      cvg.addFrame(self._renderingCanvas)

      currentFrame = frameCount

      requestAnimationFrame(renderTick)
    }

    requestAnimationFrame(renderTick)
  }

  _renderFrame(frameIndex) {
    const ctx = this._renderingCanvas.getContext('2d'),
      totalFrames = this._totalDuration * FRAMES_PER_SECOND,
      secondOffset = (frameIndex / totalFrames) * this._totalDuration,
      frameStanza = this._currentLyricsObject.stanzaAtTime(secondOffset),
      frameLineIndex = frameStanza.lineIndexAtTime(secondOffset),
      frameLine = frameStanza.lines[frameLineIndex],
      frameSyllablePercentages = frameLine.syllablePercentagesAtTime(secondOffset, frameStanza.offset)

    
    // testing
    ctx.font = '48px serif'
    ctx.fillText(frameSyllablePercentages.map((s) => s[0]).join(' '), 10, 50)
  }

  _initialize() {
    this._reset()

    this._controlsOverlay.width(this._mainVideoElement.width())
    this._controlsOverlay.height(this._mainVideoElement.height())

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
    const mainVideoElement = document.getElementById('main-video'),
      $mainVideoElement = $(mainVideoElement),
      trackElements = document.getElementById('track-elements')

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
      let stanza = new Stanza(null, stanzaJson.duration, stanzaJson.offset)

      if (!_.isEmpty(stanzaJson.lines)) {
        stanzaJson.lines.forEach((lineJson) => {
          let line = new Line(lineJson.originalLine, lineJson.duration, lineJson.offset)

          line.syllables = []

          if (!_.isEmpty(lineJson.syllables)) {
            lineJson.syllables.forEach((syllableJson) => {
              line.syllables.push(new Syllable(syllableJson.syllable, syllableJson.duration, syllableJson.offset))
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
      // hideScrollbar: true,
      loopSelection: false
    })

    window.wavesurfer.load($('video')[0].src)
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
    this._trackElements.remove()
    this._renderVideoStatusLabel.html('')

    this._lineOverlay.empty()
    this._stanzaLinesOverlay.empty()
    this._audioContainer.innerHTML = ''
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
    return this._mainVideoElement[0].currentTime
  }

  get _totalDuration() {
    return this._mainVideoElement[0].duration
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
  const video = document.getElementById('main-video')

  video.addEventListener('timeupdate', () => {
    lyricsBuilder.update(video.currentTime)
    // video.setAttribute('controls', 'controls')
  })

})

window.lyricsBuilder = new LyricsBuilder()
