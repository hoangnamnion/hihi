let video = document.getElementById('video');
let captureBtn = document.getElementById('captureBtn');
let downloadCollageBtn = document.getElementById('downloadCollage');
let downloadVideoBtn = document.getElementById('downloadVideo');
let statusDiv = document.getElementById('status');
let countdownDiv = document.getElementById('countdown');
let loadingDiv = document.getElementById('loading');
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
let photoCount = 0;
let captureInterval;
let countdownInterval;
let videoChunks = [[], [], [], []]; // Array to store chunks for each video
let currentVideoIndex = 0;

// Get user media
async function setupCamera() {
    try {
        showStatus('Initializing camera...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        video.srcObject = stream;
        showStatus('Camera ready');
        captureBtn.disabled = false;
    } catch (err) {
        console.error('Error accessing camera:', err);
        showStatus('Error: Camera access denied', true);
        alert('Error accessing camera. Please make sure you have granted camera permissions.');
    }
}

// Show status message
function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.backgroundColor = isError ? 'rgba(231, 76, 60, 0.9)' : 'rgba(0, 0, 0, 0.7)';
}

// Show/hide loading spinner
function showLoading(show) {
    loadingDiv.classList.toggle('active', show);
}

// Update countdown display
function updateCountdown(seconds) {
    countdownDiv.textContent = seconds > 0 ? `Next capture in ${seconds}s` : 'Capturing...';
}

// Start recording a new video
function startNewVideo() {
    const stream = video.srcObject;
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            videoChunks[currentVideoIndex].push(e.data);
        }
    };

    mediaRecorder.start();
}

// Stop current video recording
function stopCurrentVideo() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

// Capture photo and video
function capturePhotoAndVideo() {
    const canvas = document.getElementById(`photo${photoCount + 1}`);
    const context = canvas.getContext('2d');
    
    // Set canvas size to match video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Stop current video
    stopCurrentVideo();
    
    photoCount++;
    showStatus(`Capture ${photoCount} of 4 completed`);
    
    if (photoCount === 4) {
        clearInterval(captureInterval);
        clearInterval(countdownInterval);
        captureBtn.textContent = 'Start Capture';
        captureBtn.disabled = false;
        isRecording = false;
        countdownDiv.textContent = '';
        showLoading(true);
        createCollage();
        createVideoGrid();
    } else {
        // Start recording next video
        currentVideoIndex++;
        startNewVideo();
    }
}

// Create photo collage
function createCollage() {
    const collageCanvas = document.createElement('canvas');
    const ctx = collageCanvas.getContext('2d');
    
    const photoWidth = document.getElementById('photo1').width;
    const photoHeight = document.getElementById('photo1').height;
    collageCanvas.width = photoWidth * 4;
    collageCanvas.height = photoHeight;
    
    for (let i = 0; i < 4; i++) {
        const photo = document.getElementById(`photo${i + 1}`);
        ctx.drawImage(photo, i * photoWidth, 0);
    }
    
    downloadCollageBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = 'photo-collage.png';
        link.href = collageCanvas.toDataURL('image/png');
        link.click();
    };
    downloadCollageBtn.disabled = false;
}

