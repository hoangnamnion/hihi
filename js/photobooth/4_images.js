// Lấy tham chiếu các phần tử DOM
const video = document.getElementById("video");
const captureBtn = document.getElementById("captureBtn");
const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadInput");
const exportBtn = document.getElementById("exportBtn");
const exportVideoBtn = document.getElementById("exportVideoBtn");
const previewImagesContainer = document.getElementById("previewImages");
const countdownEl = document.getElementById("countdown");
const spinner = document.getElementById("spinner");
const captureSound = document.getElementById("captureSound");
const captureCountSelect = document.getElementById("captureCount");
const captureTimeSelect = document.getElementById("captureTime");
const flipCamBtn = document.getElementById("flipCamBtn");
const switchCamBtn = document.getElementById("switchCamBtn");
const layoutTypeSelect = document.getElementById("layoutType");

// Tham chiếu chọn frame
const frameOptions = document.querySelectorAll("#frameOptions img");

// Modal elements
const videoExportModal = document.getElementById("videoExportModal");
const currentBalanceEl = document.getElementById("currentBalance");
const youtubeSignupBtn = document.getElementById("youtubeSignupBtn");
const hihiBtn = document.getElementById("hihiBtn");
const rechargeBtn = document.getElementById("rechargeBtn");
const confirmExportBtn = document.getElementById("confirmExportBtn");
const cancelExportBtn = document.getElementById("cancelExportBtn");

// Canvas preview
const templatePreviewCanvas = document.getElementById("templatePreview");
const previewCtx = templatePreviewCanvas.getContext("2d");

let userBalance = Number(document.getElementById('h1Balance').getAttribute("data-balance"));

// Mảng lưu ảnh và video; đối với ảnh upload, videoSegments sẽ chứa giá trị null
let photoData = [];
let videoSegments = [];

let mediaRecorder;
let recordedChunks = [];

// Quản lý flip và facing mode
let isFlipped = true;
let currentFacingMode = "user";

// Frame được chọn
let selectedFrameUrl = document.querySelector("#frameOptions img.selected").getAttribute("data-frame-url");

// Xử lý chọn frame
frameOptions.forEach(frameEl => {
  frameEl.addEventListener("click", () => {
    frameOptions.forEach(el => el.classList.remove("selected"));
    frameEl.classList.add("selected");
    selectedFrameUrl = frameEl.getAttribute("data-frame-url");
    updateTemplatePreview();
  });
});

// Hàm khởi tạo stream
async function startStream() {
  // 1. Tắt stream cũ
  if (window.stream) window.stream.getTracks().forEach(t => t.stop());

  // 2. Độ phân giải từ cao → thấp
  const RES_LEVELS = [
    { w: 4096, h: 2160 },  // 4K DCI
    { w: 3840, h: 2160 },  // 4K UHD
    { w: 2560, h: 1440 },  // QHD
    { w: 1920, h: 1080 },  // Full‑HD
    { w: 1280, h: 720  },  // HD
    { w: 640 , h: 480  }   // VGA
  ];

  let stream  = null;
  let lastErr = null;

  for (const { w, h } of RES_LEVELS) {
    const constraints = {
      video: {
        width :  { ideal: w },
        height:  { ideal: h },
        facingMode: currentFacingMode       // "user" | "environment"
      },
      audio: false
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(`> Đã mở camera ở ${w}×${h}`);
      break; // thành công
    } catch (err) {
      lastErr = err;

      /*  Nếu lỗi do thông số vượt quá khả năng (Overconstrained) **hoặc**
          lỗi khởi tạo nguồn (NotReadable) -> thử mức thấp hơn.
          Các lỗi khác (NotAllowed, NotFound...) -> dừng ngay.            */
      if (err.name === 'OverconstrainedError' || err.name === 'NotReadableError') {
        console.warn(`Không dùng được ${w}×${h}:`, err.name);
        continue; // thử độ phân giải tiếp theo
      }
      break;
    }
  }

  if (!stream) {
    console.error('Không thể truy cập camera:', lastErr);
    alert('Không truy cập được camera. Vui lòng kiểm tra:\n'
        + '• Quyền truy cập camera (biểu tượng ổ khóa trên thanh địa chỉ)\n'
        + '• Đảm bảo camera không bị ứng dụng khác sử dụng.');
    return;
  }

  /* ---------- hiển thị & khởi tạo MediaRecorder ---------- */
  window.stream      = stream;
  video.srcObject    = stream;
  video.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';

  let options = { mimeType: 'video/webm' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = MediaRecorder.isTypeSupported('video/mp4') ? { mimeType: 'video/mp4' } : {};
  }
  try {
    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size) recordedChunks.push(e.data);
    };
  } catch (e) {
    console.error('Lỗi tạo MediaRecorder:', e);
  }
}

