
// interface - EffectStateData
/**
 * { timeSeconds: number, currentLine: Line, currentStanza: Stanza, currentSyllable: Syllable }
 */

function lerp(v0, v1, t) {
  return v0 * (1 - t) + v1 * t
}

const BlendMode = {
  NO_OP: -1,
  NORMAL: 0,
  ADDITIVE: 1,
  SUBTRACTIVE: 2
}

const blendCombineFunc = {
  [BlendMode.NO_OP]: (lhs, rhs, index) => {},
  [BlendMode.NORMAL]: (lhs, rhs, index) => {
    for (let i = 0; i < 4; i++) {
      lhs[i + index] = rhs[i + index]
    }
  },
  [BlendMode.ADDITIVE]: (lhs, rhs, index) => {
    for (let i = 0; i < 3; i++) {
      lhs[i + index] += rhs[i + index]
    }
  },
  [BlendMode.SUBTRACTIVE]: (lhs, rhs, index) => {
    for (let i = 0; i < 4; i++) {
      lhs[i + index] -= rhs[i + index]
    }
  }
}

class EffectResult {
  constructor(blendMode, resultData, options) {
    this.blendMode = blendMode
    this.resultData = resultData
    this.options = options
  }

  combine(imageData) {
    if (imageData.data.length != this.resultData.data.length) {
      throw Error('Cannot blend effect result; ImageData sizes differ ('
        + imageData.data.length + ' != ' + this.resultData.data.length + ')')
    }

    const opacity = _.isNumber(this.options.opacity)
      ? this.options.opacity
      : 1.0

    for (let i = 0; i < imageData.data.length; i += 4) {
      let prevValues = [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]]

      blendCombineFunc[this.blendMode](imageData.data, this.resultData.data, i)

      if (opacity < 1.0) {
        imageData.data[i]     = lerp(prevValues[0], imageData.data[i], opacity)
        imageData.data[i + 1] = lerp(prevValues[1], imageData.data[i + 1], opacity)
        imageData.data[i + 2] = lerp(prevValues[2], imageData.data[i + 2], opacity)
        imageData.data[i + 3] = lerp(prevValues[3], imageData.data[i + 3], opacity)
      }
    }
  }
}

class VideoRenderEffect {
  constructor(blendMode, options = { opacity: 1.0 }) {
    this.blendMode = blendMode
    this.options = options
  }

  renderFrame(canvas, context, effectStateData) {
    throw Error('not implemented')
  }

  render(canvas, context, effectStateData) {
    return new EffectResult(this.blendMode, this.renderFrame(canvas, context, effectStateData), this.options)
  }
}

class LineTransitionEffect extends VideoRenderEffect {
  static EFFECT_BEGIN_OFFSET = 0.15
  static EFFECT_END_OFFSET = 0.15

  constructor(blendMode, options) {
    super(blendMode, options)
  }

  _renderTransition(canvas, context, transitionPhase) {
    throw Error('not implemented')
  }

