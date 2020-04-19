
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
        ({ time }) => timeSeconds != null ? (timeSeconds >= time) : true
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
    return _.flatten(_.map(syllables(this.originalLine), (syllables) => {
      const wholeWord = syllables.join('')

      return syllables.map(syllable => new Syllable(syllable, wholeWord))
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
    this.duration = duration
    this.offset = offset
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