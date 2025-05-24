document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const btnSelectCurrentPhoto = document.getElementById('btn-select-current-photo');
    const btnSelectDestinationPhoto = document.getElementById('btn-select-destination-photo');
    const currentPhotoFileInp = document.getElementById('current-location-file');
    const destinationPhotoFileInp = document.getElementById('destination-file');
    const imgCurrentPhoto = document.getElementById('img-current-photo');
    const imgDestinationPhoto = document.getElementById('img-destination-photo');
    const currentPhotoNameDisplay = document.getElementById('current-photo-name');
    const destinationPhotoNameDisplay = document.getElementById('destination-photo-name');
    const indoorMapTitle = document.getElementById('indoor-map-title');
    const btnGenerateVideos = document.getElementById('btn-generate-videos');
    const videoOutputArea = document.getElementById('video-output-area');
    const visualNavVideo = document.getElementById('visual-nav-video');
    const indoorMapVideo = document.getElementById('indoor-map-video');
    const navModeToggle = document.getElementById('nav-mode-toggle');
    const visualNavTitle = document.getElementById('visual-nav-title');
    const navModeTextLabel = document.getElementById('nav-mode-text');

    // --- State ---
    let currentPhotoSelected = false;
    let destinationPhotoSelected = false;
    let cameraStream = null;
    let globalIsSyncing = false;

    // --- Configuration ---
    const config = {
        demoVideos: {
            standardVisualNav: 'videos/visual_navigation_demo.mp4',
            standardIndoorMap: 'videos/indoor_map_demo.mp4',
            realtimeIndoorLocation: 'videos/realtime_indoor_location_demo.mp4' // 假設這個影片內容適合新的標題
        }
    };

    // --- Functions ---1
    function updateGenerateButtonState() {
        btnGenerateVideos.disabled = !(currentPhotoSelected && destinationPhotoSelected);
    }

    function handlePhotoUpload(event, imgElement, nameDisplayElement, photoType) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imgElement.src = e.target.result;
                imgElement.style.display = 'block';
            }
            reader.readAsDataURL(file);
            nameDisplayElement.textContent = `已選擇: ${file.name}`;
            if (photoType === 'current') currentPhotoSelected = true;
            else if (photoType === 'destination') destinationPhotoSelected = true;
        } else {
            imgElement.src = "#";
            imgElement.style.display = 'none';
            nameDisplayElement.textContent = "未選擇圖片";
            if (photoType === 'current') currentPhotoSelected = false;
            else if (photoType === 'destination') destinationPhotoSelected = false;
        }
        updateGenerateButtonState();
    }

    async function startCamera() {
        if (cameraStream) {
            if (visualNavVideo.srcObject !== cameraStream) {
                visualNavVideo.srcObject = cameraStream;
                if (visualNavVideo.paused) visualNavVideo.play().catch(e=>console.warn("重新播放相機流失敗 (existing stream)", e));
            }
            return;
        }
        try {
            const constraints = {
                video: { facingMode: "environment" },
                audio: false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraStream = stream;
            visualNavVideo.srcObject = stream;
            visualNavVideo.src = "";
            visualNavVideo.muted = true;
            visualNavVideo.controls = false;
            await visualNavVideo.play();
            console.log("相機已啟動並綁定到 visualNavVideo");
        } catch (err) {
            console.error("啟動相機錯誤:", err);
            visualNavTitle.textContent = "鏡頭畫面 (錯誤)";
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            visualNavVideo.srcObject = null;
            visualNavVideo.controls = true;
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        if (visualNavVideo.srcObject) {
            visualNavVideo.srcObject = null;
        }
        visualNavVideo.controls = true;
        console.log("相機已停止");
    }

    function updateVisualNavSource() {
        const isRealtimeMode = navModeToggle.checked;
        const visualNavWasPlaying = !visualNavVideo.paused && visualNavVideo.readyState >= 2;
        const visualNavCurrentTime = visualNavVideo.currentTime;
        const indoorMapWasPlaying = !indoorMapVideo.paused && indoorMapVideo.readyState >= 2;
        const indoorMapCurrentTime = indoorMapVideo.currentTime;

        if (globalIsSyncing) {
            console.warn("正在進行同步操作，updateVisualNavSource 被延遲。");
            requestAnimationFrame(updateVisualNavSource);
            return;
        }
        globalIsSyncing = true;

        visualNavVideo.pause();
        indoorMapVideo.pause();

        // <<< 標題更新邏輯 >>>
        if (isRealtimeMode) {
            visualNavTitle.textContent = "當前位置影像";                  // 即時模式 - 左側
            indoorMapTitle.textContent = "即時室內地圖定位與導航";      // 即時模式 - 右側 (已更改)
        } else {
            visualNavTitle.textContent = "視覺導航影片";                  // 標準模式 - 左側 (已更改)
            indoorMapTitle.textContent = "室內地圖定位與導航";          // 標準模式 - 右側 (保持上次的)
        }
        navModeTextLabel.textContent = isRealtimeMode ? "即時視覺導航" : "視覺導航";

        if (isRealtimeMode) {
            videoOutputArea.classList.add('realtime-mode');
        } else {
            videoOutputArea.classList.remove('realtime-mode');
        }

        visualNavVideo.onloadeddata = null;
        visualNavVideo.onerror = (e) => console.error("視覺導航影片錯誤:", visualNavVideo.id, visualNavVideo.error, e);
        indoorMapVideo.onloadeddata = null;
        indoorMapVideo.onerror = (e) => console.error("室內地圖影片錯誤:", indoorMapVideo.id, indoorMapVideo.error, e);

        if (isRealtimeMode) {
            stopCamera();
            startCamera().then(() => {
                indoorMapVideo.src = config.demoVideos.realtimeIndoorLocation;
                indoorMapVideo.load();
                const onMapLoaded = () => {
                    indoorMapVideo.currentTime = 0;
                    if (indoorMapWasPlaying || visualNavWasPlaying) {
                         indoorMapVideo.play().catch(e => console.warn("播放即時室內地圖定位與導航影片失敗", e));
                    }
                    cleanupListeners(indoorMapVideo, onMapLoaded, onMapError);
                    requestAnimationFrame(() => { globalIsSyncing = false; });
                };
                const onMapError = (e) => {
                    console.error("載入即時室內地圖定位與導航影片失敗:", e, indoorMapVideo.error);
                    cleanupListeners(indoorMapVideo, onMapLoaded, onMapError);
                    requestAnimationFrame(() => { globalIsSyncing = false; });
                };
                indoorMapVideo.addEventListener('loadeddata', onMapLoaded);
                indoorMapVideo.addEventListener('error', onMapError);
            }).catch(() => {
                requestAnimationFrame(() => { globalIsSyncing = false; });
            });
        } else {
            stopCamera();
            visualNavVideo.srcObject = null;

            visualNavVideo.src = config.demoVideos.standardVisualNav;
            visualNavVideo.load();
            indoorMapVideo.src = config.demoVideos.standardIndoorMap;
            indoorMapVideo.load();

            const setupStandardVideo = (video, wasPlaying, time, isLast) => {
                const onLoaded = () => {
                    if (video.readyState >= 1) video.currentTime = time;
                    if (wasPlaying) video.play().catch(e => console.warn(`恢復 ${video.id} 播放失敗`, e));
                    cleanupListeners(video, onLoaded, onError);
                    if (isLast) requestAnimationFrame(() => { globalIsSyncing = false; });
                };
                const onError = (e) => {
                    console.error(`載入 ${video.id} 失敗`, e, video.error);
                    cleanupListeners(video, onLoaded, onError);
                    if (isLast) requestAnimationFrame(() => { globalIsSyncing = false; });
                };
                video.addEventListener('loadeddata', onLoaded);
                video.addEventListener('error', onError);
            };

            setupStandardVideo(visualNavVideo, visualNavWasPlaying, visualNavCurrentTime, false);
            setupStandardVideo(indoorMapVideo, indoorMapWasPlaying, indoorMapCurrentTime, true);
        }
    }
    
    function cleanupListeners(videoElement, loadedHandler, errorHandler) {
        videoElement.removeEventListener('loadeddata', loadedHandler);
        videoElement.removeEventListener('error', errorHandler);
    }

    function generateVideos() {
        if (!currentPhotoSelected || !destinationPhotoSelected) {
            alert('請先選擇目前位置和目的地的照片！');
            return;
        }
        btnGenerateVideos.style.display = 'none';
        videoOutputArea.classList.remove('hidden');
        updateVisualNavSource(); 

        const attemptInitialPlay = () => {
            if (!globalIsSyncing) {
                console.log("generateVideos: updateVisualNavSource has completed.");
            } else {
                requestAnimationFrame(attemptInitialPlay);
            }
        };
        requestAnimationFrame(attemptInitialPlay);

        const parentSection = document.getElementById('video-generation-output-section');
        if (parentSection) parentSection.scrollIntoView({ behavior: 'smooth' });
    }

    function performInitialPlay() {
        if (globalIsSyncing) {
            console.warn("performInitialPlay called while globalIsSyncing is true.");
            return;
        }
        globalIsSyncing = true;
        console.log("執行初始同步播放 (performInitialPlay)...");
        let playPromises = [];
        if (visualNavVideo.src || visualNavVideo.srcObject) {
            if (visualNavVideo.paused) {
                 playPromises.push(visualNavVideo.play().catch(e => console.warn(`${visualNavVideo.id} initial play failed:`, e)));
            }
        }
        if (indoorMapVideo.src) {
            if (indoorMapVideo.paused) {
                playPromises.push(indoorMapVideo.play().catch(e => console.warn(`${indoorMapVideo.id} initial play failed:`, e)));
            }
        }
        Promise.allSettled(playPromises)
            .finally(() => {
                requestAnimationFrame(() => { globalIsSyncing = false; });
            });
    }

    function performSyncAction(sourceVideo, targetVideo, action, value) {
        if (targetVideo === visualNavVideo && navModeToggle.checked && targetVideo.srcObject) return;
        if (sourceVideo === visualNavVideo && navModeToggle.checked && sourceVideo.srcObject && action === 'seek') return;
        if (globalIsSyncing && sourceVideo.id !== 'programmatic') return;
        if (sourceVideo.id !== 'programmatic') globalIsSyncing = true;

        let operationPromise = Promise.resolve();
        switch (action) {
            case 'play':
                if (targetVideo.paused) operationPromise = targetVideo.play();
                break;
            case 'pause':
                if (!targetVideo.paused) targetVideo.pause();
                break;
            case 'seek':
                if (targetVideo.readyState >= 1 && Math.abs(targetVideo.currentTime - value) > 0.2) {
                    targetVideo.currentTime = value;
                }
                break;
        }
        if (operationPromise && typeof operationPromise.finally === 'function') {
            operationPromise
                .catch(e => console.warn(`同步 ${action} 錯誤 ${targetVideo.id}:`, e))
                .finally(() => {
                    if (sourceVideo.id !== 'programmatic') requestAnimationFrame(() => { globalIsSyncing = false; });
                });
        } else {
            if (sourceVideo.id !== 'programmatic') requestAnimationFrame(() => { globalIsSyncing = false; });
        }
    }

    function setupVideoEventListeners(video1, video2) {
        const createHandler = (action) => () => {
            if (video1 === visualNavVideo && navModeToggle.checked && video1.srcObject && action === 'seek') return;
            if (video2 === visualNavVideo && navModeToggle.checked && video2.srcObject) return;
            if (!globalIsSyncing || action === 'seek') {
                 performSyncAction(video1, video2, action, action === 'seek' ? video1.currentTime : undefined);
            }
        };
        video1.addEventListener('play', createHandler('play'));
        video1.addEventListener('pause', createHandler('pause'));
        video1.addEventListener('seeked', createHandler('seek'));
    }

    // --- Event Listeners ---
    btnSelectCurrentPhoto.addEventListener('click', () => currentPhotoFileInp.click());
    btnSelectDestinationPhoto.addEventListener('click', () => destinationPhotoFileInp.click());
    currentPhotoFileInp.addEventListener('change', (event) => handlePhotoUpload(event, imgCurrentPhoto, currentPhotoNameDisplay, 'current'));
    destinationPhotoFileInp.addEventListener('change', (event) => handlePhotoUpload(event, imgDestinationPhoto, destinationPhotoNameDisplay, 'destination'));
    btnGenerateVideos.addEventListener('click', generateVideos);
    navModeToggle.addEventListener('change', updateVisualNavSource);

    setupVideoEventListeners(visualNavVideo, indoorMapVideo);
    setupVideoEventListeners(indoorMapVideo, visualNavVideo);

    // --- Initial Setup ---
    imgCurrentPhoto.style.display = 'none';
    imgDestinationPhoto.style.display = 'none';
    videoOutputArea.classList.remove('realtime-mode');
    visualNavVideo.onerror = (e) => console.error("視覺導航影片錯誤 (initial):", visualNavVideo.error, e);
    indoorMapVideo.onerror = (e) => console.error("室內地圖影片錯誤 (initial):", indoorMapVideo.error, e);
    updateGenerateButtonState();
    stopCamera();
    
    // <<< 初始標題設定 (與 HTML 中的初始值一致，並與 updateVisualNavSource 中的標準模式一致) >>>
    visualNavTitle.textContent = "視覺導航影片";         // (已更改)
    indoorMapTitle.textContent = "室內地圖定位與導航"; // (保持上次的)
    navModeTextLabel.textContent = "視覺導航";          // Toggle 旁邊的文字 (預設)
});