startStream();   // gọi lần đầu

// Nút Lật Cam
flipCamBtn.addEventListener("click", () => {
  isFlipped = !isFlipped;
  video.style.transform = isFlipped ? "scaleX(-1)" : "scaleX(1)";
});

// Nút Đổi Cam
switchCamBtn.addEventListener("click", () => {
  currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
  startStream();
});

// Xử lý upload ảnh
uploadBtn.addEventListener("click", () => {
  uploadInput.click();
});

uploadInput.addEventListener("change", event => {
  const files = event.target.files;
  if (files.length) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataURL = e.target.result;
        // Lưu ảnh vào photoData và thêm null vào videoSegments
        photoData.push(dataURL);
        videoSegments.push(null); // Không có video cho ảnh upload
        // Tạo preview với flag upload
        const wrapper = document.createElement("div");
        wrapper.classList.add("preview-wrapper");
        const imgPreview = document.createElement("img");
        imgPreview.src = dataURL;
        // Gán data-upload="true"
        imgPreview.setAttribute("data-upload", "true");
        // Tạo marker upload
        const marker = document.createElement("div");
        marker.classList.add("upload-marker");
        marker.textContent = "UPLOAD";
        wrapper.appendChild(imgPreview);
        wrapper.appendChild(marker);
        // Gán sự kiện click cho wrapper để chọn/deselect
        wrapper.addEventListener("click", function () {
          wrapper.classList.toggle("selected");
          // Lưu ý: các ảnh upload không cần xuất video nên khi updateTemplatePreview chỉ cần dùng src
          updateTemplatePreview();
        });
        previewImagesContainer.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    });
    // Reset input sau khi đọc xong
    uploadInput.value = "";
  }
});

// Hàm capture từ camera
function capturePhotoCover() {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    alert("Video chưa sẵn sàng, hãy thử lại sau vài giây.");
    return null;
  }
  const desiredWidth = 500, desiredHeight = 350;
  const desiredAspect = desiredWidth / desiredHeight;
  const videoWidth = video.videoWidth, videoHeight = video.videoHeight;
  const videoAspect = videoWidth / videoHeight;
  let sx, sy, sWidth, sHeight;
  if (videoAspect > desiredAspect) {
    sHeight = videoHeight;
    sWidth = videoHeight * desiredAspect;
    sx = (videoWidth - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = videoWidth;
    sHeight = videoWidth / desiredAspect;
    sx = 0;
    sy = (videoHeight - sHeight) / 2;
  }
  const canvas = document.createElement("canvas");
  canvas.width = desiredWidth;
  canvas.height = desiredHeight;
  const ctx = canvas.getContext("2d");
  if (isFlipped) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, desiredWidth, desiredHeight);
    ctx.restore();
  } else {
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, desiredWidth, desiredHeight);
  }
  return canvas.toDataURL("image/png");
}

