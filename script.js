const { createFFmpeg, fetchFile } = FFmpeg;

document.addEventListener('DOMContentLoaded', function() {

  // 初始化FFmpeg
  const ffmpeg = createFFmpeg({ log: true });

  // DOM elements
  const fileUpload        = document.getElementById('fileUpload');
  const gridSize          = document.getElementById('gridSize');
  const brightness        = document.getElementById('brightness');
  const contrast          = document.getElementById('contrast');
  const gamma             = document.getElementById('gamma');
  const smoothing         = document.getElementById('smoothing');
  const ditherType        = document.getElementById('ditherType');
  const resetButton       = document.getElementById('resetButton');
  const downloadButton    = document.getElementById('downloadButton');
  const particleColor     = document.getElementById('particleColor');
  const particleColorVal  = document.getElementById('particleColorVal');
  const progressPanel     = document.getElementById('progressPanel');
  const progressBar       = document.getElementById('progressBar');
  const progressText      = document.getElementById('progressText');
  const frameInfo         = document.getElementById('frameInfo');
  
  const gridSizeVal       = document.getElementById('gridSizeVal');
  const brightnessVal     = document.getElementById('brightnessVal');
  const contrastVal       = document.getElementById('contrastVal');
  const gammaVal          = document.getElementById('gammaVal');
  const smoothingVal      = document.getElementById('smoothingVal');
  const videoFps          = document.getElementById('videoFps');
  const videoFpsVal       = document.getElementById('videoFpsVal');
  
  const halftoneCanvas    = document.getElementById('halftoneCanvas');
  
  // Global variables for preview
  let imageElement = null;
  let videoElement = null;
  let isVideo = false;
  let animationFrameId;
  let imageFiles = [];
  
  // Default parameter values
  const defaults = {
    gridSize: 20,
    brightness: 20,
    contrast: 0,
    gamma: 1.0,
    smoothing: 0,
    ditherType: "None",
    particleColor: "#000000"
  };

  // 加载FFmpeg
  // 加载FFmpeg核心
  (async () => {
    await ffmpeg.load();
    console.log('FFmpeg核心加载完成');
  })();
  
  // Debounce helper to limit update frequency.
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  function updateAndProcess() {
    gridSizeVal.textContent = gridSize.value;
    brightnessVal.textContent = brightness.value;
    contrastVal.textContent = contrast.value;
    gammaVal.textContent = gamma.value;
    smoothingVal.textContent = smoothing.value;
    if (imageElement || videoElement) {
      processFrame();
    }
  }
  
  const debouncedUpdate = debounce(updateAndProcess, 150);
  
  // Attach listeners to controls.
  gridSize.addEventListener('input', debouncedUpdate);
  brightness.addEventListener('input', debouncedUpdate);
  contrast.addEventListener('input', debouncedUpdate);
  gamma.addEventListener('input', debouncedUpdate);
  smoothing.addEventListener('input', debouncedUpdate);
  ditherType.addEventListener('change', debouncedUpdate);
  particleColor.addEventListener('input', (e) => {
    particleColorVal.textContent = e.target.value;
    debouncedUpdate();
  });
  
  fileUpload.addEventListener('change', handleFileUpload);
  
  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fileURL = URL.createObjectURL(file);
    downloadButton.style.display = 'block';
    if (file.type.startsWith('video/')) {
      isVideo = true;
      if (videoElement) {
        videoElement.src = fileURL;
      } else {
        videoElement = document.createElement('video');
        videoElement.crossOrigin = "anonymous";
        videoElement.src = fileURL;
        videoElement.autoplay = true;
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute("webkit-playsinline", "true");
        videoElement.addEventListener('loadeddata', () => {
          setupCanvasDimensions(videoElement.videoWidth, videoElement.videoHeight);
          videoElement.play();
          processVideoFrame();
        });
        videoElement.addEventListener('error', (e) => {
          console.error("Error loading video:", e);
        });
      }
    } else if (file.type.startsWith('image/')) {
      isVideo = false;
      if (videoElement) {
        cancelAnimationFrame(animationFrameId);
        videoElement.pause();
      }
      imageElement = new Image();
      imageElement.src = fileURL;
      imageElement.addEventListener('load', () => {
        setupCanvasDimensions(imageElement.width, imageElement.height);
        processFrame();
      });
    }
  }
  
  function setupCanvasDimensions(width, height) {
    const maxWidth = window.innerWidth * 0.8;
    const maxHeight = window.innerHeight * 0.8;
    let newWidth = width, newHeight = height;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      newWidth = width * ratio;
      newHeight = height * ratio;
    }
    halftoneCanvas.width = newWidth;
    halftoneCanvas.height = newHeight;
  }
  
  function processFrame() {
    if (!imageElement && !videoElement) return;
    generateHalftone(halftoneCanvas, 1);
  }

  async function convertImagesToVideo(imageFiles, fps) {
    if (window.SharedArrayBuffer) {
      console.log("支持SharedArrayBuffer");
      } else {
      console.log("不支持SharedArrayBuffer");
      }
    

    // 将图片写入FFmpeg虚拟文件系统
    for (let i = 0; i < imageFiles.length; i++) {
      const fileName = `image${i.toString().padStart(6, '0')}.jpg`;
      ffmpeg.FS('writeFile', fileName, await fetchFile(imageFiles[i]));


      // 更新进度
      const progress = Math.floor(50 + (i + 1) / imageFiles.length * 30);
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;
      frameInfo.textContent = `正在合成视频: ${i + 1}/${imageFiles.length}`;
    }

    // 更新进度
    let progress = Math.floor(90);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
    frameInfo.textContent = `输出文件中...`;

    // 设置FFmpeg参数：处理图像序列
    await ffmpeg.run(
      '-framerate', '30',         // 输入帧率，控制每张图片作为一帧的时间（1/30秒）
      '-i', 'image%06d.jpg',      // 匹配image000.jpg, image001.jpg等序列文件
      '-c:v', 'libx264',          // 编码器
      '-pix_fmt', 'yuv420p',      // 兼容的像素格式
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // 确保分辨率为偶数
      '-r', String(fps),                 // 输出帧率（可选，确保输出帧率与输入一致）
      'output.mp4'
    );

    // 更新进度
    progress = Math.floor(100);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
    frameInfo.textContent = `处理完成！`;


    // 输出文件大小，单位MB
    const { size } = await ffmpeg.FS('stat', 'output.mp4');
    console.log(`视频文件大小：${(size / (1024 * 1024)).toFixed(2)} MB`);
    
    // 读取输出视频
    const data = await ffmpeg.FS('readFile', 'output.mp4');
    
    // 创建视频Blob
    const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
    return videoBlob;
  }
  
  function processVideoFrame() {
    if (!isVideo) return;
    processFrame();
    animationFrameId = requestAnimationFrame(processVideoFrame);
  }
  
  // Generate halftone: compute grayscale per grid cell by iterating over full‑resolution data.
  function generateHalftone(targetCanvas, scaleFactor) {
    const previewWidth = halftoneCanvas.width;
    const previewHeight = halftoneCanvas.height;
    const targetWidth = previewWidth * scaleFactor;
    const targetHeight = previewHeight * scaleFactor;
    
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
    
    // Draw the full‑resolution image/video onto a temporary canvas.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (isVideo) {
      tempCtx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
    } else {
      tempCtx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
    }
    
    const imgData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;
    
    const brightnessAdj = parseInt(brightness.value, 10);
    const contrastAdj   = parseInt(contrast.value, 10);
    const gammaValNum   = parseFloat(gamma.value);
    const contrastFactor = (259 * (contrastAdj + 255)) / (255 * (259 - contrastAdj));
    
    // Compute grayscale value per pixel.
    const grayData = new Float32Array(targetWidth * targetHeight);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      gray = contrastFactor * (gray - 128) + 128 + brightnessAdj;
      gray = Math.max(0, Math.min(255, gray));
      gray = 255 * Math.pow(gray / 255, 1 / gammaValNum);
      grayData[i / 4] = gray;
    }
    
    // Divide the image into grid cells.
    const grid = parseInt(gridSize.value, 10) * scaleFactor;
    const numCols = Math.ceil(targetWidth / grid);
    const numRows = Math.ceil(targetHeight / grid);
    let cellValues = new Float32Array(numRows * numCols);
    
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        let sum = 0, count = 0;
        const startY = row * grid;
        const startX = col * grid;
        const endY = Math.min(startY + grid, targetHeight);
        const endX = Math.min(startX + grid, targetWidth);
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            sum += grayData[y * targetWidth + x];
            count++;
          }
        }
        cellValues[row * numCols + col] = sum / count;
      }
    }
    
    // Apply smoothing if enabled.
    const smoothingStrength = parseFloat(smoothing.value);
    if (smoothingStrength > 0) {
      cellValues = applyBoxBlur(cellValues, numRows, numCols, smoothingStrength);
    }
    
    // Apply dithering if selected.
    const selectedDither = ditherType.value;
    if (selectedDither === "FloydSteinberg") {
      applyFloydSteinbergDithering(cellValues, numRows, numCols);
    } else if (selectedDither === "Ordered") {
      applyOrderedDithering(cellValues, numRows, numCols);
    } else if (selectedDither === "Noise") {
      applyNoiseDithering(cellValues, numRows, numCols);
    }
    
    // Draw the halftone dots.
    const ctx = targetCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const brightnessValue = cellValues[row * numCols + col];
        const norm = brightnessValue / 255;
        const maxRadius = grid / 2;
        const radius = maxRadius * (1 - norm);
        if (radius > 0.5) {
          ctx.beginPath();
          const centerX = col * grid + grid / 2;
          const centerY = row * grid + grid / 2;
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = particleColor.value;
          ctx.fill();
        }
      }
    }
  }
  
  // 3× Box Blur for smoothing grid cell values.
  function applyBoxBlur(cellValues, numRows, numCols, strength) {
    let result = new Float32Array(cellValues);
    const passes = Math.floor(strength);
    for (let p = 0; p < passes; p++) {
      let temp = new Float32Array(result.length);
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          let sum = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const r = row + dy, c = col + dx;
              if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
                sum += result[r * numCols + c];
                count++;
              }
            }
          }
          temp[row * numCols + col] = sum / count;
        }
      }
      result = temp;
    }
    const frac = strength - Math.floor(strength);
    if (frac > 0) {
      for (let i = 0; i < result.length; i++) {
        result[i] = cellValues[i] * (1 - frac) + result[i] * frac;
      }
    }
    return result;
  }
  
  function applyFloydSteinbergDithering(cellValues, numRows, numCols) {
    const threshold = 128;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const index = row * numCols + col;
        const oldVal = cellValues[index];
        const newVal = oldVal < threshold ? 0 : 255;
        const error = oldVal - newVal;
        cellValues[index] = newVal;
        if (col + 1 < numCols) {
          cellValues[row * numCols + (col + 1)] += error * (7 / 16);
        }
        if (row + 1 < numRows) {
          if (col - 1 >= 0) {
            cellValues[(row + 1) * numCols + (col - 1)] += error * (3 / 16);
          }
          cellValues[(row + 1) * numCols + col] += error * (5 / 16);
          if (col + 1 < numCols) {
            cellValues[(row + 1) * numCols + (col + 1)] += error * (1 / 16);
          }
        }
      }
    }
  }
  
  function applyOrderedDithering(cellValues, numRows, numCols) {
    const bayerMatrix = [[0,2],[3,1]];
    const matrixSize = 2;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const index = row * numCols + col;
        const threshold = ((bayerMatrix[row % matrixSize][col % matrixSize] + 0.5) *
                           (255 / (matrixSize * matrixSize)));
        cellValues[index] = cellValues[index] < threshold ? 0 : 255;
      }
    }
  }
  
  function applyNoiseDithering(cellValues, numRows, numCols) {
    const threshold = 128;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const index = row * numCols + col;
        const noise = (Math.random() - 0.5) * 50;
        const adjustedVal = cellValues[index] + noise;
        cellValues[index] = adjustedVal < threshold ? 0 : 255;
      }
    }
  }
  
  resetButton.addEventListener('click', () => {
    gridSize.value = defaults.gridSize;
    brightness.value = defaults.brightness;
    contrast.value = defaults.contrast;
    gamma.value = defaults.gamma;
    smoothing.value = defaults.smoothing;
    ditherType.value = defaults.ditherType;
    updateAndProcess();
  });
  
  downloadButton.addEventListener('click', async () => {
    if (!imageElement && !videoElement) return;
    
    if (!isVideo) {
      // For images, directly download the canvas as PNG
      const link = document.createElement('a');
      link.href = halftoneCanvas.toDataURL('image/png');
      link.download = 'particles_image.png';
      link.click();
      return;
    }
    
    // Show progress panel for video processing
    progressPanel.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    frameInfo.textContent = '准备中...';
    
    // Pause video playback and reset to beginning
    videoElement.pause();
    videoElement.currentTime = 0;
    
    videoFps.addEventListener('input', (e) => {
      videoFpsVal.textContent = e.target.value;
    });
    const fps = parseInt(videoFps.value, 10);
    const duration = videoElement.duration;
    const totalFrames = Math.floor(duration * fps);
    
    // Create a canvas for recording
    const recordCanvas = document.createElement('canvas');
    const exportWidth = videoElement.videoWidth * 2;
    const exportHeight = videoElement.videoHeight * 2;
    recordCanvas.width = exportWidth;
    recordCanvas.height = exportHeight;
    
    // Set up MediaRecorder with optimized configuration
    const stream = recordCanvas.captureStream(fps);
    
    // Process each frame
    let currentFrame = 0;
    imageFiles = [];

    const processNextFrame = async () => {
      if (currentFrame >= totalFrames) {
        // mediaRecorder.stop();
        // zip.generateAsync({ type: "blob" }).then(function (content) {
        //   const link = document.createElement("a");
        //   link.href = URL.createObjectURL(content);
        //   link.download = "halftone_frames.zip";
        //   link.click();
        // });
        const videoBlob = await convertImagesToVideo(imageFiles, fps);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(videoBlob);
        link.download = 'particles_video.mp4';
        link.click();
        return;
      }
      
      // 使用精确的时间控制
      const frameTime = currentFrame / fps;
      videoElement.currentTime = frameTime;

      // if (Math.abs(videoElement.currentTime - frameTime) > 0.1) {
      //   videoElement.currentTime = frameTime;
      //   await new Promise(resolve => {
      //     const onSeeked = () => {
      //       videoElement.removeEventListener('seeked', onSeeked);
      //       resolve();
      //     };
      //     videoElement.addEventListener('seeked', onSeeked);
      //   });
      // }
      
      generateHalftone(recordCanvas, 2);
      imageFiles.push(recordCanvas.toDataURL("image/jpeg"));

      
      // 更新进度
      const progress = Math.floor((currentFrame + 1) / totalFrames * 50);
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;
      frameInfo.textContent = `正在处理帧: ${currentFrame + 1}/${totalFrames}`;
      
      currentFrame++;
      // 使用requestAnimationFrame直接处理下一帧，移除setTimeout
      // requestAnimationFrame(processNextFrame);
      // 使用 setTimeout 模拟下载的延迟
      setTimeout(() => {
          processNextFrame();
      }, 100); // 延迟100毫秒或根据需要调整
    };
    
    processNextFrame();
  });
  
  setupCanvasDimensions(800, 600);
  const ctx = halftoneCanvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, halftoneCanvas.width, halftoneCanvas.height);
  
  // Automatically load the default video.
  (function loadDefaultVideo() {
    const videoURL = "https://i.imgur.com/5PrJCc2.mp4";
    isVideo = true;
    videoElement = document.createElement('video');
    videoElement.crossOrigin = "anonymous";
    videoElement.playsInline = true;
    videoElement.setAttribute("webkit-playsinline", "true");
    videoElement.src = videoURL;
    videoElement.autoplay = true;
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.addEventListener('loadeddata', () => {
      setupCanvasDimensions(videoElement.videoWidth, videoElement.videoHeight);
      videoElement.play();
      processVideoFrame();
      downloadButton.style.display = 'block';
    });
    videoElement.addEventListener('error', (e) => {
      console.error("Error loading default video:", e);
    });
  })();
});