// Create video grid
async function createVideoGrid() {
    try {
        // Create video elements for each recorded video
        const videoElements = await Promise.all(videoChunks.map(async (chunks, index) => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            await new Promise(resolve => video.onloadedmetadata = resolve);
            return video;
        }));

        // Create canvas for the video grid
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size based on the first video's dimensions
        const videoWidth = videoElements[0].videoWidth;
        const videoHeight = videoElements[0].videoHeight;
        canvas.width = videoWidth * 4;
        canvas.height = videoHeight;

        // Create a MediaRecorder for the final video
        const stream = canvas.captureStream();
        const finalRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const finalChunks = [];

        finalRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                finalChunks.push(e.data);
            }
        };

        finalRecorder.onstop = () => {
            const finalBlob = new Blob(finalChunks, { type: 'video/webm' });
            downloadVideoBtn.onclick = () => handleVideoDownload(finalBlob);
            downloadVideoBtn.disabled = false;
            showLoading(false);
            showStatus('Capture complete! You can now download the collage or video.');
        };

        // Start recording the final video
        finalRecorder.start();

        // Play all videos and draw them to canvas
        videoElements.forEach(video => video.play());
        
        function drawFrame() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            videoElements.forEach((video, index) => {
                ctx.drawImage(video, index * videoWidth, 0, videoWidth, videoHeight);
            });
            requestAnimationFrame(drawFrame);
        }

        drawFrame();

        // Stop recording after the duration of the videos
        const duration = Math.min(...videoElements.map(v => v.duration)) * 1000;
        setTimeout(() => {
            finalRecorder.stop();
            videoElements.forEach(video => {
                video.pause();
                URL.revokeObjectURL(video.src);
            });
        }, duration);

    } catch (error) {
        console.error('Error creating video grid:', error);
        showStatus('Error creating video grid', true);
        showLoading(false);
    }
}

// Start/Stop capture process
captureBtn.onclick = () => {
    if (!isRecording) {
        photoCount = 0;
        currentVideoIndex = 0;
        videoChunks = [[], [], [], []];
        downloadCollageBtn.disabled = true;
        downloadVideoBtn.disabled = true;
        
        // Clear previous photos
        for (let i = 1; i <= 4; i++) {
            const canvas = document.getElementById(`photo${i}`);
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        isRecording = true;
        captureBtn.textContent = 'Capturing...';
        captureBtn.disabled = true;
        showStatus('Starting capture...');
        
        // Start first video recording
        startNewVideo();
        
        let countdown = 3;
        updateCountdown(countdown);
        
        countdownInterval = setInterval(() => {
            countdown--;
            updateCountdown(countdown);
        }, 1000);
        
        setTimeout(() => {
            capturePhotoAndVideo();
            captureInterval = setInterval(capturePhotoAndVideo, 3000);
        }, 3000);
    }
};

// Initialize camera when page loads
captureBtn.disabled = true;
setupCamera();

// Function to handle video download
function handleVideoDownload(blob) {
    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);
    
    // For mobile devices, we'll use a different approach
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // Create a video element to play the video
        const videoElement = document.createElement('video');
        videoElement.src = url;
        videoElement.controls = true;
        
        // Create a container for the video
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.backgroundColor = 'rgba(0,0,0,0.9)';
        container.style.zIndex = '1000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.padding = '10px 20px';
        closeBtn.style.margin = '10px';
        closeBtn.style.backgroundColor = '#e74c3c';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '5px';
        closeBtn.style.cursor = 'pointer';
        
        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download Video';
        downloadBtn.style.padding = '10px 20px';
        downloadBtn.style.margin = '10px';
        downloadBtn.style.backgroundColor = '#2ecc71';
        downloadBtn.style.color = 'white';
        downloadBtn.style.border = 'none';
        downloadBtn.style.borderRadius = '5px';
        downloadBtn.style.cursor = 'pointer';
        
        // Style the video element
        videoElement.style.maxWidth = '100%';
        videoElement.style.maxHeight = '80vh';
        videoElement.style.margin = '20px';
        
        // Add elements to container
        container.appendChild(videoElement);
        container.appendChild(downloadBtn);
        container.appendChild(closeBtn);
        
        // Add container to body
        document.body.appendChild(container);
        
        // Handle close button click
        closeBtn.onclick = () => {
            document.body.removeChild(container);
            URL.revokeObjectURL(url);
        };
        
        // Handle download button click
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'captured-video.webm';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
    } else {
        // For desktop, use the normal download approach
        const a = document.createElement('a');
        a.href = url;
        a.download = 'captured-video.webm';
        a.click();
    }
} 