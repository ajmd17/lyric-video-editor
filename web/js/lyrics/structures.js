
class Lyrics {
  constructor(lyrics) {
    this.originalLyrics = lyrics

    /** @type {Stanza[]} */
    this.stanzas = this._buildStanzas()
  }

  stanzaIndexAtTime(timeSeconds) {
    const indicesSorted = _.sortBy(
      _.filter(
        this.stanzas.map((stanza, index) => ({ time: stanza.offset, index })),
        ({ time }) => timeSeconds != null ? (timeSeconds >= time) : true
      ),
      'time'
    )

    return _.isEmpty(indicesSorted) ? -1 : _.last(indicesSorted).index
  }

  stanzaAtTime(timeSeconds) {
    return this.stanzas[this.stanzaIndexAtTime(timeSeconds)]
  }

  updateStanzaDurations(videoDuration) {
    _.sortBy(this.stanzas, 'offset').forEach((stanza, index) => {
      console.log(index, stanza)
      let stanzaDuration

      if (index == this.stanzas.length - 1) {
        stanzaDuration = videoDuration - stanza.offset
      } else {
        stanzaDuration = this.stanzas[index + 1].offset - stanza.offset
      }

      stanza.duration = stanzaDuration

      if (stanza.$element) {
        stanza.$element.find('.time-offset')
          .attr('data-seconds', stanza.offset.toFixed(2))
          .html(getTimeHHMMSS(stanza.offset))

        stanza.$element.find('.time-duration')
          .attr('data-seconds', (stanza.offset + stanza.duration).toFixed(2))
          .html(getTimeHHMMSS(stanza.offset + stanza.duration))
      }

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
  static Type = {
    UNSET: 0,
    VERSE: 1,
    CHORUS: 2,
    BRIDGE: 3,
    CONTEXTUAL: 10
  }

  constructor(stanza, type = Stanza.Type.UNSET, duration = 0, offset = 0) {
    this.type = type
    this.originalStanza = stanza
    this.duration = _.isNumber(duration) ? Math.max(0, duration) : 0
    this.offset = _.isNumber(offset) ? Math.max(0, offset) : 0
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
        ({ time }) => timeSeconds != null ? (timeSeconds >= time) : true
      ),
      'time'
    )

    return _.isEmpty(linesSortedIndices) ? -1 : _.last(linesSortedIndices).index
  }

  updateLineDurations() {
    // setup line durations
    this.lines.forEach((line, lineIndex) => {
      line.offset = Math.min(line.offset, this.duration)

      if (lineIndex == this.lines.length - 1) {
        line.duration = this.duration - line.offset
      } else {
        line.duration = this.lines[lineIndex + 1].offset - line.offset
      }

      if (line.$element) {
        const lineOffset = this.getAbsoluteTimeOfLine(line)

        line.$element.find('.time-offset')
          .attr('data-seconds', lineOffset.toFixed(2))
          .html(getTimeHHMMSS(lineOffset))

          line.$element.find('.time-duration')
          .attr('data-seconds', (lineOffset + line.duration).toFixed(2))
          .html(getTimeHHMMSS(lineOffset + line.duration))
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
      type: this.type,
      offset: parseFloat(this.offset.toFixed(2)),
      duration: parseFloat(this.duration.toFixed(2)),
      lines: this.lines.map((line) => line.toJSON())
    }
  }
}

Object.keys(Stanza.Type).forEach((typeKey) => {
  Stanza.Type[Stanza.Type[typeKey]] = typeKey

  Object.defineProperty(Stanza.prototype, _.camelCase(`IS_${typeKey}`), {
    get: function () {
      return this.type === Stanza.Type[typeKey]
    }
  })
})

class Line {
  constructor(line, duration = 0, offset = 0) {
    this.originalLine = line
    this.duration = _.isNumber(duration) ? Math.max(0, duration) : 0
    this.offset = _.isNumber(offset) ? Math.max(0, offset) : 0
    this.$element = null

    /** @type {string[]} */
    this.syllables = this._buildSyllables()
  }

  get isBlankLine() {
    return _.isEmpty(this.syllables)
  }

  setContent(line) {
    this.originalLine = line
    this.syllables = this._buildSyllables()
  }

  syllablePercentagesAtTime(timeSeconds, stanzaOffset) {
    const syllablesSortedIndices = _.sortBy(
      this.syllables.map((syllable, index) => {
        return {
          time: stanzaOffset + this.offset + (syllable.offset), index 
        }
      }),
      'time'
    )

    // update syllable progress
    return syllablesSortedIndices.map(({ time, index }) => {
      const syllable = this.syllables[index],
            relativeTime = Math.min(timeSeconds - time, syllable.duration),
            progressValue = relativeTime / syllable.duration

      return [syllable, progressValue]
    })
  }

  updateSyllableDurations() {
    // sum up all (current) syllable durations
    // if it flows over the amount of time allotted to this line,
    // we have to reduce the duration of each line to the point that sum should == duration
    /*const sum = Math.max(0, _.sumBy(this.syllables, 'duration'))

    if (!isNaN(sum) && sum > this.duration) { // overflowing. need to reduce offsets for the recalculation.
      const quotient = sum / this.duration

      _.forEach(this.syllables, (syllable) => syllable.offset /= quotient)
    }

    this.syllables.forEach((syllable, syllableIndex) => {
      if (syllableIndex == this.syllables.length - 1) {
        syllable.duration = Math.max(0, this.duration - syllable.offset)
      } else {
        syllable.duration = this.syllables[syllableIndex + 1].offset - syllable.offset
      }
    })*/

    this.syllables.forEach((syllable, syllableIndex) => {
      syllable.duration = this.duration / this.syllables.length
      syllable.offset = syllableIndex * syllable.duration
    })

    // console.log('sum = ', sum)
    // console.log('duration = ', this.duration)

    // if (sum > this.duration) {
    //   this.syllables.forEach((syllable, syllableIndex) => {
    //     syllable.offset /= (sum / this.duration)
    //     syllable.duration /= (sum / this.duration)
    //   })
    // }
  }

  /** @param {Syllable} syllable */
  getAbsoluteTimeOfSyllable(syllable) {
    return this.offset + syllable.offset
  }

  _buildSyllables() {
    return _.flatten(_.map(syllables(this.originalLine), (s) => {
      if (_.isString(s)) {
        return new Syllable(s, s)
      }

      const wholeWord = s.join('')

      return s.map(syllable => new Syllable(syllable, wholeWord))
    }))
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
  constructor(syllable, originalWord, duration = 0, offset = 0) {
    this.syllable = syllable
    this.originalWord = originalWord
    this.duration = _.isNumber(duration) ? Math.max(0, duration) : 0
    this.offset = _.isNumber(offset) ? Math.max(0, offset) : 0
  }

  get stringValue() {
    return String(this.syllable).toUpperCase()
  }

  toJSON() {
    return {
      originalWord: this.originalWord,
      offset: parseFloat(this.offset.toFixed(2)),
      duration: parseFloat(this.duration.toFixed(2)),
      syllable: this.syllable
    }
  }
}