// PHẦN quay video từ camera
let videoRecorderController = null;
function startVideoSegmentRecording() {
  const desiredWidth = 500, desiredHeight = 350;
  const canvas = document.createElement("canvas");
  canvas.width = desiredWidth;
  canvas.height = desiredHeight;
  const ctx = canvas.getContext("2d");
  let animationFrameId;
  function drawFrame() {
    const videoWidth = video.videoWidth, videoHeight = video.videoHeight;
    if (videoWidth && videoHeight) {
      const desiredAspect = desiredWidth / desiredHeight;
      const videoAspect = videoWidth / videoHeight;
      let sx, sy, sWidth, sHeight;
      if (videoAspect > desiredAspect) {
        sHeight = videoHeight;
        sWidth = videoHeight * desiredAspect;
        sx = (videoWidth - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = videoWidth;
        sHeight = videoWidth / desiredAspect;
        sx = 0;
        sy = (videoHeight - sHeight) / 2;
      }
      if (isFlipped) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, desiredWidth, desiredHeight);
        ctx.restore();
      } else {
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, desiredWidth, desiredHeight);
      }
    }
    animationFrameId = requestAnimationFrame(drawFrame);
  }
  drawFrame();
  const stream = canvas.captureStream(30);
  let recorder, chunks = [];
  let options = { mimeType: "video/mp4;codecs=h264", videoBitsPerSecond: 300000 };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: "video/mp4", videoBitsPerSecond: 300000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 300000 };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm", videoBitsPerSecond: 300000 };
      }
    }
  }
  try {
    recorder = new MediaRecorder(stream, options);
  } catch (e) {
    cancelAnimationFrame(animationFrameId);
    console.error("Lỗi tạo MediaRecorder cho video segment:", e);
    return null;
  }
  recorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) { chunks.push(event.data); }
  };
  const stopPromise = new Promise((resolve, reject) => {
    recorder.onstop = () => {
      cancelAnimationFrame(animationFrameId);
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/mp4" });
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    };
    recorder.onerror = reject;
  });
  recorder.start();
  videoRecorderController = { recorder, stopPromise };
}

async function stopVideoSegmentRecording() {
  if (videoRecorderController && videoRecorderController.recorder.state === "recording") {
    videoRecorderController.recorder.stop();
    const videoData = await videoRecorderController.stopPromise;
    videoRecorderController = null;
    return videoData;
  }
  return null;
}

// HIỆU ỨNG FLASH VÀ COUNTDOWN
function flashScreen() {
  const flashDiv = document.createElement("div");
  flashDiv.style.position = "absolute";
  flashDiv.style.top = "0";
  flashDiv.style.left = "0";
  flashDiv.style.width = "100%";
  flashDiv.style.height = "100%";
  flashDiv.style.backgroundColor = "white";
  flashDiv.style.opacity = "1";
  flashDiv.style.zIndex = "10";
  flashDiv.style.pointerEvents = "none";
  video.parentNode.appendChild(flashDiv);
  setTimeout(() => flashDiv.remove(), 200);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Đếm ngược sử dụng hiệu ứng .countdown-circle
async function runCountdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    const circle = document.createElement("div");
    circle.classList.add("countdown-circle");
    circle.textContent = i;
    countdownEl.innerHTML = "";
    countdownEl.appendChild(circle);
    await sleep(1000);
  }
  countdownEl.innerHTML = "";
  flashScreen();
  captureSound.currentTime = 0;
  captureSound.play();
}

function showSpinner(message) {
  spinner.textContent = message;
  spinner.style.display = "flex";
}
function hideSpinner() {
  spinner.style.display = "none";
}
function updateModal() {
  currentBalanceEl.textContent = userBalance;
  confirmExportBtn.disabled = (userBalance < 2000);
}
function hideModal() {
  videoExportModal.style.display = "none";
}
async function refreshBalance() {
  try {
    const response = await fetch("/photobooth/4-images/balance");
    const data = await response.json();
    userBalance = data.balance;
    updateModal();
  } catch (err) {
    console.error("Lỗi cập nhật số dư:", err);
  }
}
setInterval(refreshBalance, 60000);

