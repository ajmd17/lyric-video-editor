/* https://codepen.io/okawa-h/pen/bygrEr */

// (function(window) {

// 	'use strict';

// 	let _canvas,_context;
// 	let _image,_imageData;

// 	const effectList = [
// 		function glitch(context,width,height) {

// 			const imageData = context.getImageData(0,0,width,height);
// 			const data      = imageData.data;
// 			const length    = width * height;
// 			const factor    = Math.random() * 10;

// 			let randR = Math.floor(Math.random() * factor);
// 			let randG = Math.floor(Math.random() * factor) * 3;
// 			let randB = Math.floor(Math.random() * factor);

// 			for (let i = 0; i < length; i++) {

// 				let r = data[(i + randR) * 4];
// 				let g = data[(i + randG) * 4 + 1];
// 				let b = data[(i + randB) * 4 + 2];
// 				if (r + g + b == 0) r = g = b = 255;

// 				data[i * 4]     = r;
// 				data[i * 4 + 1] = g;
// 				data[i * 4 + 2] = b;
// 				data[i * 4 + 3] = 255;

// 			}

// 			context.putImageData(imageData,0,0);

// 		},
// 		function glitchWave(context,width,height) {

// 			const renderLineHeight = Math.random() * height;
// 			const cuttingHeight    = 5;
// 			const imageData = context.getImageData(0,renderLineHeight,width,cuttingHeight);
// 			context.putImageData(imageData,0,renderLineHeight - 10);

// 		},
// 		function glitchSlip(context,width,height) {

// 			const waveDistance = 100;
// 			const startHeight  = height * Math.random();
// 			const endHeight    = startHeight + 30 + (Math.random() * 40);
// 			for (let h = startHeight; h < endHeight; h++) {

// 				if (Math.random() < .1) h++;
// 				let imageData = context.getImageData(0, h, width, 1);
// 				context.putImageData(imageData, Math.random() * waveDistance - (waveDistance * .5), h);

// 			}

// 		},
// 		function glitchColor(context,width,height) {

// 			const waveDistance = 30;
// 			const startHeight  = height * Math.random();
// 			const endHeight    = startHeight + 30 + (Math.random() * 40);
// 			const imageData    = context.getImageData(0, startHeight, width, endHeight);
// 			const length       = width * height;
// 			let data           = imageData.data;

// 			let r = 0;
// 			let g = 0;
// 			let b = 0;

// 			for (let i = 0; i < length; i++) {

// 				if (i % width === 0){
// 					r = i + Math.floor((Math.random() -.5) * waveDistance);
// 					g = i + Math.floor((Math.random() -.5) * waveDistance);
// 					b = i + Math.floor((Math.random() -.5) * waveDistance);
// 				}

// 				data[i *4]      = data[r * 4];
// 				data[i * 4 + 1] = data[g * 4 + 1];
// 				data[i * 4 + 2] = data[b * 4 + 2];

// 			}

// 			context.putImageData(imageData, 0, startHeight);

// 		}
// 	];

// 	function init() {

// 		const imageBoard = document.querySelector('[data-js="glitch-image"]');
// 		_image   = imageBoard.querySelector('img');
// 		_canvas  = document.createElement('canvas');
// 		_context = _canvas.getContext('2d');

// 		imageBoard.appendChild(_canvas);

// 		_imageData = new Image();
// 		_imageData.crossOrigin = "Anonymous";
// 		_imageData.onload = function(event) {

// 			window.addEventListener('resize',onResize,false);
// 			window.dispatchEvent(new Event('resize'));
// 			window.requestAnimationFrame(render);

// 		}
// 		_imageData.src = _image.getAttribute('src');

// 	}

// 	function onResize() {

// 		_canvas.width  = _image.width;
// 		_canvas.height = _image.height;

// 	}

// 	function render(timestamp) {

// 		let width  = _canvas.width;
// 		let height = _canvas.height;

// 		_context.clearRect(0,0,width,height);
// 		_context.drawImage(_imageData,0,0,_image.width,_image.height);

// 		if (.5 < Math.random()) {
// 			getRandomValue(effectList)(_context,width,height);
// 		}

// 		window.requestAnimationFrame(render);

// 	}

// 	function getRandomValue(array) {

//         return array[Math.floor(Math.random() * array.length)];

//     }

// 	document.addEventListener('DOMContentLoaded',init);

