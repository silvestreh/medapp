import { StepDef } from './steps';

export function generateAppScript(steps: StepDef[]): string {
  return `(function() {
  var TOKEN = window.__TOKEN;
  var API = window.__API;

  // State
  var phase = 'intro';
  var currentStep = 0;
  var uploads = { idFront: null, idBack: null, selfie: null };
  var uploading = false;
  var error = '';
  var errorTimer = null;
  var cameraStream = null;
  var capturedBlob = null;
  var capturedPreviewUrl = null;
  var cameraSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  var scanAnimationId = null;
  var autoDetectStatus = '';
  var previewValidation = '';

  var steps = ${JSON.stringify(steps)};

  // Collect device fingerprint at page load
  var deviceFingerprint = {
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    platform: navigator.platform || '',
    language: navigator.language || '',
    languages: navigator.languages ? Array.from(navigator.languages) : [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    timezoneOffset: new Date().getTimezoneOffset(),
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    colorDepth: screen.colorDepth || 0,
  };
  var fingerprintSent = false;

  // Feature detection
  var hasBarcodeDetector = typeof BarcodeDetector !== 'undefined';
  var hasFaceDetector = typeof FaceDetector !== 'undefined';
  var barcodeDetector = null;
  var faceDetector = null;

  if (hasBarcodeDetector) {
    try { barcodeDetector = new BarcodeDetector({ formats: ['pdf417'] }); } catch(e) { hasBarcodeDetector = false; }
  }
  if (hasFaceDetector) {
    try { faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); } catch(e) { hasFaceDetector = false; }
  }

  // --- Helpers ---

  function showError(msg) {
    if (errorTimer) clearTimeout(errorTimer);
    error = msg;
    render();
    errorTimer = setTimeout(function() { error = ''; render(); }, 5000);
  }

  function stopScanning() {
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
    }
    autoDetectStatus = '';
  }

  function stopCamera() {
    stopScanning();
    if (cameraStream) {
      cameraStream.getTracks().forEach(function(t) { t.stop(); });
      cameraStream = null;
    }
  }

  // --- Detection ---

  function detectTextLines(video) {
    var w = 320;
    var h = Math.round(w * video.videoHeight / video.videoWidth);
    if (h <= 0) return false;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    var startY = Math.floor(h * 0.55);
    var regionH = h - startY;
    if (regionH < 10) return false;
    var imgData = ctx.getImageData(0, startY, w, regionH);
    var data = imgData.data;

    var qualifyingRows = 0;
    var minRowWidth = Math.floor(w * 0.6);

    for (var y = 1; y < regionH - 1; y++) {
      var edgePixels = 0;
      var firstEdge = w;
      var lastEdge = 0;
      for (var x = 1; x < w - 1; x++) {
        var idx = (y * w + x) * 4;
        var gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        var idxAbove = ((y - 1) * w + x) * 4;
        var grayAbove = data[idxAbove] * 0.299 + data[idxAbove + 1] * 0.587 + data[idxAbove + 2] * 0.114;
        if (Math.abs(gray - grayAbove) > 40) {
          edgePixels++;
          if (x < firstEdge) firstEdge = x;
          if (x > lastEdge) lastEdge = x;
        }
      }
      var edgeSpan = lastEdge - firstEdge;
      var density = edgePixels / w;
      if (density > 0.12 && edgeSpan > minRowWidth) {
        qualifyingRows++;
      }
    }
    return qualifyingRows >= 6;
  }

  function canAutoDetect(step) {
    if (step.autoDetect === 'barcode') return hasBarcodeDetector && barcodeDetector;
    if (step.autoDetect === 'face') return hasFaceDetector && faceDetector;
    if (step.autoDetect === 'text') return true;
    return false;
  }

  function startAutoDetection() {
    var step = steps[currentStep];
    if (!step || !canAutoDetect(step)) return;

    autoDetectStatus = 'scanning';
    render();

    var video = document.getElementById('camera-video');
    if (!video || !video.videoWidth) {
      setTimeout(startAutoDetection, 200);
      return;
    }

    var consecutiveDetections = 0;
    var requiredDetections = step.autoDetect === 'text' ? 5 : 3;
    var frameSkip = 0;

    function scanFrame() {
      if (!cameraStream || capturedBlob) return;
      var video = document.getElementById('camera-video');
      if (!video || !video.videoWidth) {
        scanAnimationId = requestAnimationFrame(scanFrame);
        return;
      }

      if (step.autoDetect === 'text') {
        frameSkip++;
        if (frameSkip % 5 !== 0) {
          scanAnimationId = requestAnimationFrame(scanFrame);
          return;
        }
        var found = detectTextLines(video);
        if (!cameraStream || capturedBlob) return;
        if (found) {
          consecutiveDetections++;
          if (consecutiveDetections >= requiredDetections) {
            autoDetectStatus = 'detected';
            render();
            setTimeout(captureFrame, 300);
            return;
          }
        } else {
          consecutiveDetections = Math.max(0, consecutiveDetections - 1);
        }
        scanAnimationId = requestAnimationFrame(scanFrame);
      } else {
        var detector = step.autoDetect === 'face' ? faceDetector : barcodeDetector;
        detector.detect(video).then(function(results) {
          if (!cameraStream || capturedBlob) return;
          var hasValidResult = results && results.length > 0;
          if (hasValidResult && step.autoDetect === 'barcode') {
            hasValidResult = results[0].rawValue && results[0].rawValue.length > 50;
          }
          if (hasValidResult) {
            consecutiveDetections++;
            if (consecutiveDetections >= requiredDetections) {
              autoDetectStatus = 'detected';
              render();
              setTimeout(captureFrame, 300);
              return;
            }
          } else {
            consecutiveDetections = Math.max(0, consecutiveDetections - 1);
          }
          scanAnimationId = requestAnimationFrame(scanFrame);
        }).catch(function() {
          scanAnimationId = requestAnimationFrame(scanFrame);
        });
      }
    }
    scanAnimationId = requestAnimationFrame(scanFrame);
  }

  // --- Camera ---

  function openCamera() {
    var step = steps[currentStep];
    stopCamera();
    capturedBlob = null;
    capturedPreviewUrl = null;
    phase = 'camera';
    render();

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: step.facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    }).then(function(stream) {
      cameraStream = stream;
      requestAnimationFrame(function() {
        var video = document.getElementById('camera-video');
        if (video) {
          video.srcObject = stream;
          video.play().then(function() {
            startAutoDetection();
          });
        }
      });
    }).catch(function(err) {
      console.warn('Camera access failed:', err);
      cameraSupported = false;
      render();
    });
  }

  function captureFrame() {
    stopScanning();
    var video = document.getElementById('camera-video');
    if (!video) return;
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    var step = steps[currentStep];
    if (step && step.facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob(function(blob) {
      capturedBlob = blob;
      capturedPreviewUrl = URL.createObjectURL(blob);
      previewValidation = '';
      phase = 'preview';
      render();
      validatePreview();
    }, 'image/jpeg', 0.85);
  }

  // --- Preview validation ---

  function validatePreview() {
    var step = steps[currentStep];
    if (!step) return;

    if (step.key !== 'idFront') {
      previewValidation = 'valid';
      render();
      return;
    }

    if (!hasBarcodeDetector || !barcodeDetector) {
      previewValidation = 'valid';
      render();
      return;
    }

    previewValidation = 'validating';
    render();

    var img = new Image();
    img.onload = function() {
      barcodeDetector.detect(img).then(function(results) {
        var found = results && results.some(function(r) {
          return r.rawValue && r.rawValue.length > 50;
        });
        previewValidation = found ? 'valid' : 'invalid';
        render();
      }).catch(function() {
        previewValidation = 'valid';
        render();
      });
    };
    img.onerror = function() {
      previewValidation = 'valid';
      render();
    };
    img.src = capturedPreviewUrl;
  }

  function retake() {
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    capturedBlob = null;
    capturedPreviewUrl = null;
    previewValidation = '';
    openCamera();
  }

  // --- Upload ---

  async function confirmCapture() {
    if (!capturedBlob || uploading) return;
    var step = steps[currentStep];
    var key = step.key;
    uploading = true;
    render();

    try {
      var formData = new FormData();
      formData.append('file', capturedBlob, key + '.jpg');

      var resp = await fetch(API + '/upload', {
        method: 'POST',
        headers: { 'x-session-token': TOKEN },
        body: formData,
      });

      if (!resp.ok) {
        var errData = await resp.json().catch(function() { return {}; });
        throw new Error(errData.message || 'Upload failed');
      }

      var data = await resp.json();
      uploads[key] = { url: data.url, preview: capturedPreviewUrl };
      capturedBlob = null;
      capturedPreviewUrl = null;

      if (uploads.idFront && uploads.idBack && uploads.selfie) {
        await fetch(API + '/verification-sessions/by-token', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-session-token': TOKEN },
          body: JSON.stringify({
            status: 'completed',
            idFrontUrl: uploads.idFront.url,
            idBackUrl: uploads.idBack.url,
            selfieUrl: uploads.selfie.url,
          }),
        });
        phase = 'done';
      } else {
        var patchBody = {
            status: 'uploading',
            [key + 'Url']: uploads[key].url,
          };
        if (!fingerprintSent) {
          patchBody.deviceFingerprint = deviceFingerprint;
          fingerprintSent = true;
        }
        await fetch(API + '/verification-sessions/by-token', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-session-token': TOKEN },
          body: JSON.stringify(patchBody),
        });
        currentStep++;
        phase = 'intermediate';
      }
    } catch (e) {
      console.error('[mobile-upload] Upload error:', e);
      var msg = e.message || 'Error al subir la foto';
      if (msg === 'Load failed' || msg === 'Failed to fetch') {
        msg = 'No se pudo conectar con el servidor. Verificá tu conexión a internet.';
      }
      showError(msg);
    } finally {
      uploading = false;
      render();
    }
  }

  function compressImage(file) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var maxDim = 1280;
        var w = img.width;
        var h = img.height;
        if (w > maxDim || h > maxDim) {
          var ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', 0.85);
      };
      img.onerror = function() { resolve(file); };
      img.src = URL.createObjectURL(file);
    });
  }

  window.__handleFile = async function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    input.value = '';
    capturedBlob = await compressImage(file);
    capturedPreviewUrl = URL.createObjectURL(capturedBlob);
    previewValidation = '';
    phase = 'preview';
    render();
    validatePreview();
  };

  // --- Render ---

  function render() {
    var app = document.getElementById('app');
    var step = steps[currentStep];
    var html = '';

    if (phase === 'intro') {
      html += '<div class="flex-1 flex flex-col justify-center px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-[420px] mx-auto w-full">';
      html += '<h1 class="text-2xl font-bold mb-2">Verificación de Identidad</h1>';
      html += '<p class="text-gray-500 text-sm mb-8">Necesitamos verificar tu identidad. El proceso dura menos de un minuto.</p>';
      html += '<ul class="list-none mb-10">';
      for (var i = 0; i < steps.length; i++) {
        html += '<li class="flex items-center gap-4 py-4' + (i < steps.length - 1 ? ' border-b border-gray-100' : '') + '">';
        html += '<div class="w-9 h-9 rounded-full bg-primary-50 text-primary-400 flex items-center justify-center font-bold text-sm shrink-0">' + (i + 1) + '</div>';
        html += '<div class="text-sm"><strong class="block mb-0.5">' + steps[i].introTitle + '</strong><span class="text-gray-500 text-xs">' + steps[i].introDesc + '</span></div>';
        html += '</li>';
      }
      html += '</ul>';
      html += '<button class="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white" onclick="window.__start()">Comenzar</button>';
      html += '</div>';
    }

    else if (phase === 'intermediate') {
      var prevStep = steps[currentStep - 1];
      html += '<div class="flex-1 flex flex-col justify-center items-center px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center max-w-[420px] mx-auto w-full">';
      html += '<div class="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-3xl mb-5">&#10003;</div>';
      html += '<h2 class="text-xl font-bold mb-2">' + prevStep.title + ' lista</h2>';
      html += '<p class="text-gray-500 text-sm mb-1">Siguiente paso</p>';
      html += '<p class="text-lg font-semibold mb-2">' + step.title + '</p>';
      html += '<p class="text-gray-500 text-sm mb-8 leading-relaxed">' + prevStep.nextDesc + '</p>';
      html += '<button class="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white" onclick="window.__openCamera()">Continuar</button>';
      html += '</div>';
    }

    else if (phase === 'camera') {
      var isSelfie = step.facing === 'user';
      var hasAuto = canAutoDetect(step);
      var hint = hasAuto && autoDetectStatus === 'scanning' ? step.cameraHintAuto : step.cameraHint;

      if (cameraSupported) {
        html += '<div class="flex-1 flex flex-col bg-black relative">';
        html += '<video id="camera-video" autoplay playsinline muted class="flex-1 w-full object-cover"' + (isSelfie ? ' style="transform:scaleX(-1)"' : '') + '></video>';
        html += '<div class="absolute top-0 left-0 right-0 z-10" style="padding:calc(1rem + env(safe-area-inset-top)) 1.25rem 1rem;background:linear-gradient(to bottom,rgba(0,0,0,0.5),transparent)">';
        html += '<div class="text-white/70 text-xs uppercase tracking-widest mb-1">Paso ' + (currentStep + 1) + ' de ' + steps.length + '</div>';
        html += '<div class="text-white text-[17px] font-semibold">' + step.title + '</div>';
        html += '</div>';
        html += '<div class="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 z-10" style="padding:1rem 1.25rem calc(4rem + env(safe-area-inset-bottom));background:linear-gradient(to top,rgba(0,0,0,0.6),transparent)">';
        html += '<div class="text-white text-sm text-center" style="text-shadow:0 1px 3px rgba(0,0,0,0.5)">' + hint + '</div>';
        if (autoDetectStatus === 'detected') {
          html += '<div class="py-2 px-5 rounded-3xl text-sm font-semibold bg-green-500/90 text-white">Detectado &#10003;</div>';
        } else if (autoDetectStatus === 'scanning') {
          html += '<div class="py-2 px-5 rounded-3xl text-sm font-semibold bg-white/15 text-white animate-pulse">Buscando...</div>';
        }
        html += '<button class="w-[72px] h-[72px] rounded-full border-4 border-white bg-white/25 cursor-pointer active:bg-white/50" onclick="window.__capture()"></button>';
        if (!isSelfie) {
          html += '<div class="flex gap-4">';
          html += '<input type="file" id="file-input" accept="image/*" capture="environment" class="hidden" onchange="window.__handleFile(this)">';
          html += '<button class="bg-transparent border-none text-white/80 text-xs cursor-pointer py-1 px-2" onclick="document.getElementById(\\'file-input\\').click()">Subir desde galería</button>';
          html += '</div>';
        }
        html += '</div>';
        html += '</div>';
      } else {
        html += '<div class="flex-1 flex flex-col justify-center items-center px-6 py-8 text-center max-w-[420px] mx-auto w-full">';
        html += '<h2 class="text-xl font-bold mb-2">' + step.title + '</h2>';
        if (isSelfie) {
          html += '<p class="text-gray-500 text-sm">Se necesita acceso a la cámara para tomar la selfie. Por favor habilitá el acceso a la cámara en los ajustes de tu navegador.</p>';
        } else {
          html += '<p class="text-gray-500 text-sm mb-6">' + step.cameraHint + '</p>';
          html += '<input type="file" id="file-input" accept="image/*" capture="environment" class="hidden" onchange="window.__handleFile(this)">';
          html += '<button class="block w-full py-4 border-none rounded-xl text-base font-semibold cursor-pointer text-center bg-primary-400 text-white" onclick="document.getElementById(\\'file-input\\').click()">Tomar foto</button>';
        }
        html += '</div>';
      }
    }

    else if (phase === 'preview') {
      var isSelfiePreview = step.facing === 'user';
      var canConfirm = !uploading && previewValidation !== 'validating' && previewValidation !== 'invalid';
      html += '<div class="flex-1 flex flex-col bg-black" style="padding-top:calc(60px + env(safe-area-inset-top))">';
      if (uploading) {
        html += '<div class="fixed left-0 right-0 text-center text-white text-sm py-2 bg-primary-400/80 z-10" style="top:calc(60px + env(safe-area-inset-top))">Subiendo foto...</div>';
      }
      if (previewValidation === 'invalid') {
        html += '<div class="fixed left-0 right-0 text-center text-white text-sm py-3 px-5 bg-red-600 z-10 leading-snug" style="top:calc(60px + env(safe-area-inset-top))">No se detectó el código de barras del DNI. Volvé a tomar la foto asegurándote de que se vea el frente completo del documento.</div>';
      }
      html += '<img src="' + capturedPreviewUrl + '" alt="Preview" class="flex-1 w-full object-contain">';
      html += '<div class="fixed top-0 left-0 right-0 flex gap-3 z-10 bg-black/85" style="padding:calc(1rem + env(safe-area-inset-top)) 1.25rem 1rem">';
      html += '<button class="flex-1 py-3.5 rounded-xl border-none text-base font-semibold cursor-pointer bg-white/15 text-white" onclick="window.__retake()"' + (uploading ? ' disabled' : '') + '>Volver a tomar</button>';
      if (previewValidation === 'invalid') {
        html += '<button class="flex-1 py-3.5 rounded-xl border-none text-base font-semibold cursor-pointer bg-red-600 text-white" onclick="window.__retake()">Reintentar</button>';
      } else {
        var confirmLabel = uploading ? 'Subiendo...' : (previewValidation === 'validating' ? 'Verificando...' : 'Confirmar');
        html += '<button class="flex-1 py-3.5 rounded-xl border-none text-base font-semibold cursor-pointer bg-primary-400 text-white disabled:bg-gray-600 disabled:text-gray-400" onclick="window.__confirm()"' + (canConfirm ? '' : ' disabled') + '>' + confirmLabel + '</button>';
      }
      html += '</div>';
      html += '</div>';
    }

    else if (phase === 'done') {
      stopCamera();
      html += '<div class="flex-1 flex flex-col justify-center items-center px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center">';
      html += '<div class="w-[72px] h-[72px] rounded-full bg-green-100 text-green-700 flex items-center justify-center text-4xl mb-5">&#10003;</div>';
      html += '<h2 class="text-[22px] font-bold mb-2">¡Verificación enviada!</h2>';
      html += '<p class="text-gray-500 text-sm leading-relaxed">Ya podés volver a tu computadora. Te notificaremos cuando se complete la revisión.</p>';
      html += '</div>';
    }

    if (error) {
      html += '<div class="fixed bottom-6 left-4 right-4 bg-red-600 text-white py-3 px-4 rounded-xl text-sm text-center z-[100] animate-[slideUp_0.3s_ease]">' + error + '</div>';
    }

    app.innerHTML = html;

    if (phase === 'camera' && cameraStream) {
      var video = document.getElementById('camera-video');
      if (video && !video.srcObject) {
        video.srcObject = cameraStream;
        video.play();
      }
    }
  }

  window.__start = function() { openCamera(); };
  window.__openCamera = openCamera;
  window.__capture = captureFrame;
  window.__retake = retake;
  window.__confirm = confirmCapture;

  render();
})();`;
}