// Cập nhật canvas preview (chỉ dùng cho xuất ảnh)
function updateTemplatePreview() {
  const selectedImgElems = previewImagesContainer
        .querySelectorAll(".preview-wrapper.selected img, .preview-wrapper.selected > img");

  const layoutType = layoutTypeSelect.value;
  const requiredImages = layoutType === '1x4' ? 4 : 
                        layoutType === '1x3' ? 3 :
                        layoutType === '1x2' ? 2 : 6;

  if (selectedImgElems.length !== requiredImages) {
    previewCtx.clearRect(0, 0, templatePreviewCanvas.width, templatePreviewCanvas.height);
    return;
  }

  const scale = 0.5;
  const templateWidth = layoutType === '2x3' ? 1400 * scale : 600 * scale;
  const templateHeight = layoutType === '1x4' ? 1800 * scale :
                        layoutType === '1x3' ? 1350 * scale :
                        layoutType === '1x2' ? 900 * scale : 1350 * scale;
  const padding = 50 * scale;
  const gap = 50 * scale;
  const targetW = 500 * scale;
  const targetH = 350 * scale;

  templatePreviewCanvas.width = templateWidth;
  templatePreviewCanvas.height = templateHeight;
  previewCtx.clearRect(0, 0, templateWidth, templateHeight);

  // Vẽ ảnh theo bố cục đã chọn
  selectedImgElems.forEach((img, idx) => {
    let x, y;
    
    if (layoutType === '2x3') {
      // Bố cục 2x3: xếp 2 layout 1x3 cạnh nhau
      if (idx < 3) {
        // Layout 1x3 bên trái
        x = padding;
        y = padding + idx * (targetH + gap);
      } else {
        // Layout 1x3 bên phải, cách layout bên trái 50px
        x = padding + targetW + gap;
        y = padding + (idx - 3) * (targetH + gap);
      }
    } else {
      // Bố cục dọc (1x2, 1x3, 1x4)
      x = padding;
      y = padding + idx * (targetH + gap);
    }

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const iAsp = iw / ih;
    const tAsp = targetW / targetH;
    let sx, sy, sW, sH;

    if (iAsp > tAsp) { // ảnh quá rộng
      sH = ih;
      sW = ih * tAsp;
      sx = (iw - sW) / 2;
      sy = 0;
    } else {           // ảnh quá cao
      sW = iw;
      sH = iw / tAsp;
      sx = 0;
      sy = (ih - sH) / 2;
    }
    previewCtx.drawImage(img, sx, sy, sW, sH, x, y, targetW, targetH);
  });

  /* ---------- 2. VẼ FRAME ĐÈ LÊN ----------- */
  if (selectedFrameUrl) {
    const frameImg = new Image();
    frameImg.onload = () => {
      // Vẽ frame với kích thước phù hợp với template
      previewCtx.drawImage(frameImg, 0, 0, templateWidth, templateHeight);
      
      // Add date and time
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const datetimeStr = `${timeStr}, ${dateStr}`;
      
      // Set text style
      previewCtx.font = 'bold 16px Arial';
      previewCtx.fillStyle = 'white';
      previewCtx.textAlign = 'right';
      previewCtx.textBaseline = 'bottom';
      
      // Add text shadow for better visibility
      previewCtx.shadowColor = 'black';
      previewCtx.shadowBlur = 3;
      previewCtx.shadowOffsetX = 1;
      previewCtx.shadowOffsetY = 1;
      
      // Draw text in bottom right corner với padding riêng cho 2x3
      let textX = templateWidth - 20;
      let textY = templateHeight - 20;
      if (layoutType === '2x3') {
        textX = templateWidth - 40;
        textY = templateHeight - 40;
      }
      previewCtx.fillText(datetimeStr, textX, textY);
      
      // Reset shadow
      previewCtx.shadowColor = 'transparent';
      previewCtx.shadowBlur = 0;
      previewCtx.shadowOffsetX = 0;
      previewCtx.shadowOffsetY = 0;
    };
    frameImg.src = selectedFrameUrl;
  }
}

