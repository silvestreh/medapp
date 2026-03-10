import { Application } from './declarations';
import logger from './logger';

function generateMobileHtml(token: string, apiBaseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Verificación de Identidad</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      color: #1a1a2e;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }

    /* Intro screen */
    .intro {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 32px 24px;
      max-width: 420px;
      margin: 0 auto;
      width: 100%;
    }
    .intro h1 { font-size: 24px; margin-bottom: 8px; }
    .intro .subtitle { color: #868e96; font-size: 15px; margin-bottom: 32px; }
    .intro-steps { list-style: none; margin-bottom: 40px; }
    .intro-steps li {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 0;
      border-bottom: 1px solid #f1f3f5;
    }
    .intro-steps li:last-child { border-bottom: none; }
    .intro-step-num {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: #e7f5ff;
      color: #228be6;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 15px;
      flex-shrink: 0;
    }
    .intro-step-text { font-size: 15px; }
    .intro-step-text strong { display: block; margin-bottom: 2px; }
    .intro-step-text span { color: #868e96; font-size: 13px; }

    /* Intermediate screen between steps */
    .intermediate {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px 24px;
      text-align: center;
      max-width: 420px;
      margin: 0 auto;
      width: 100%;
    }
    .intermediate .check-badge {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: #d3f9d8;
      color: #2b8a3e;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
      margin-bottom: 20px;
    }
    .intermediate h2 { font-size: 20px; margin-bottom: 8px; }
    .intermediate .next-label { color: #868e96; font-size: 14px; margin-bottom: 4px; }
    .intermediate .next-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .intermediate .next-desc { color: #868e96; font-size: 14px; margin-bottom: 32px; line-height: 1.5; }

    /* Full-screen camera */
    .camera-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #000;
      position: relative;
    }
    .camera-screen video {
      flex: 1;
      width: 100%;
      object-fit: cover;
    }
    .camera-top-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: calc(16px + env(safe-area-inset-top)) 20px 16px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
      z-index: 2;
    }
    .camera-step-label {
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .camera-title {
      color: #fff;
      font-size: 17px;
      font-weight: 600;
    }
    .camera-bottom-bar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 16px 20px calc(32px + env(safe-area-inset-bottom));
      background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      z-index: 2;
    }
    .camera-hint-text {
      color: #fff;
      font-size: 14px;
      text-align: center;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }
    .capture-btn {
      width: 72px; height: 72px;
      border-radius: 50%;
      border: 4px solid #fff;
      background: rgba(255,255,255,0.25);
      cursor: pointer;
      transition: background 0.15s;
    }
    .capture-btn:active { background: rgba(255,255,255,0.5); }
    .camera-secondary-actions {
      display: flex;
      gap: 16px;
    }
    .camera-secondary-actions button {
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      font-size: 13px;
      cursor: pointer;
      padding: 4px 8px;
    }
    .detect-pill {
      padding: 8px 20px;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 600;
    }
    .detect-pill.scanning {
      background: rgba(255,255,255,0.15);
      color: #fff;
      animation: pulse 1.5s ease-in-out infinite;
    }
    .detect-pill.detected {
      background: rgba(64,192,87,0.9);
      color: #fff;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    /* Preview screen */
    .preview-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #000;
    }
    .preview-screen img {
      flex: 1;
      width: 100%;
      object-fit: contain;
    }
    .preview-bar {
      display: flex;
      gap: 12px;
      padding: 16px 20px calc(32px + env(safe-area-inset-bottom));
      background: #000;
    }
    .preview-bar button {
      flex: 1;
      padding: 14px;
      border-radius: 10px;
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .preview-bar .btn-retake {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
    .preview-bar .btn-confirm {
      background: #228be6;
      color: #fff;
    }
    .preview-bar .btn-confirm:disabled {
      background: #555;
      color: #999;
    }
    .upload-indicator {
      text-align: center;
      color: #fff;
      font-size: 14px;
      padding: 8px;
      background: rgba(34,139,230,0.8);
    }

    /* Done screen */
    .done-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px 24px;
      text-align: center;
    }
    .done-screen .check-badge {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: #d3f9d8;
      color: #2b8a3e;
      display: flex; align-items: center; justify-content: center;
      font-size: 36px;
      margin-bottom: 20px;
    }
    .done-screen h2 { font-size: 22px; margin-bottom: 8px; }
    .done-screen p { color: #868e96; font-size: 15px; line-height: 1.5; }

    .btn {
      display: block; width: 100%; padding: 16px;
      border: none; border-radius: 10px;
      font-size: 16px; font-weight: 600;
      cursor: pointer; text-align: center;
    }
    .btn-primary { background: #228be6; color: #fff; }
    .btn-secondary { background: #e9ecef; color: #495057; margin-top: 12px; }
    .error-toast {
      position: fixed;
      bottom: 24px; left: 16px; right: 16px;
      background: #e03131;
      color: #fff;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      text-align: center;
      z-index: 100;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* No-camera fallback */
    .fallback-upload {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px 24px;
      text-align: center;
      max-width: 420px;
      margin: 0 auto;
      width: 100%;
    }
    .fallback-upload h2 { font-size: 20px; margin-bottom: 8px; }
    .fallback-upload p { color: #868e96; font-size: 14px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div id="app" style="flex:1;display:flex;flex-direction:column;"></div>

  <script>
    (function() {
      var TOKEN = ${JSON.stringify(token)};
      var API = ${JSON.stringify(apiBaseUrl)};

      // State
      var phase = 'intro'; // 'intro' | 'camera' | 'preview' | 'intermediate' | 'done'
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

      var steps = [
        {
          key: 'idFront',
          title: 'Frente del DNI',
          introTitle: 'Frente del DNI',
          introDesc: 'Foto del frente donde se vea tu cara y el código de barras',
          cameraHint: 'Encuadrá el frente del DNI',
          cameraHintAuto: 'Se captura automáticamente al detectar el código',
          nextTitle: 'Dorso del DNI',
          nextDesc: 'Ahora necesitamos una foto del dorso de tu DNI.',
          facing: 'environment',
          autoDetect: 'barcode'
        },
        {
          key: 'idBack',
          title: 'Dorso del DNI',
          introTitle: 'Dorso del DNI',
          introDesc: 'Foto del dorso donde se vea la información',
          cameraHint: 'Encuadrá el dorso del DNI y tocá el botón',
          cameraHintAuto: '',
          nextTitle: 'Selfie',
          nextDesc: 'Por último, necesitamos una selfie tuya mirando a la cámara.',
          facing: 'environment',
          autoDetect: 'none'
        },
        {
          key: 'selfie',
          title: 'Selfie',
          introTitle: 'Selfie',
          introDesc: 'Una foto tuya mirando a la cámara',
          cameraHint: 'Mirá a la cámara',
          cameraHintAuto: 'Se captura automáticamente al detectar tu cara',
          nextTitle: null,
          nextDesc: null,
          facing: 'user',
          autoDetect: 'face'
        }
      ];

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
          phase = 'preview';
          render();
        }, 'image/jpeg', 0.85);
      }

      function retake() {
        if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
        capturedBlob = null;
        capturedPreviewUrl = null;
        openCamera();
      }

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

          // Notify server
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
            await fetch(API + '/verification-sessions/by-token', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-session-token': TOKEN },
              body: JSON.stringify({
                status: 'uploading',
                [key + 'Url']: uploads[key].url,
              }),
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
        phase = 'preview';
        render();
      };

      function render() {
        var app = document.getElementById('app');
        var step = steps[currentStep];
        var html = '';

        // -- INTRO --
        if (phase === 'intro') {
          html += '<div class="intro">';
          html += '<h1>Verificación de Identidad</h1>';
          html += '<p class="subtitle">Necesitamos verificar tu identidad. El proceso dura menos de un minuto.</p>';
          html += '<ul class="intro-steps">';
          for (var i = 0; i < steps.length; i++) {
            html += '<li>';
            html += '<div class="intro-step-num">' + (i + 1) + '</div>';
            html += '<div class="intro-step-text"><strong>' + steps[i].introTitle + '</strong><span>' + steps[i].introDesc + '</span></div>';
            html += '</li>';
          }
          html += '</ul>';
          html += '<button class="btn btn-primary" onclick="window.__start()">Comenzar</button>';
          html += '</div>';
        }

        // -- INTERMEDIATE (between steps) --
        else if (phase === 'intermediate') {
          var prevStep = steps[currentStep - 1];
          html += '<div class="intermediate">';
          html += '<div class="check-badge">&#10003;</div>';
          html += '<h2>' + prevStep.title + ' lista</h2>';
          html += '<p class="next-label">Siguiente paso</p>';
          html += '<p class="next-title">' + step.title + '</p>';
          html += '<p class="next-desc">' + prevStep.nextDesc + '</p>';
          html += '<button class="btn btn-primary" onclick="window.__openCamera()">Continuar</button>';
          html += '</div>';
        }

        // -- CAMERA (full screen) --
        else if (phase === 'camera') {
          var isSelfie = step.facing === 'user';
          var hasAuto = canAutoDetect(step);
          var hint = hasAuto && autoDetectStatus === 'scanning' ? step.cameraHintAuto : step.cameraHint;

          if (cameraSupported) {
            html += '<div class="camera-screen">';
            html += '<video id="camera-video" autoplay playsinline muted' + (isSelfie ? ' style="transform:scaleX(-1)"' : '') + '></video>';
            html += '<div class="camera-top-bar">';
            html += '<div class="camera-step-label">Paso ' + (currentStep + 1) + ' de ' + steps.length + '</div>';
            html += '<div class="camera-title">' + step.title + '</div>';
            html += '</div>';
            html += '<div class="camera-bottom-bar">';
            html += '<div class="camera-hint-text">' + hint + '</div>';
            if (autoDetectStatus === 'detected') {
              html += '<div class="detect-pill detected">Detectado &#10003;</div>';
            } else if (autoDetectStatus === 'scanning') {
              html += '<div class="detect-pill scanning">Buscando...</div>';
            }
            html += '<button class="capture-btn" onclick="window.__capture()"></button>';
            html += '<div class="camera-secondary-actions">';
            html += '<input type="file" id="file-input" accept="image/*" capture="' + (isSelfie ? 'user' : 'environment') + '" style="display:none" onchange="window.__handleFile(this)">';
            html += '<button onclick="document.getElementById(\\'file-input\\').click()">Subir desde galería</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
          } else {
            // No camera fallback
            html += '<div class="fallback-upload">';
            html += '<h2>' + step.title + '</h2>';
            html += '<p>' + step.cameraHint + '</p>';
            html += '<input type="file" id="file-input" accept="image/*" capture="' + (isSelfie ? 'user' : 'environment') + '" style="display:none" onchange="window.__handleFile(this)">';
            html += '<button class="btn btn-primary" onclick="document.getElementById(\\'file-input\\').click()">Tomar foto</button>';
            html += '</div>';
          }
        }

        // -- PREVIEW --
        else if (phase === 'preview') {
          var isSelfiePreview = step.facing === 'user';
          html += '<div class="preview-screen">';
          if (uploading) {
            html += '<div class="upload-indicator">Subiendo foto...</div>';
          }
          html += '<img src="' + capturedPreviewUrl + '" alt="Preview"' + (isSelfiePreview ? '' : '') + '>';
          html += '<div class="preview-bar">';
          html += '<button class="btn-retake" onclick="window.__retake()"' + (uploading ? ' disabled' : '') + '>Volver a tomar</button>';
          html += '<button class="btn-confirm" onclick="window.__confirm()"' + (uploading ? ' disabled' : '') + '>' + (uploading ? 'Subiendo...' : 'Confirmar') + '</button>';
          html += '</div>';
          html += '</div>';
        }

        // -- DONE --
        else if (phase === 'done') {
          stopCamera();
          html += '<div class="done-screen">';
          html += '<div class="check-badge">&#10003;</div>';
          html += '<h2>¡Verificación enviada!</h2>';
          html += '<p>Ya podés volver a tu computadora. Te notificaremos cuando se complete la revisión.</p>';
          html += '</div>';
        }

        // Error toast
        if (error) {
          html += '<div class="error-toast">' + error + '</div>';
        }

        app.innerHTML = html;

        // Re-attach camera stream
        if (phase === 'camera' && cameraStream) {
          var video = document.getElementById('camera-video');
          if (video && !video.srcObject) {
            video.srcObject = cameraStream;
            video.play();
          }
        }
      }

      window.__start = function() {
        openCamera();
      };
      window.__openCamera = openCamera;
      window.__capture = captureFrame;
      window.__retake = retake;
      window.__confirm = confirmCapture;

      render();
    })();
  </script>
</body>
</html>`;
}

export function setupMobilePage(app: Application): void {
  const expressApp = app as any;

  expressApp.get('/verify/:token', async (req: any, res: any) => {
    try {
      // Wait for DB sync before querying
      await app.get('sequelizeSync');

      const { token } = req.params;
      const sequelize = app.get('sequelizeClient');
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token },
        raw: true,
      });

      if (!session) {
        return res.status(404).send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:sans-serif;text-align:center;padding:40px;}</style></head>
<body><h2>Sesión no encontrada</h2><p>El enlace no es válido o ya fue utilizado.</p></body></html>`);
      }

      if (new Date(session.expiresAt) < new Date()) {
        return res.status(410).send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:sans-serif;text-align:center;padding:40px;}</style></head>
<body><h2>Sesión expirada</h2><p>El enlace ha expirado. Generá uno nuevo desde tu computadora.</p></body></html>`);
      }

      if (session.status === 'completed') {
        return res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:sans-serif;text-align:center;padding:40px;}</style></head>
<body><h2>Verificación completada</h2><p>Ya podés volver a tu computadora.</p></body></html>`);
      }

      // Determine the base URL for API calls from the mobile page
      // Trust x-forwarded-proto from Railway's proxy
      const protocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
      const host = req.get('host');
      const apiBaseUrl = `${protocol}://${host}`;
      logger.info('[mobile-page] Serving page with API base: %s (x-fwd-proto: %s, req.protocol: %s)',
        apiBaseUrl, req.get('x-forwarded-proto'), req.protocol);

      const html = generateMobileHtml(token, apiBaseUrl);
      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      logger.error('[mobile-page] Error:', error.message);
      res.status(500).send('Internal server error');
    }
  });

  // PATCH endpoint for mobile to update session by token (REST, no feathers auth needed)
  expressApp.patch('/verification-sessions/by-token', async (req: any, res: any) => {
    try {
      const sessionToken = req.headers['x-session-token'];
      if (!sessionToken) {
        return res.status(401).json({ message: 'Missing session token' });
      }

      await app.get('sequelizeSync');

      const sequelize = app.get('sequelizeClient');
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token: sessionToken },
      });

      if (!session) {
        return res.status(403).json({ message: 'Invalid session token' });
      }

      if (new Date((session as any).expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Session has expired' });
      }

      const allowed = ['idFrontUrl', 'idBackUrl', 'selfieUrl', 'status'];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in req.body) {
          updates[key] = req.body[key];
        }
      }

      await session.update(updates);

      // Use internal feathers service call to trigger channel events
      const updated = await app.service('verification-sessions').patch(
        (session as any).id,
        updates,
        { provider: undefined } as any
      );

      res.json(updated);
    } catch (error: any) {
      logger.error('[mobile-page] PATCH error:', error.message);
      res.status(500).json({ message: error.message || 'Update failed' });
    }
  });
}