  renderFrame(canvas, context, effectStateData) {
    const {
      lyrics,
      timeSeconds,
      currentStanza
    } = effectStateData

    let currentLineIndex = currentStanza.lineIndexAtTime(timeSeconds),
        currentLine = currentStanza.lines[currentLineIndex],
        currentLineOffsetStart = currentStanza.getAbsoluteTimeOfLine(currentLine),
        currentLineOffsetEnd,
        nextLineIndex,
        nextLine,
        nextLineOffset,
        prevLineIndex,
        prevLine,
        prevLineOffset

    if (currentLineIndex == currentStanza.lines.length - 1) {
      let stanzaIndex = lyrics.stanzaIndexAtTime(timeSeconds),
          nextStanza

      if (stanzaIndex === -1) {
        throw Error('stanza not in lyrics object')
      }

      if (stanzaIndex === lyrics.stanzas.length - 1) {
        nextStanza = currentStanza
      } else {
        nextStanza = lyrics.stanzas[stanzaIndex + 1]
      }

      nextLineIndex = 0
      nextLine = nextStanza.lines[nextLineIndex]
      nextLineOffset = nextStanza.getAbsoluteTimeOfLine(nextLine)
    } else {
      nextLineIndex = currentLineIndex + 1
      nextLine = currentStanza.lines[nextLineIndex]
      nextLineOffset = currentStanza.getAbsoluteTimeOfLine(nextLine)
    }

    if (currentLineIndex == 0) {
      let stanzaIndex = lyrics.stanzaIndexAtTime(timeSeconds),
          prevStanza

      if (stanzaIndex === -1) {
        throw Error('stanza not in lyrics object')
      }

      if (stanzaIndex === 0) {
        prevStanza = currentStanza
      } else {
        prevStanza = lyrics.stanzas[stanzaIndex - 1]
      }

      prevLineIndex = prevStanza.lines.length - 1
      prevLine = prevStanza.lines[prevLineIndex]
    } else {
      prevLineIndex = currentLineIndex - 1
      prevLine = currentStanza.lines[prevLineIndex]
      
    }

    prevLineOffset = currentLineOffsetStart - LineTransitionEffect.EFFECT_END_OFFSET

    // currentLineOffset is at the end of the current line
    // so take the start of the next line and subtract that padding
    currentLineOffsetStart += LineTransitionEffect.EFFECT_BEGIN_OFFSET
    currentLineOffsetEnd = nextLineOffset - LineTransitionEffect.EFFECT_END_OFFSET
    nextLineOffset += LineTransitionEffect.EFFECT_BEGIN_OFFSET

    
    let nextNum   = Math.max(0, timeSeconds - currentLineOffsetEnd),
        nextDenom = (nextLineOffset - currentLineOffsetEnd),
        prevNum   = Math.max(0, timeSeconds - prevLineOffset),
        prevDenom = (currentLineOffsetStart - prevLineOffset)
  
    // let phase = Math.abs(Math.min(1, num / div) * 2.0 - 1.0)
    let nextPhase = Math.min(1, nextNum / nextDenom)
    let prevPhase = 1 - (Math.min(1, prevNum / prevDenom))
    let phase = prevPhase + nextPhase

    this.options.opacity = phase
  
    return this._renderTransition(canvas, context, phase)
  }
}

// inspired by https://codepen.io/alenaksu/pen/dGjeMZ
class TVStaticEffect extends LineTransitionEffect {
  static SAMPLES = 10

  constructor() {
    super(BlendMode.ADDITIVE)

    this.scanSpeed = FRAMES_PER_SECOND * 15
    this.scanSize = 0
    this.scanOffsetY = 0
    this.sampleIndex = 0
    this.scaleFactor = 2.5
  }

  _interpolate(x, x0, y0, x1, y1) {
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0))
  }

  _randomSample(context, w, h) {
    let intensity = []
		const factor = h / 50
		const trans = 1 - Math.random() * 0.05

    let intensityCurve = []

		for (let i = 0; i < Math.floor(h / factor) + factor; i++) {
      intensityCurve.push(Math.floor(Math.random() * 15))
    }

		for (let i = 0; i < h; i++) {
			const value = this._interpolate((i / factor), Math.floor(i / factor), intensityCurve[Math.floor(i / factor)], Math.floor(i / factor) + 1, intensityCurve[Math.floor(i / factor) + 1])

      intensity.push(value)
		}

    const imageData = context.createImageData(w, h)

		for (let i = 0; i < (w * h); i++) {
			const k = i * 4
      let color = Math.floor(36 * Math.random())
  
			// Optional: add an intensity curve to try to simulate scan lines
			color += intensity[Math.floor(i / w)]
			imageData.data[k] = imageData.data[k + 1] = imageData.data[k + 2] = color
			imageData.data[k + 3] = Math.round(255 * trans)
    }

		return imageData
  }

  _createSamples(canvas, context) {
    this.scanSize = (canvas.offsetHeight / this.scaleFactor) / 3

    this.samples = []

    for (let i = 0; i < TVStaticEffect.SAMPLES; i++) {
      this.samples.push(this._randomSample(context, canvas.width, canvas.height))
    }
  }

  _renderTransition(canvas, context, transitionPhase) {
    if (this.scanSize == 0) {
      this._createSamples(canvas, context)
    }

    let sampleData = this.samples[Math.floor(this.sampleIndex)]

    this.sampleIndex += 20 / FRAMES_PER_SECOND

    if (this.sampleIndex >= this.samples.length) {
      this.sampleIndex = 0
    }

    return sampleData
  }
}