// Gán sự kiện click cho ảnh preview (cho cả upload và chụp từ camera)
function attachPreviewClick(wrapper) {
  wrapper.addEventListener("click", function () {
    const layoutType = layoutTypeSelect.value;
    const requiredImages = layoutType === '1x4' ? 4 : 
                          layoutType === '1x3' ? 3 :
                          layoutType === '1x2' ? 2 : 6;
    
    const currentSelected = previewImagesContainer.querySelectorAll(".preview-wrapper.selected").length;
    
    // Nếu wrapper đã được chọn, cho phép bỏ chọn
    if (wrapper.classList.contains("selected")) {
      wrapper.classList.remove("selected");
    } 
    // Nếu wrapper chưa được chọn và chưa đủ số lượng yêu cầu, cho phép chọn
    else if (currentSelected < requiredImages) {
      wrapper.classList.add("selected");
    }
    // Nếu đã đủ số lượng yêu cầu, thông báo
    else {
      alert(`Bố cục ${layoutType} chỉ cho phép chọn ${requiredImages} ảnh`);
      return;
    }
    
    updateTemplatePreview();
  });
}

// Thêm sự kiện khi thay đổi số lượng ảnh chụp
captureCountSelect.addEventListener("change", () => {
  // Không cần xóa ảnh hiện tại
  // Chỉ cập nhật số lượng ảnh sẽ chụp trong lần tiếp theo
});

// Thêm sự kiện khi thay đổi thời gian chụp
captureTimeSelect.addEventListener("change", () => {
  // Không cần xóa ảnh hiện tại
  // Chỉ cập nhật thời gian chụp trong lần tiếp theo
});

// Sự kiện chụp ảnh & quay video từ camera
captureBtn.addEventListener("click", async () => {
  // Không xóa photoData và videoSegments
  // Chỉ thêm ảnh mới vào mảng
  const captureCount = parseInt(captureCountSelect.value);
  const captureTime = parseInt(captureTimeSelect.value);
  captureBtn.disabled = true;
  for (let i = 0; i < captureCount; i++) {
    startVideoSegmentRecording();
    await runCountdown(captureTime);
    const photo = capturePhotoCover();
    const videoData = await stopVideoSegmentRecording();
    photoData.push(photo);
    videoSegments.push(videoData);
    // Tạo wrapper cho preview ảnh từ camera
    const wrapper = document.createElement("div");
    wrapper.classList.add("preview-wrapper");
    const imgPreview = document.createElement("img");
    imgPreview.src = photo;
    imgPreview.setAttribute("data-index", photoData.length - 1); // Sử dụng index mới
    wrapper.appendChild(imgPreview);
    attachPreviewClick(wrapper);
    previewImagesContainer.appendChild(wrapper);
  }
  captureBtn.disabled = false;
});

