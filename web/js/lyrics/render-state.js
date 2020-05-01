class RenderState {
  static DEFAULT_RENDER_PROPERTIES = {
    'timeSeconds': 0,
    'totalDuration': null,
    'lyrics': null,
    'currentBackgroundImage': null,
    'currentStanza': null,
    'currentLineIndex': -1,
    'currentLine': null,
    'syllablePercentages': [],
    'syllablesGrouped': [],
    'lyricSection': null,
    'prevLine': null,
    'nextLineStanza': null,
    'nextLine': null,
    'nextLineIndex': -1,
    'nextLineSyllablePercentages': [],
    'nextLineSyllablesGrouped': []
  }

  constructor(properties) {
    this.properties = Object.assign({}, RenderState.DEFAULT_RENDER_PROPERTIES, properties)
  }
}

_.tap(RenderState.DEFAULT_RENDER_PROPERTIES, (defaults) => {
  Object.keys(defaults).forEach((key) => {
    RenderState.DEFAULT_RENDER_PROPERTIES[key] = defaults[key]
  
    Object.defineProperty(RenderState.prototype, key, {
      get: function () {
        return this.properties[key]
      },
      set: function (value) {
        this.properties[key] = value
      }
    })
  })
})

class LyricSectionState {
  constructor(x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.syllablePositions = {}
  }

  getSyllablePosition(key, groupIndex, subIndex) {
    return this.syllablePositions[`${key}__${groupIndex}_${subIndex}`]
  }

  setSyllablePosition(key, groupIndex, subIndex, x, y) {
    this.syllablePositions[`${key}__${groupIndex}_${subIndex}`] = [x, y]
  }
}