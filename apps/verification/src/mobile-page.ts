import { Application } from './declarations';
import logger from './logger';

function generateMobileHtml(token: string, apiBaseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Verificación de Identidad</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      color: #1a1a2e;
      min-height: 100vh;
      padding: 16px;
    }
    .container { max-width: 420px; margin: 0 auto; }
    h1 { font-size: 20px; text-align: center; margin: 16px 0; }
    .step {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      border: 2px solid #e9ecef;
      transition: border-color 0.2s;
    }
    .step.active { border-color: #228be6; }
    .step.done { border-color: #40c057; background: #f8fff8; }
    .step-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .step-number {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: #e9ecef;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px;
    }
    .step.active .step-number { background: #228be6; color: #fff; }
    .step.done .step-number { background: #40c057; color: #fff; }
    .step-title { font-weight: 600; font-size: 16px; }
    .step-desc { font-size: 13px; color: #868e96; margin-bottom: 12px; }
    .preview { width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; margin-top: 8px; }
    .btn {
      display: block; width: 100%; padding: 14px;
      border: none; border-radius: 8px;
      font-size: 16px; font-weight: 600;
      cursor: pointer; text-align: center;
    }
    .btn-primary { background: #228be6; color: #fff; }
    .btn-primary:disabled { background: #adb5bd; cursor: not-allowed; }
    .btn-outline { background: #fff; color: #228be6; border: 2px solid #228be6; margin-top: 8px; }
    .btn-secondary { background: #e9ecef; color: #495057; margin-top: 8px; }
    .btn-danger { background: #fff; color: #e03131; border: 2px solid #e03131; margin-top: 8px; }
    .done-screen {
      text-align: center; padding: 40px 20px;
      background: #fff; border-radius: 12px;
    }
    .done-screen .checkmark { font-size: 64px; margin-bottom: 16px; }
    .done-screen h2 { margin-bottom: 8px; }
    .done-screen p { color: #868e96; }
    .error { color: #e03131; font-size: 13px; text-align: center; margin-top: 8px; }

    /* Camera viewfinder */
    .camera-container {
      position: relative;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      margin-bottom: 12px;
    }
    .camera-container video {
      width: 100%;
      display: block;
    }
    .camera-container canvas { display: none; }
    .camera-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 16px;
      pointer-events: none;
    }
    .capture-btn {
      pointer-events: all;
      width: 64px; height: 64px;
      border-radius: 50%;
      border: 4px solid #fff;
      background: rgba(255,255,255,0.3);
      cursor: pointer;
      transition: background 0.15s;
    }
    .capture-btn:active { background: rgba(255,255,255,0.6); }
    .camera-hint {
      position: absolute;
      top: 12px; left: 0; right: 0;
      text-align: center;
      color: #fff;
      font-size: 13px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    }
    .preview-container { position: relative; }
    .preview-container img {
      width: 100%;
      border-radius: 8px;
      display: block;
    }
    .preview-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .preview-actions .btn { flex: 1; }
    .uploading-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.8);
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px;
      font-weight: 600; color: #228be6;
    }
    .detect-overlay {
      position: absolute;
      bottom: 80px; left: 50%;
      transform: translateX(-50%);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      pointer-events: none;
      z-index: 2;
    }
    .detect-overlay.scanning {
      background: rgba(0,0,0,0.5);
      color: #fff;
      animation: pulse 1.5s ease-in-out infinite;
    }
    .detect-overlay.detected {
      background: rgba(64,192,87,0.9);
      color: #fff;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Verificación de Identidad</h1>
    <div id="app"></div>
  </div>

  <script>
    (function() {
      var TOKEN = ${JSON.stringify(token)};
      var API = ${JSON.stringify(apiBaseUrl)};
      var currentStep = 0;
      var uploads = { idFront: null, idBack: null, selfie: null };
      var uploading = false;
      var error = '';
      var cameraStream = null;
      var capturedBlob = null;
      var capturedPreviewUrl = null;
      var cameraSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      var scanAnimationId = null;
      var autoDetectStatus = ''; // '', 'scanning', 'detected'

      // Feature detection for auto-scan APIs
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
        { key: 'idFront', title: 'Frente del DNI', desc: 'Enfocá el frente de tu DNI', descAuto: 'Apuntá al frente del DNI — se captura automáticamente', facing: 'environment', autoDetect: 'barcode' },
        { key: 'idBack', title: 'Dorso del DNI', desc: 'Enfocá el dorso de tu DNI', descAuto: 'Apuntá al dorso del DNI — se captura automáticamente', facing: 'environment', autoDetect: 'text' },
        { key: 'selfie', title: 'Selfie', desc: 'Mirá a la cámara para tu selfie', descAuto: 'Mirá a la cámara — se captura automáticamente', facing: 'user', autoDetect: 'face' },
      ];

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

      // Detect MRZ-like text on the ID back by looking for multiple
      // full-width rows of high-contrast text in the bottom 40% of the frame.
      // Requires at least 6 qualifying rows (MRZ has 3 lines, each ~2-3px tall at scale).
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
        if (step.autoDetect === 'text') return true; // canvas-based, always available
        return false;
      }

      function startAutoDetection() {
        var step = steps[currentStep];
        if (!step || !canAutoDetect(step)) return;

        autoDetectStatus = 'scanning';
        render();

        var video = document.getElementById('camera-video');
        if (!video || !video.videoWidth) {
          // Wait for video to be ready
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

          // For text detection, skip frames (it's CPU-intensive on canvas)
          if (step.autoDetect === 'text') {
            frameSkip++;
            if (frameSkip % 5 !== 0) {
              scanAnimationId = requestAnimationFrame(scanFrame);
              return;
            }
          }

          if (step.autoDetect === 'text') {
            // Canvas-based MRZ detection
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
              consecutiveDetections = Math.max(0, consecutiveDetections - 1); // decay slowly
            }
            scanAnimationId = requestAnimationFrame(scanFrame);
          } else {
            // BarcodeDetector or FaceDetector
            var detector = step.autoDetect === 'face' ? faceDetector : barcodeDetector;

            detector.detect(video).then(function(results) {
              if (!cameraStream || capturedBlob) return;

              // For barcode: require PDF417 payload (>50 chars) to avoid triggering on small QR codes
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

      function startCamera(facingMode) {
        stopCamera();
        capturedBlob = null;
        capturedPreviewUrl = null;

        return navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false
        }).then(function(stream) {
          cameraStream = stream;
          // Attach to video element after render
          requestAnimationFrame(function() {
            var video = document.getElementById('camera-video');
            if (video) {
              video.srcObject = stream;
              video.play().then(function() {
                // Start auto-detection once video is playing
                startAutoDetection();
              });
            }
          });
          return true;
        }).catch(function(err) {
          console.warn('Camera access failed:', err);
          return false;
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
        // Mirror selfie horizontally
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
          render();
        }, 'image/jpeg', 0.85);
      }

      function retake() {
        if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
        capturedBlob = null;
        capturedPreviewUrl = null;
        var step = steps[currentStep];
        if (step && cameraSupported) {
          startCamera(step.facing).then(function(ok) {
            if (!ok) cameraSupported = false;
            render();
          });
        } else {
          render();
        }
      }

      async function confirmCapture() {
        if (!capturedBlob) return;
        var key = steps[currentStep].key;
        uploading = true;
        error = '';
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

          if (currentStep < steps.length - 1) {
            currentStep++;
          }

          // Notify the server
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
          } else {
            await fetch(API + '/verification-sessions/by-token', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-session-token': TOKEN },
              body: JSON.stringify({
                status: 'uploading',
                [key + 'Url']: uploads[key].url,
              }),
            });
          }
        } catch (e) {
          console.error('[mobile-upload] Upload error:', e);
          var msg = e.message || 'Error al subir la foto';
          if (msg === 'Load failed' || msg === 'Failed to fetch') {
            msg = 'No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá de nuevo.';
          }
          error = msg + ' (API: ' + API + ')';
        } finally {
          uploading = false;
          render();
          // Start camera for next step if needed
          var nextStep = steps[currentStep];
          if (nextStep && !uploads[nextStep.key] && cameraSupported) {
            startCamera(nextStep.facing).then(function(ok) {
              if (!ok) { cameraSupported = false; render(); }
            });
          }
        }
      }

      // Fallback: handle file input for devices where camera API fails
      window.__handleFile = async function(key, input) {
        var file = input.files && input.files[0];
        if (!file) return;
        input.value = '';
        capturedBlob = file;
        capturedPreviewUrl = URL.createObjectURL(file);
        render();
      };

      function render() {
        var app = document.getElementById('app');
        if (uploads.idFront && uploads.idBack && uploads.selfie) {
          stopCamera();
          app.innerHTML =
            '<div class="done-screen">' +
              '<div class="checkmark">✅</div>' +
              '<h2>¡Listo!</h2>' +
              '<p>Ya podés volver a tu computadora. La verificación se completó exitosamente.</p>' +
            '</div>';
          return;
        }

        var html = '';
        for (var i = 0; i < steps.length; i++) {
          var s = steps[i];
          var isDone = !!uploads[s.key];
          var isActive = i === currentStep && !isDone;
          var cls = isDone ? 'step done' : (isActive ? 'step active' : 'step');

          html += '<div class="' + cls + '">';
          html += '<div class="step-header">';
          html += '<div class="step-number">' + (isDone ? '✓' : (i + 1)) + '</div>';
          html += '<div class="step-title">' + s.title + '</div>';
          html += '</div>';

          if (isActive) {
            var useAutoDesc = canAutoDetect(s) && autoDetectStatus === 'scanning';
            html += '<p class="step-desc">' + (useAutoDesc ? s.descAuto : s.desc) + '</p>';

            if (capturedPreviewUrl) {
              // Show captured photo preview with confirm/retake
              html += '<div class="preview-container">';
              html += '<img src="' + capturedPreviewUrl + '" alt="Preview">';
              if (uploading) {
                html += '<div class="uploading-overlay">Subiendo...</div>';
              }
              html += '</div>';
              if (!uploading) {
                html += '<div class="preview-actions">';
                html += '<button class="btn btn-danger" onclick="window.__retake()">Volver a tomar</button>';
                html += '<button class="btn btn-primary" onclick="window.__confirm()">Confirmar</button>';
                html += '</div>';
              }
            } else if (cameraSupported && cameraStream) {
              // Live camera viewfinder
              html += '<div class="camera-container">';
              html += '<video id="camera-video" autoplay playsinline muted' + (s.facing === 'user' ? ' style="transform:scaleX(-1)"' : '') + '></video>';
              // Show detection status overlay
              if (autoDetectStatus === 'detected') {
                html += '<div class="detect-overlay detected">Detectado ✓</div>';
              } else if (autoDetectStatus === 'scanning') {
                html += '<div class="detect-overlay scanning">Buscando...</div>';
              }
              html += '<div class="camera-overlay">';
              html += '<button class="capture-btn" onclick="window.__capture()" title="Captura manual"></button>';
              html += '</div>';
              html += '<div class="camera-hint">' + (useAutoDesc ? s.descAuto : s.desc) + '</div>';
              html += '</div>';
              // Fallback option
              html += '<input type="file" id="file-' + s.key + '" accept="image/*" capture="' + (s.facing === 'user' ? 'user' : 'environment') + '" style="display:none" onchange="window.__handleFile(\\'' + s.key + '\\', this)">';
              html += '<button class="btn btn-secondary" onclick="document.getElementById(\\'file-' + s.key + '\\').click()">Subir desde galería</button>';
            } else {
              // No camera: file input fallback
              html += '<input type="file" id="file-' + s.key + '" accept="image/*" capture="' + (s.facing === 'user' ? 'user' : 'environment') + '" style="display:none" onchange="window.__handleFile(\\'' + s.key + '\\', this)">';
              html += '<button class="btn btn-primary" onclick="document.getElementById(\\'file-' + s.key + '\\').click()" ' + (uploading ? 'disabled' : '') + '>';
              html += 'Tomar foto';
              html += '</button>';
            }

            if (error) {
              html += '<p class="error">' + error + '</p>';
            }
          }

          if (isDone && uploads[s.key].preview) {
            html += '<img class="preview" src="' + uploads[s.key].preview + '" alt="' + s.title + '">';
          }

          html += '</div>';
        }

        app.innerHTML = html;

        // Re-attach camera stream to video element if it exists
        if (cameraStream && !capturedPreviewUrl) {
          var video = document.getElementById('camera-video');
          if (video && !video.srcObject) {
            video.srcObject = cameraStream;
            video.play();
          }
        }
      }

      window.__capture = captureFrame;
      window.__retake = retake;
      window.__confirm = confirmCapture;

      // Initialize: try to start camera for first step
      if (cameraSupported) {
        startCamera(steps[0].facing).then(function(ok) {
          if (!ok) cameraSupported = false;
          render();
        });
      } else {
        render();
      }
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