exportBtn.addEventListener("click", async () => {
  const selectedWrappers = previewImagesContainer.querySelectorAll(".preview-wrapper.selected");
  const layoutType = layoutTypeSelect.value;
  const requiredImages = layoutType === '1x4' ? 4 : 
                        layoutType === '1x3' ? 3 :
                        layoutType === '1x2' ? 2 : 6;

  if (selectedWrappers.length !== requiredImages) {
    alert(`Vui lòng chọn đúng ${requiredImages} ảnh để ghép`);
    return;
  }

  showSpinner();
  try {
    // Tạo canvas để ghép ảnh
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let width, height, padding, gap, targetW, targetH;
    if (layoutType === '2x3') {
      width = 1150;
      height = 1300;
      padding = 50;
      gap = 50;
      targetW = 500;
      targetH = 350;
    } else {
      width = 600;
      height = layoutType === '1x4' ? 1800 : layoutType === '1x3' ? 1350 : 900;
      padding = 50;
      gap = 50;
      targetW = 500;
      targetH = 350;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    // Vẽ ảnh theo bố cục đã chọn
    for (let i = 0; i < selectedWrappers.length; i++) {
      const wrapper = selectedWrappers[i];
      const img = wrapper.querySelector('img');
      let x, y;
      if (layoutType === '2x3') {
        // 2 cột, mỗi cột 3 video, mỗi video cách nhau 50px cả ngang và dọc
        const col = i % 2;
        const row = Math.floor(i / 2);
        x = padding + col * (targetW + gap);
        y = padding + row * (targetH + gap);
      } else {
        x = padding;
        y = padding + i * (targetH + gap);
      }
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const iAsp = iw / ih;
      const tAsp = targetW / targetH;
      let sx, sy, sW, sH;
      if (iAsp > tAsp) { // ảnh quá rộng
        sH = ih;
        sW = ih * tAsp;
        sx = (iw - sW) / 2;
        sy = 0;
      } else {           // ảnh quá cao
        sW = iw;
        sH = iw / tAsp;
        sx = 0;
        sy = (ih - sH) / 2;
      }
      ctx.drawImage(img, sx, sy, sW, sH, x, y, targetW, targetH);
    }

    // Vẽ frame nếu có
    if (selectedFrameUrl) {
      const frameImg = new Image();
      frameImg.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        frameImg.onload = resolve;
        frameImg.onerror = reject;
        frameImg.src = selectedFrameUrl;
      });
      ctx.drawImage(frameImg, 0, 0, width, height);

      // Thêm ngày và giờ
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const datetimeStr = `${timeStr}, ${dateStr}`;
      
      // Set text style
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      
      // Add text shadow for better visibility
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      // Draw text in bottom right corner với padding riêng cho 2x3
      let textX = width - 40;
      let textY = height - 40;
      ctx.fillText(datetimeStr, textX, textY);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Tạo link tải xuống
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `photobooth-${layoutType}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    hideSpinner();
  } catch (error) {
    hideSpinner();
    console.error("Lỗi khi ghép ảnh:", error);
    alert("Có lỗi xảy ra khi ghép ảnh: " + error.message);
  }
});

// Khi xuất video, trước tiên kiểm tra xem có ảnh nào được upload (không có video) không
exportVideoBtn.addEventListener("click", async () => {
  const selectedWrappers = previewImagesContainer.querySelectorAll(".preview-wrapper.selected");
  const layoutType = layoutTypeSelect.value;
  const requiredImages = layoutType === '1x4' ? 4 : 
                        layoutType === '1x3' ? 3 :
                        layoutType === '1x2' ? 2 : 6;

  if (selectedWrappers.length === 0) {
    alert("Vui lòng chọn ít nhất 1 video để xuất");
    return;
  }

  // Kiểm tra xem có ảnh nào có thuộc tính data-upload hay không
  const hasUpload = Array.from(selectedWrappers).some(wrapper => {
    const img = wrapper.querySelector("img");
    return img.getAttribute("data-upload") === "true";
  });
  if (hasUpload) {
    alert("Có ảnh được upload không có video. Vui lòng chọn lại hoặc chụp ảnh mới để xuất video.");
    return;
  }
  updateModal();
  videoExportModal.style.display = "flex";
});

confirmExportBtn.addEventListener("click", async () => {
  const selectedWrappers = previewImagesContainer.querySelectorAll(".preview-wrapper.selected");
  const layoutType = layoutTypeSelect.value;
  const requiredImages = layoutType === '1x4' ? 4 : 
                        layoutType === '1x3' ? 3 :
                        layoutType === '1x2' ? 2 : 6;

  if (selectedWrappers.length === 0) {
    alert("Vui lòng chọn ít nhất 1 video để xuất");
    return;
  }

  showSpinner();
  try {
    // Tạo canvas để ghép video
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 1;
    const width = layoutType === '2x3' ? 1100 * scale : 600 * scale;
    const height = layoutType === '2x3' ? 1200 * scale : 
                  layoutType === '1x4' ? 1800 * scale :
                  layoutType === '1x3' ? 1350 * scale : 900 * scale;
    const padding = 50 * scale;
    const gap = 50 * scale;
    const targetW = 500 * scale;
    const targetH = 350 * scale;

    canvas.width = width;
    canvas.height = height;

    // Lấy danh sách video đã chọn
    const selectedVideos = Array.from(selectedWrappers).map(wrapper => {
      const img = wrapper.querySelector('img');
      const index = img.getAttribute('data-index');
      return videoSegments[index];
    });

    // Tạo video elements để phát video
    const videos = selectedVideos.map(() => {
      const video = document.createElement('video');
      video.style.display = 'none';
      document.body.appendChild(video);
      return video;
    });

    // Tải frame image
    const frameImage = new Image();
    frameImage.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      frameImage.onload = resolve;
      frameImage.onerror = reject;
      frameImage.src = selectedFrameUrl;
    });

    // Kiểm tra codec được hỗ trợ
    let mimeType = 'video/mp4;codecs=h264';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            throw new Error('Trình duyệt không hỗ trợ ghi video');
          }
        }
      }
    }

    // Tạo MediaRecorder để ghi lại video
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 3000000
    });

    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    
    // Bắt đầu ghi
    recorder.start();

    // Tải tất cả video
    await Promise.all(videos.map((video, i) => {
      video.src = selectedVideos[i];
      return new Promise(resolve => {
        video.onloadeddata = resolve;
      });
    }));

    // Phát và ghi video (lặp lại 3 lần)
    for (let repeat = 0; repeat < 3; repeat++) {
      // Reset tất cả video về đầu
      videos.forEach(video => {
        video.currentTime = 0;
      });

      // Phát tất cả video cùng lúc
      videos.forEach(video => video.play());

      // Vẽ frame và ghi lại
      const drawFrame = () => {
        ctx.clearRect(0, 0, width, height);
        
        // Vẽ các video theo bố cục đã chọn
        videos.forEach((video, i) => {
          let x, y;
          if (layoutType === '2x3') {
            // 2 cột, mỗi cột 3 video, mỗi video cách nhau 50px cả ngang và dọc
            const col = i % 2;
            const row = Math.floor(i / 2);
            x = padding + col * (targetW + gap);
            y = padding + row * (targetH + gap);
          } else {
            x = padding;
            y = padding + i * (targetH + gap);
          }
          ctx.drawImage(video, x, y, targetW, targetH);
        });

        // Vẽ frame lên trên cùng
        ctx.drawImage(frameImage, 0, 0, width, height);

        // Thêm ngày và giờ
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const datetimeStr = `${timeStr}, ${dateStr}`;
        
        // Set text style
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        // Add text shadow for better visibility
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        // Draw text in bottom right corner với padding riêng cho 2x3
        let textX = width - 40;
        let textY = height - 40;
        ctx.fillText(datetimeStr, textX, textY);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      };

      // Đợi cho đến khi tất cả video kết thúc
      await new Promise(resolve => {
        const interval = setInterval(drawFrame, 1000/30);
        const checkEnded = () => {
          if (videos.every(video => video.ended)) {
            clearInterval(interval);
            resolve();
          }
        };
        videos.forEach(video => {
          video.onended = checkEnded;
        });
      });
    }

    // Dừng ghi và tạo blob
    recorder.stop();
    await new Promise(resolve => {
      recorder.onstop = resolve;
    });

    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Tạo link tải xuống
    const link = document.createElement('a');
    link.href = url;
    link.download = `photobooth-${layoutType}.mp4`;
    link.type = 'video/mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Dọn dẹp
    URL.revokeObjectURL(url);
    videos.forEach(video => document.body.removeChild(video));
    hideSpinner();
  } catch (error) {
    hideSpinner();
    console.error("Lỗi khi ghép video:", error);
    alert("Có lỗi xảy ra khi ghép video: " + error.message);
  }
});

cancelExportBtn.addEventListener("click", () => {
  hideModal();
});

youtubeSignupBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/photobooth/4-images/youtube-signup", { method: "POST" });
    const result = await response.json();
    if (result.success) {
      userBalance = result.newBalance;
      window.open("https://www.tiktok.com/@nam_26th4", "_blank");
      alert("Đăng ký Tiktok thành công! Số dư đã được cộng thêm 10000 đồng.");
      updateModal();
    } else {
      alert(result.message || "Có lỗi khi đăng ký Youtube.");
    }
  } catch (error) {
    console.error(error);
    alert("Có lỗi khi đăng ký Youtube.");
  }
});

hihiBtn.addEventListener("click", () => {
  window.open("https://www.facebook.com/cao.vannam.26042k5", "_blank");
});

rechargeBtn.addEventListener("click", () => {
  window.location.href = "/ung-ho";
});

// Thêm sự kiện khi thay đổi layout type
layoutTypeSelect.addEventListener("change", () => {
  const layoutType = layoutTypeSelect.value;
  const requiredImages = layoutType === '1x4' ? 4 : 
                        layoutType === '1x3' ? 3 :
                        layoutType === '1x2' ? 2 : 6;
  
  const selectedWrappers = previewImagesContainer.querySelectorAll(".preview-wrapper.selected");
  const currentSelected = selectedWrappers.length;
  
  // Nếu số lượng ảnh đã chọn nhiều hơn yêu cầu, bỏ chọn các ảnh thừa
  if (currentSelected > requiredImages) {
    // Bỏ chọn từ ảnh cuối cùng
    for (let i = currentSelected - 1; i >= requiredImages; i--) {
      selectedWrappers[i].classList.remove("selected");
    }
  }
  
  // Cập nhật preview khi thay đổi layout
  updateTemplatePreview();
});

// Thêm nút xóa ảnh đã chọn
const deleteBtn = document.createElement('button');
deleteBtn.className = 'function-button';
deleteBtn.textContent = 'Xóa ảnh đã chọn';
deleteBtn.style.margin = '10px auto';
deleteBtn.style.display = 'block';

// Thêm nút vào container
const buttonContainer = document.querySelector('.cute-container');
buttonContainer.insertBefore(deleteBtn, document.getElementById('templatePreviewContainer'));

// Xử lý sự kiện xóa ảnh
deleteBtn.addEventListener('click', () => {
  const selectedWrappers = previewImagesContainer.querySelectorAll('.preview-wrapper.selected');
  if (selectedWrappers.length === 0) {
    alert('Vui lòng chọn ảnh cần xóa');
    return;
  }

  if (!confirm('Bạn có chắc chắn muốn xóa các ảnh đã chọn?')) {
    return;
  }

  selectedWrappers.forEach(wrapper => {
    const img = wrapper.querySelector('img');
    const index = img.getAttribute('data-index');
    if (index !== null) {
      // Xóa ảnh và video tương ứng
      photoData.splice(index, 1);
      videoSegments.splice(index, 1);
      // Cập nhật lại index cho các ảnh còn lại
      previewImagesContainer.querySelectorAll('img').forEach(img => {
        const currentIndex = parseInt(img.getAttribute('data-index'));
        if (currentIndex > index) {
          img.setAttribute('data-index', currentIndex - 1);
        }
      });
    }
    wrapper.remove();
  });

  updateTemplatePreview();
});

// Thêm nút xóa tất cả ảnh
const deleteAllBtn = document.createElement('button');
deleteAllBtn.className = 'function-button';
deleteAllBtn.textContent = 'Xóa tất cả ảnh';
deleteAllBtn.style.margin = '10px auto';
deleteAllBtn.style.display = 'block';

// Thêm nút vào container
buttonContainer.insertBefore(deleteAllBtn, deleteBtn);

// Xử lý sự kiện xóa tất cả ảnh
deleteAllBtn.addEventListener('click', () => {
  if (previewImagesContainer.children.length === 0) {
    alert('Không có ảnh nào để xóa');
    return;
  }

  if (!confirm('Bạn có chắc chắn muốn xóa tất cả ảnh?')) {
    return;
  }

  // Xóa tất cả ảnh và video
  photoData = [];
  videoSegments = [];
  previewImagesContainer.innerHTML = '';
  updateTemplatePreview();
});