class NoSignalEffect extends VideoRenderEffect {
  // static ROWS = [
  //   ['white', 'yellow', 'cyan', 'lime', 'magenta', 'red', 'blue'],
  //   ['blue', 'black', 'magenta', 'black', 'cyan', 'black', 'white'],
  //   ['very light blue', 'white', 'dark blue', 'black', 'very dark gray', 'black']
  // ]
  static ROWS = [
    [[255, 255, 255], [255, 255, 0], [0, 255, 255], [0, 255, 0], [255, 0, 255], [255, 0, 0], [0, 0, 255]],
    [[0, 0, 255], [0, 0, 0], [255, 0, 255], [0, 0, 0], [0, 255, 255], [0, 0, 0], [255, 255, 255]],
    [[36, 39, 41], [255, 255, 255], [36, 39, 41], [0, 0, 0], [36, 39, 41], [0, 0, 0]]
  ]

  static ROW_HEIGHTS = [
    0.7,
    0.1,
    0.2
  ]

  constructor() {
    super(BlendMode.NORMAL, VideoRenderEffect.EffectOrder.POST)

    this.imageData = null
  }

  _renderRow(canvas, context, row, rowHeight, offsetY) {
    const rowWidth = Math.floor(canvas.width / row.length)
  
    for (let i = 0; i < row.length; i++) {
      for (let x = i * rowWidth; x < (i + 1) * rowWidth; x++) {
        for (let y = offsetY; y < offsetY + rowHeight; y++) {
          let idx = (x + y * canvas.width) * 4

          this.imageData.data[idx] = row[i][0]
          this.imageData.data[idx + 1] = row[i][1]
          this.imageData.data[idx + 2] = row[i][2]
          this.imageData.data[idx + 3] = 255
        }
      }
    }
  }

  renderFrame(canvas, context, effectStateData) {
    if (this.imageData === null) {
      this.imageData = context.createImageData(canvas.width, canvas.height)
    }

    let offsetY = 0
    for (let i = 0; i < NoSignalEffect.ROWS.length; i++) {
      const rowHeight = Math.floor(NoSignalEffect.ROW_HEIGHTS[i] * canvas.height)

      this._renderRow(canvas, context, NoSignalEffect.ROWS[i], rowHeight, offsetY)

      offsetY += rowHeight
    }

    return {
      offset: [0, 0],
      size: [canvas.width, canvas.height],
      imageData: this.imageData
    }
  }
}