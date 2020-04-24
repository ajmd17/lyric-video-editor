
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
  [BlendMode.NO_OP]: (lhs, rhs, lhsIndex, rhsIndex) => {},
  [BlendMode.NORMAL]: (lhs, rhs, lhsIndex, rhsIndex) => {
    for (let i = 0; i < 4; i++) {
      lhs[i + lhsIndex] = rhs[i + rhsIndex]
    }
  },
  [BlendMode.NORMAL_MUL_ALPHA]: (lhs, rhs, lhsIndex, rhsIndex) => {
    for (let i = 0; i < 3; i++) {
      lhs[i + lhsIndex] = lerp(lhs[i + lhsIndex], rhs[i + rhsIndex], rhs[3 + rhsIndex] / 255)
    }
  },
  [BlendMode.ADDITIVE]: (lhs, rhs, lhsIndex, rhsIndex) => {
    for (let i = 0; i < 4; i++) {
      lhs[i + lhsIndex] += rhs[i + rhsIndex]
    }
  },
  [BlendMode.SUBTRACTIVE]: (lhs, rhs, lhsIndex, rhsIndex) => {
    for (let i = 0; i < 4; i++) {
      lhs[i + lhsIndex] -= rhs[i + rhsIndex]
    }
  }
}

class EffectResult {
  constructor(blendMode, resultData, offset = [0, 0], size = [null, null], options = {}) {
    this.blendMode = blendMode
    this.resultData = resultData
    this.offset = offset

    if (size[0] === null) size[0] = resultData.width
    if (size[1] === null) size[1] = resultData.height

    this.size = size
    this.options = options
  }

  applyToImageData(imageData, canvas, options = {}) {
    let opacity = _.isNumber(options.opacity)
      ? options.opacity
      : _.isNumber(this.options.opacity)
        ? this.options.opacity
        : 1.0

    opacity = Math.min(Math.max(0.0, opacity), 1.0)

    for (let x = 0; x < Math.floor(this.size[0]); x++) {
      for (let y = 0; y < Math.floor(this.size[1]); y++) {
        let thisIndex = (x + y * Math.floor(this.size[0])) * 4,
          outputIndex = ((x + Math.floor(this.offset[0])) + (y + Math.floor(this.offset[1])) * canvas.width) * 4
        
        let prevValues = [imageData.data[outputIndex], imageData.data[outputIndex + 1], imageData.data[outputIndex + 2], imageData.data[outputIndex + 3]]

        blendCombineFunc[this.blendMode](imageData.data, this.resultData.data, outputIndex, thisIndex)

        if (opacity < 1.0) {
          imageData.data[outputIndex]     = lerp(prevValues[0], imageData.data[outputIndex], opacity)
          imageData.data[outputIndex + 1] = lerp(prevValues[1], imageData.data[outputIndex + 1], opacity)
          imageData.data[outputIndex + 2] = lerp(prevValues[2], imageData.data[outputIndex + 2], opacity)
          imageData.data[outputIndex + 3] = lerp(prevValues[3], imageData.data[outputIndex + 3], opacity)
        }
      }
    }
  }

  clone() {
    const combinedImageData = new ImageData(
      Uint8ClampedArray.from(this.resultData.data),
      this.resultData.width,
      this.resultData.height
    )

    return new EffectResult(
      this.blendMode,
      combinedImageData,
      this.offset,
      this.size,
      this.options
    )
  }
}

class VideoRenderEffect {
  static EffectOrder = {
    POST: 0,
    PRE: 1
  }

  constructor(blendMode, order = VideoRenderEffect.EffectOrder.POST, options = { opacity: 1.0 }) {
    this.blendMode = blendMode
    this.order = order
    this.options = options
  }

  renderFrame(canvas, context, effectStateData) {
    throw Error('not implemented')
  }

  render(canvas, context, effectStateData) {
    const data = this.renderFrame(canvas, context, effectStateData)

    if (data == null) {
      return null
    }

    if (data instanceof EffectResult) {
      return data
    }

    return new EffectResult(this.blendMode, data.imageData, data.offset, data.size, this.options)
  }
}

class LineTransitionEffect extends VideoRenderEffect {
  static EFFECT_BEGIN_OFFSET = 0.18
  static EFFECT_END_OFFSET = 0.18

  constructor(blendMode, options) {
    super(blendMode, VideoRenderEffect.EffectOrder.POST, options)

    this.options.baseOpacity = this.options.baseOpacity || 0.0
  }

  _renderTransition(canvas, context, effectStateData, phase) {
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

    if (this.options.baseOpacity > 0.0) {
      this.options.opacity = lerp(this.options.baseOpacity, 1.0, phase)
    } else {
      this.options.opacity = phase
    }
  
    // optimization: don't compute transition
    if (this.options.opacity <= 0.0001) {
      return null
    }

    return this._renderTransition(canvas, context, effectStateData, phase)
  }
}