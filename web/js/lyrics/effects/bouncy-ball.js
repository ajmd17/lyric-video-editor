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
        bounceHeight = this.bounceHeight

    if (currentSyllable == null) {
      if (!(currentSyllable = this._buildSyllableObject(effectStateData.syllablesGrouped, 0, 0))) {
        return null
      }
    }

    currentPosition = effectStateData.lyricSection.syllablePositions[`current__${currentSyllable.groupIndex}_${currentSyllable.index}`]

    if (nextSyllable == null) {
      console.log('no null')
      nextSyllable = currentSyllable
    }

    nextPosition = effectStateData.lyricSection.syllablePositions[`current__${nextSyllable.groupIndex}_${nextSyllable.index}`]


    // end of line, 'bounce' the marker across the screen over to the next item
    if (nextPosition == currentPosition) {
      // position of the first syllable of the next line
      const nextLinePosition = effectStateData.lyricSection.syllablePositions['next__0_0']
  
      if (Array.isArray(nextLinePosition)) {
        nextPosition = [canvas.width + nextLinePosition[0], currentPosition[1]]
        bounceHeight += 35
      }
    }

    let position = [
      lerp(
        currentPosition[0],
        nextPosition[0],
        currentSyllable.percentage
      ),
      lerp(
        currentPosition[1] - effectStateData.lyricSection.height - bounceHeight,
        currentPosition[1] - effectStateData.lyricSection.height,
        Math.max(0.0, Math.min(1.0, Math.abs((currentSyllable.percentage) * 2.0 - 1.0)))
      )
    ]

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