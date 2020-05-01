// a bouncy ball that follows the active syllable
class BouncyBallEffect extends VideoRenderEffect {
  constructor(radius = 8, bounceHeight = 10) {
    super(BlendMode.NORMAL_MUL_ALPHA, VideoRenderEffect.EffectOrder.POST)

    this.radius = radius
    this.bounceHeight = bounceHeight
    this.size = [radius * 2, radius * 2]
    this.imageData = null
  }

  _buildSyllableObject(syllablesGrouped, groupIndex, index) {
    const group = syllablesGrouped[groupIndex]

    if (!group) {
      return null
    }

    const [syllable, percentage] = group[index]

    return {
      syllable,
      percentage,
      index,
      groupIndex
    }
  }

  _createImageData(context) {
    this.imageData = context.createImageData(this.size[0], this.size[1])

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
          this.imageData.data[index + 3] = Math.floor((sharpness * (1.0 - ((x * x + y * y) / radiusSq))) * 255)
        } else {
          this.imageData.data[index + 3] = 0
        }
      }
    }
  }

  _blankLineTransitionLength(line) {
    return Math.min(0.35, line.duration)
  }

  _endOfLinePosition(canvas, effectStateData) {
    return [canvas.width - this.size[0], effectStateData.lyricSection.y + (effectStateData.lyricSection.height / 2)]
  }

  renderFrame(canvas, context, effectStateData) {
    let currentSyllable = null,
        nextSyllable = null
    
    _.forEach(effectStateData.syllablesGrouped, (group, groupIndex) => {
      let groupResult = _.forEach(group, ([syllable, percentage], index) => {
        let prev,
            first = false

        if (index != 0) {
          prev = group[index - 1]
        } else if (groupIndex == 0) {
          prev = group[index]
          first = true
        } else {
          let prevGroup = effectStateData.syllablesGrouped[groupIndex - 1]

          prev = prevGroup[prevGroup.length - 1]
        }

        if (percentage < 1 && (first || prev[1] == 1)) {
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

    let currentPosition,
        nextPosition,
        bounceHeight = this.bounceHeight,
        percentage = 0,
        bounceToNextStanza = false,
        currentLineBlank = false

    if (effectStateData.currentLine && (effectStateData.currentLine.isBlankLine || effectStateData.currentStanza.isContextual)) {
      const blankLineStart = effectStateData.currentStanza.getAbsoluteTimeOfLine(effectStateData.currentLine),
            transitionLength = this._blankLineTransitionLength(effectStateData.currentLine),
            duration = effectStateData.currentLine.duration

      percentage = Math.max(0.0, effectStateData.timeSeconds - (blankLineStart + duration - transitionLength)) / transitionLength

      currentLineBlank = true
    } else if (!effectStateData.currentLine) { // start of line
      if (effectStateData.nextLine) {
        if (!effectStateData.nextLine.isBlankLine && !effectStateData.nextLineStanza.isContextual) {
          const transitionLength = this._blankLineTransitionLength(effectStateData.nextLine),
                nextLineStart = effectStateData.nextLineStanza.getAbsoluteTimeOfLine(effectStateData.nextLine)

          percentage = Math.max(0, effectStateData.timeSeconds - (nextLineStart - transitionLength)) / transitionLength
        }
      }

      currentLineBlank = true
    } else {
      if (currentSyllable == null) {
        if (!(currentSyllable = this._buildSyllableObject(effectStateData.syllablesGrouped, 0, 0))) {
          return null
        }
      }

      percentage = currentSyllable.percentage

      currentPosition = effectStateData.lyricSection.getSyllablePosition('current', currentSyllable.groupIndex, currentSyllable.index)

      if (nextSyllable == null) {
        nextSyllable = currentSyllable
      }
  
      nextPosition = effectStateData.lyricSection.getSyllablePosition('current', nextSyllable.groupIndex, nextSyllable.index)

      // end of line, 'bounce' the marker across the screen over to the next item
      if (nextPosition == currentPosition) {
        bounceToNextStanza = true
      }
    }

    if (percentage === 0.0) {
      // no need to render on screen when it would just be sitting on the side
      return null
    }

    if (currentLineBlank) {
      currentPosition = this._endOfLinePosition(canvas, effectStateData)
    }

    if (bounceToNextStanza || currentLineBlank) {
      // position of the first syllable of the next line

      if (effectStateData.nextLine) {
        if (effectStateData.nextLine.isBlankLine || effectStateData.nextLineStanza.isContextual) {
          nextPosition = this._endOfLinePosition(canvas, effectStateData)
        } else {
          const nextLinePosition = effectStateData.lyricSection.getSyllablePosition('next', 0, 0)

          if (Array.isArray(nextLinePosition) && nextLinePosition.length == 2) {
            nextPosition = [canvas.width + nextLinePosition[0], currentPosition[1] + 35]
          }
        }
      }
    }

    let position = currentPosition
    
    if (nextPosition != null && Array.isArray(nextPosition) && nextPosition.length === 2) {
      position = [
        lerp(
          currentPosition[0],
          nextPosition[0],
          percentage
        ),
        lerp(
          currentPosition[1] - effectStateData.lyricSection.height - bounceHeight,
          currentPosition[1] - effectStateData.lyricSection.height,
          Math.max(0.0, Math.min(1.0, Math.abs((percentage) * 2.0 - 1.0)))
        )
      ]
    }

    if (this.imageData === null) {
      this._createImageData(context)
    }

    return {
      offset: position,
      size: this.size,
      imageData: this.imageData
    }
  }
}