
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

// a bouncy ball that follows the active syllable
class BouncyBallEffect extends VideoRenderEffect {
  constructor(radius = 8, bounceHeight = 10) {
    super(BlendMode.NORMAL_MUL_ALPHA, VideoRenderEffect.EffectOrder.POST)

    this.radius = radius
    this.bounceHeight = bounceHeight
    this.size = [radius * 2, radius * 2]
    this.imageData = null
  }

  renderFrame(canvas, context, effectStateData) {
    let currentSyllable = null,
        nextSyllable = null

    _.forEach(effectStateData.syllablesGrouped, (group, groupIndex) => {
      let groupResult = _.forEach(group, ([syllable, percentage], index) => {
        if (percentage < 1.0 && percentage > 0.0) {
          currentSyllable = {
            syllable,
            percentage,
            index,
            groupIndex
          }

          let nextGroup,
              nextGroupIndex,
              nextIndex

          if (index == group.length - 1) {
            if (groupIndex == effectStateData.syllablesGrouped.length - 1) {
              nextGroupIndex = groupIndex
              nextGroup = group
              nextIndex = index
            } else {
              nextGroupIndex = groupIndex + 1
              nextGroup = effectStateData.syllablesGrouped[nextGroupIndex]
              nextIndex = 0
            }

          } else {
            nextGroupIndex = groupIndex
            nextGroup = group
            nextIndex = index + 1
          }

          nextSyllable = {
            syllable: nextGroup[nextIndex][0],
            percentage: nextGroup[nextIndex][1],
            index: nextIndex,
            groupIndex: nextGroupIndex
          }

          return false
        }
      })

      if (groupResult === false) {
        return false
      }
    })

    if (currentSyllable == null) {
      return
    }

    let currentPosition = effectStateData.lyricSection.syllablePositions[`${currentSyllable.groupIndex}_${currentSyllable.index}`],
        nextPosition = effectStateData.lyricSection.syllablePositions[`${nextSyllable.groupIndex}_${nextSyllable.index}`]

    let position = [
      lerp(currentPosition[0], nextPosition[0], currentSyllable.percentage),
      lerp(currentPosition[1] - 40 - this.bounceHeight, currentPosition[1] - 40, Math.abs((currentSyllable.percentage) * 2.0 - 1.0))
    ]

    //position[1] = lerp(position[1], currentPosition[1] - this.bounceHeight, 1 / Math.pow(1 / currentSyllable.percentage, 2))

    if (this.imageData === null) {
      this.imageData = context.createImageData(this.size[0], this.size[1])
    }

    const radiusSq = Math.pow(this.radius, 2),
          sharpness = this.radius / 4

    for (let x = -this.radius; x < this.radius; x++) {
      for (let y = -this.radius; y < this.radius; y++) {
        let absX = x + this.radius,
            absY = y + this.radius,
            index = Math.floor((absX + absY * (this.radius * 2))) * 4

        if (x * x + y * y <= radiusSq) {
          this.imageData.data[index] = 255
          this.imageData.data[index + 1] = 0
          this.imageData.data[index + 2] = 0
          this.imageData.data[index + 3] = (sharpness * (1.0 - ((x * x + y * y) / radiusSq))) * 255
        } else {
          this.imageData.data[index + 3] = 0
        }
      }
    }

    return {
      offset: position,
      size: this.size,
      imageData: this.imageData
    }
  }
}

class BlurryBackgroundImageEffect extends VideoRenderEffect {
  constructor(grayscale = 0.5) {
    super(BlendMode.NORMAL, VideoRenderEffect.EffectOrder.PRE)

    this.grayscale = grayscale
  }

  get _filter() {
    let filter = 'blur(4px)'

    if (this.grayscale > 0.0) {
      filter += ` grayscale(${this.grayscale * 100}%)`
    }

    return filter
  }

  renderFrame(canvas, context, effectStateData) {
    const scalingRatio = effectStateData.currentBackgroundImage.width / canvas.width

    let width = Math.floor(canvas.width),
        height = Math.floor(effectStateData.currentBackgroundImage.height / scalingRatio)

    context.filter = this._filter
    context.drawImage(
      effectStateData.currentBackgroundImage,
      0, 0,
      effectStateData.currentBackgroundImage.naturalWidth, effectStateData.currentBackgroundImage.naturalHeight,
      0, Math.floor((canvas.height / 2) - (height / 2)),
      width, height
    )
    context.filter = 'blur(0px) grayscale(0%)'

    return {
      offset: [0, 0],
      size: [canvas.width, canvas.height],
      imageData: context.getImageData(0, 0, canvas.width, canvas.height)
    }
  }
}

// inspired by https://codepen.io/alenaksu/pen/dGjeMZ
class TVStaticLineTransition extends LineTransitionEffect {
  static SAMPLES = 10

  constructor() {
    super(BlendMode.ADDITIVE, {
      baseOpacity: 0.6
    })

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

  _createSamples(canvas, context, width, height) {
    this.scanSize = (canvas.offsetHeight / this.scaleFactor) / 3

    this.samples = []

    for (let i = 0; i < TVStaticLineTransition.SAMPLES; i++) {
      this.samples.push(this._randomSample(context, width, height))
    }
  }

  _renderTransition(canvas, context, effectStateData, phase) {
    if (this.scanSize == 0) {
      this._createSamples(canvas, context, canvas.width, effectStateData.lyricSection.height)
    }

    let sampleData = this.samples[Math.floor(this.sampleIndex)]

    this.sampleIndex += 20 / FRAMES_PER_SECOND

    if (this.sampleIndex >= this.samples.length) {
      this.sampleIndex = 0
    }

    return {
      offset: [effectStateData.lyricSection.x, effectStateData.lyricSection.y],
      size: [effectStateData.lyricSection.width, effectStateData.lyricSection.height],
      imageData: sampleData
    }
  }
}