// })(window);


class GlitchEffect extends VideoRenderEffect {
  constructor() {
    super()
  }

  _glitch(canvas, context) {
    const width = canvas.width,
          height = canvas.height,
          imageData = context.getImageData(0, 0, width, height),
          resultImageData = context.createImageData(width, height),
          length = width * height,
          factor = Math.random() * 10

    let randR = Math.floor(Math.random() * factor),
        randG = Math.floor(Math.random() * factor) * 3,
        randB = Math.floor(Math.random() * factor)

      
    for (let i = 0; i < length; i++) {
      let r = imageData.data[(i + randR) * 4]
      let g = imageData.data[(i + randG) * 4 + 1]
      let b = imageData.data[(i + randB) * 4 + 2]

      if (r + g + b == 0) {
        r = g = b = 255
      }

      resultImageData.data[i * 4] = r
      resultImageData.data[i * 4 + 1] = g
      resultImageData.data[i * 4 + 2] = b
      resultImageData.data[i * 4 + 3] = 255
    }

    //context.putImageData(imageData, 0, 0)

    return resultImageData
  }

  _glitchWave(canvas, context) {
    const width = canvas.width,
          height = canvas.height,
          renderLineHeight = Math.random() * height,
          cuttingHeight = 5,
          imageData = context.getImageData(0, renderLineHeight, width, cuttingHeight)

    context.putImageData(imageData, 0, renderLineHeight - 10)
  }

  _glitchSlip(canvas, context) {
    const width = canvas.width,
          height = canvas.height,
          waveDistance = 100,
          startHeight = height * Math.random(),
          endHeight = startHeight + 30 + (Math.random() * 40),
          imageData = context.createImageData(canvas.width, canvas.height)

    for (let h = startHeight; h < endHeight; h++) {
      if (Math.random() < 0.1) {
        h++
      }

      let rand = Math.random() * waveDistance - (waveDistance / 2)

      for (let x = 0; x < width; x++) {
        for (let y = h; y < 1; y++) {
          let idx = (x + y * width) * 4

          for (let x2 = rand; x2 < width; x2++) {
            for (let y2 = h; y2 < height; y2++) {
              let idx2 = (x2 + y2 * width) * 4

              imageData.data[idx2] = imageData.data[idx]
              imageData.data[idx2 + 1] = imageData.data[idx + 1]
              imageData.data[idx2 + 2] = imageData.data[idx + 2]
              imageData.data[idx2 + 3] = imageData.data[idx + 3]
            }
          }
        }
      }

      // let imageData = context.getImageData(0, h, width, 1)

      // context.putImageData(imageData, Math.random() * waveDistance - (waveDistance / 2), h)
    }

    return imageData
  }

  _glitchColor(canvas, context) {
    const width = canvas.width,
          height = canvas.height,
          waveDistance = 30,
          startHeight = height * Math.random(),
          endHeight = startHeight + 30 + (Math.random() * 40),
          imageData = context.createImageData(width, endHeight),
          length = width * height
    
    let data = imageData.data,
        r = 0,
        g = 0,
        b = 0

    for (let i = 0; i < length; i++) {
      if (i % width === 0) {
        r = i + Math.floor((Math.random() - 0.5) * waveDistance)
        g = i + Math.floor((Math.random() - 0.5) * waveDistance)
        b = i + Math.floor((Math.random() - 0.5) * waveDistance)
      }

      data[i * 4] = data[r * 4]
      data[i * 4 + 1] = data[g * 4 + 1]
      data[i * 4 + 2] = data[b * 4 + 2]
    }

    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < startHeight; y++) {
        let idx = (x + y * canvas.width) * 4

        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
        data[idx + 3] = 0
      }
      for (let y = endHeight; y < height; y++) {
        let idx = (x + y * canvas.width) * 4

        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
        data[idx + 3] = 0
      }
    }

    return imageData
  }

  _getRandomValue(canvas, context) {
    const procs = [
      this._glitch,
      // this._glitchWave,
      this._glitchSlip,
      this._glitchColor
    ]

    return procs[Math.floor(Math.random() * procs.length)](canvas, context)
  }

  renderFrame(canvas, context, effectStateData) {
    return {
      offset: [0, 0],
      size: [canvas.width, canvas.height],
      imageData: this._getRandomValue(canvas, context)
    }
  }
}