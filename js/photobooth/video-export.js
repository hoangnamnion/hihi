// Function to handle video export completion
function handleVideoExportComplete(videoUrl) {
    // Hide progress section
    document.getElementById('exportProgress').style.display = 'none';
    
    // Show video preview
    const videoPreview = document.getElementById('videoPreview');
    videoPreview.style.display = 'block';
    
    // Set video source with proper MIME type
    const video = document.getElementById('exportedVideo');
    video.src = videoUrl;
    video.type = 'video/mp4';
    
    // Set download link with proper filename and MIME type
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = videoUrl;
    downloadLink.download = 'photobooth_video.mp4';
    downloadLink.type = 'video/mp4';
    
    // Hide export buttons
    document.getElementById('confirmExportBtn').style.display = 'none';
    document.getElementById('cancelExportBtn').style.display = 'none';
    
    // Play video automatically on mobile
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        video.play().catch(error => {
            console.log('Autoplay failed:', error);
        });
    }

    // Add event listener for video error
    video.addEventListener('error', function(e) {
        console.error('Video error:', e);
        alert('Có lỗi xảy ra khi phát video. Vui lòng thử lại hoặc tải video về máy.');
    });
}

// Function to check if video is playable
function isVideoPlayable(videoUrl) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.type = 'video/mp4';
        
        video.addEventListener('loadedmetadata', () => {
            resolve(true);
        });
        
        video.addEventListener('error', () => {
            resolve(false);
        });
    });
}

// Function to calculate estimated export time
function calculateExportTime() {
    const captureCount = parseInt(document.getElementById('captureCount').value);
    const captureTime = parseInt(document.getElementById('captureTime').value);
    const layoutType = document.getElementById('layoutType').value;
    
    // Base processing time per image (in seconds)
    const baseProcessingTime = 2;
    
    // Calculate total time
    let totalTime = (captureCount * captureTime) + (captureCount * baseProcessingTime);
    
    // Add extra time based on layout complexity
    if (layoutType === '2x3') {
        totalTime *= 1.5; // More complex layout takes 50% longer
    }
    
    // Convert to minutes and seconds
    const minutes = Math.floor(totalTime / 60);
    const seconds = Math.round(totalTime % 60);
    
    return { minutes, seconds };
}

// Function to format time (MM:SS)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to update progress
function updateProgress(progress, elapsedTime, totalTime) {
    const progressBar = document.getElementById('progressBar');
    const progressTime = document.getElementById('progressTime');
    const progressStatus = document.getElementById('progressStatus');
    
    // Update progress bar
    progressBar.style.width = `${progress}%`;
    
    // Update time display
    progressTime.textContent = `${formatTime(elapsedTime)} / ${formatTime(totalTime)}`;
    
    // Update status
    if (progress < 100) {
        progressStatus.textContent = 'Đang tải xuống...';
    } else {
        progressStatus.textContent = 'Tải xuống hoàn tất!';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Export Video Button
    const exportVideoBtn = document.getElementById('exportVideoBtn');
    if (exportVideoBtn) {
        exportVideoBtn.addEventListener('click', function() {
            const { minutes, seconds } = calculateExportTime();
            const timeText = minutes > 0 
                ? `Thời gian dự kiến: ${minutes} phút ${seconds} giây`
                : `Thời gian dự kiến: ${seconds} giây`;
            document.getElementById('estimatedTime').textContent = timeText;
        });
    }

    // Settings change handlers
    const settingsInputs = ['captureCount', 'captureTime', 'layoutType'];
    settingsInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                if (document.getElementById('videoExportModal').style.display === 'block') {
                    const { minutes, seconds } = calculateExportTime();
                    const timeText = minutes > 0 
                        ? `Thời gian dự kiến: ${minutes} phút ${seconds} giây`
                        : `Thời gian dự kiến: ${seconds} giây`;
                    document.getElementById('estimatedTime').textContent = timeText;
                }
            });
        }
    });
}); 