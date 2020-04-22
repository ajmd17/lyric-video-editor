class TVPowerEffect extends VideoRenderEffect {
  constructor(duration = 3, effectLength = 1) {
    super(BlendMode.NORMAL, VideoRenderEffect.EffectOrder.POST)

    this.duration = duration
    this.effectLength = effectLength
    this.imageData = null
  }

  _getCurrentImageData(canvas, context) {
    return context.getImageData(0, 0, canvas.width, canvas.height)
  }

  _bloom(canvas, context, d) {
    
    var pick = function(d, x, y){
      var i = y*d.width*4 + x*4;
      return [d.data[i], d.data[i+1], d.data[i+2], d.data[i+3]];
    }

    var new_data = context.createImageData(canvas.width, canvas.height)
    
    // Calculate bloom value for each pixel between start_index and limmit.
    for (var k=0; k<d.data.length; k+=4){
        var x = (k/4)%d.width;
        var y = Math.floor((k/4)/d.width);

        var sum = [0,0,0,0];
        for (var i=-4; i<4; i++){
            for (var j=-3; j<3; j++){
                var p = pick(d, x+j, y+i);
                if (p[0]){
                    sum[0] += p[0];
                    sum[1] += p[1];
                    sum[2] += p[2];
                    sum[3] += p[3];
                }
            }
        }

        var r = d.data[k];
        if (r < 80){
            var amount = 3;
        } else if (r < 127) {
            var amount = 2;
        } else {
            var amount = 4;
        }
        new_data.data[k] = sum[0]*sum[0]*amount/2550000+d.data[k];
        new_data.data[k + 1] = sum[1]*sum[1]*amount/2550000+d.data[k+1];
        new_data.data[k + 2] = sum[2]*sum[2]*amount/2550000+d.data[k+2];
        new_data.data[k + 3] = sum[3]*sum[3]*amount/2550000+d.data[k+3];
    }

    return new_data
  }

  _renderStartAnimation(canvas, context, percentage) {
    
  }

  _renderEndAnimation(canvas, context, percentage) {
    // rectangle that will be the 'white' part
    const resultImageData = context.createImageData(canvas.width, canvas.height)

    const rect = { width: canvas.width, height: canvas.height }

    rect.width = (1.0 - (Math.pow((percentage * 0.5) / 0.5, 2.0))) * canvas.width
    rect.height = ((Math.pow(Math.min(0, percentage - 0.5) * 2, 2.0))) * canvas.height
    console.log('percentage = ', percentage)
    //console.log('rect.height = ', rect.height)

    const rectX = (canvas.width / 2) - (rect.width / 2),
          rectY = (canvas.height / 2) - (rect.height / 2)

    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        let idx = (x + y * canvas.width) * 4

        if (x >= rectX && x <= rectX + rect.width && y >= rectY && y <= rectY + rect.height) {

          resultImageData.data[idx] = 255
          resultImageData.data[idx + 1] = 255
          resultImageData.data[idx + 2] = 255
          resultImageData.data[idx + 3] = 255
        } else {
          resultImageData.data[idx] = 0
          resultImageData.data[idx + 1] = 0
          resultImageData.data[idx + 2] = 0
          resultImageData.data[idx + 3] = 255
        }
      }
    }

    if (percentage >= 1) {
      return resultImageData
    }

    return this._bloom(canvas, context, resultImageData)
  }

  renderFrame(canvas, context, effectStateData) {
    if (effectStateData.timeSeconds <= this.duration) {
      this.imageData = this._getCurrentImageData(canvas, context)

      return {
        offset: [0, 0],
        size: [canvas.width, canvas.height],
        imageData: this._renderStartAnimation(canvas, context, effectStateData.timeSeconds / this.duration)
      }
    }

    if (effectStateData.timeSeconds >= effectStateData.totalDuration - this.duration) {
      this.imageData = this._getCurrentImageData(canvas, context)

      const startTime = effectStateData.totalDuration - this.duration,
            endTime = effectStateData.totalDuration
      
      return {
        offset: [0, 0],
        size: [canvas.width, canvas.height],
        imageData: this._renderEndAnimation(canvas, context, Math.min((effectStateData.timeSeconds - startTime) / this.effectLength), 1.0)
      }
    }

    return null
  }
}