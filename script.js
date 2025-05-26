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
    let videosPreloaded = false;

    // --- Configuration ---
    const config = {
        demoVideos: {
            standardVisualNav: 'videos/visual_navigation_demo.mp4',
            standardIndoorMap: 'videos/indoor_map_demo.mp4',
            realtimeIndoorLocation: 'videos/realtime_indoor_location_demo.mp4'
        }
    };

    // --- Functions ---
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
        if (!navModeToggle.checked) {
             visualNavVideo.controls = true;
        }
        console.log("相機已停止");
    }

    function setupInitialVideoSources() {
        if (videosPreloaded) return;

        if (!visualNavVideo.src && config.demoVideos.standardVisualNav) {
            visualNavVideo.src = config.demoVideos.standardVisualNav;
        }
        if (!indoorMapVideo.src && config.demoVideos.standardIndoorMap) {
            indoorMapVideo.src = config.demoVideos.standardIndoorMap;
        }
        videosPreloaded = true;
        console.log("Initial video sources set for preloading.");
    }


    function updateVisualNavSource() {
        const isRealtimeMode = navModeToggle.checked;
        const visualNavWasPlayingPreviously = !visualNavVideo.paused && visualNavVideo.readyState >= 2 && visualNavVideo.srcObject !== cameraStream;
        const visualNavCurrentTime = visualNavVideo.srcObject === cameraStream ? 0 : visualNavVideo.currentTime;
        const indoorMapWasPlayingPreviously = !indoorMapVideo.paused && indoorMapVideo.readyState >= 2;
        const indoorMapCurrentTime = indoorMapVideo.currentTime;

        const isInitialGenerationPlay = !videoOutputArea.classList.contains('hidden') &&
                                       !isRealtimeMode &&
                                       (!visualNavVideo.played.length && !indoorMapVideo.played.length);


        if (globalIsSyncing) {
            console.warn("正在進行同步操作，updateVisualNavSource 被延遲。");
            requestAnimationFrame(updateVisualNavSource);
            return;
        }
        globalIsSyncing = true;

        visualNavVideo.pause();
        indoorMapVideo.pause();

        if (isRealtimeMode) {
            visualNavTitle.textContent = "當前位置影像";
            indoorMapTitle.textContent = "即時室內地圖定位與導航";
        } else {
            visualNavTitle.textContent = "視覺導航影片";
            indoorMapTitle.textContent = "室內地圖定位與導航";
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
            visualNavVideo.src = "";
            visualNavVideo.srcObject = null;
            visualNavVideo.removeAttribute("src");
            visualNavVideo.controls = false;

            startCamera().then(() => {
                if (indoorMapVideo.src !== config.demoVideos.realtimeIndoorLocation) {
                    indoorMapVideo.src = config.demoVideos.realtimeIndoorLocation;
                    indoorMapVideo.load();
                }
                indoorMapVideo.controls = true;

                const onMapLoaded = () => {
                    indoorMapVideo.currentTime = indoorMapWasPlayingPreviously ? indoorMapCurrentTime : 0;
                    if (indoorMapWasPlayingPreviously || (cameraStream && !visualNavVideo.paused)) {
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

                if(indoorMapVideo.src === config.demoVideos.realtimeIndoorLocation) {
                    if (indoorMapVideo.readyState >= 2) {
                        onMapLoaded();
                    } else {
                        indoorMapVideo.addEventListener('loadeddata', onMapLoaded);
                        indoorMapVideo.addEventListener('error', onMapError);
                    }
                } else {
                    requestAnimationFrame(() => { globalIsSyncing = false; });
                }

            }).catch(() => {
                requestAnimationFrame(() => { globalIsSyncing = false; });
            });

        } else { // Standard mode (demo videos)
            stopCamera();
            visualNavVideo.srcObject = null;
            visualNavVideo.controls = true;
            indoorMapVideo.controls = true;

            const setupStandardVideo = (video, wasPlayingPreviously, time, videoSrc, isLastVideo, attemptAutoplayOverride) => {
                return new Promise((resolve, reject) => {
                    let sourceChanged = false;
                    if (video.src !== videoSrc && videoSrc) {
                        video.src = videoSrc;
                        sourceChanged = true;
                    } else if (!video.src && videoSrc) {
                        video.src = videoSrc;
                        sourceChanged = true;
                    }

                    if (sourceChanged) {
                        video.load();
                    }

                    const onLoaded = () => {
                        console.log(`${video.id} loadeddata. currentTime before set: ${video.currentTime}, target time: ${time}`);
                        if (video.readyState >= 1 && (sourceChanged || Math.abs(video.currentTime - time) > 0.2)) {
                             video.currentTime = time;
                        }
                        console.log(`${video.id} currentTime after set: ${video.currentTime}`);

                        if (attemptAutoplayOverride || wasPlayingPreviously) {
                            console.log(`Attempting to play ${video.id}. Override: ${attemptAutoplayOverride}, WasPlaying: ${wasPlayingPreviously}`);
                            video.play().catch(e => console.warn(`播放 ${video.id} 失敗 (onLoaded). Error:`, e.name, e.message));
                        }
                        cleanupListeners(video, onLoaded, onError);
                        resolve();
                        // globalIsSyncing is handled by Promise.allSettled().finally() now
                    };
                    const onError = (e) => {
                        console.error(`載入 ${video.id} 失敗`, e, video.error);
                        cleanupListeners(video, onLoaded, onError);
                        reject(e);
                        // globalIsSyncing is handled by Promise.allSettled().finally() now
                    };

                    if (video.readyState >= 2 && video.src === videoSrc && !sourceChanged) {
                        console.log(`${video.id} already has data and correct src. Proceeding.`);
                        onLoaded();
                    } else if (video.src === videoSrc || sourceChanged) {
                        console.log(`${video.id} source is correct or was changed. Adding event listeners.`);
                        video.addEventListener('loadeddata', onLoaded);
                        video.addEventListener('error', onError);
                        if (!sourceChanged && (video.networkState === HTMLMediaElement.NETWORK_EMPTY || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) {
                            video.load();
                        }
                    } else if (!videoSrc) {
                        console.log(`${video.id} has no target videoSrc.`);
                        resolve();
                    } else {
                        console.warn(`${video.id} in unexpected state. Src: ${video.src}, TargetSrc: ${videoSrc}`);
                        reject(new Error("Video in unexpected state for " + video.id));
                    }
                });
            };

            Promise.allSettled([
                setupStandardVideo(visualNavVideo, visualNavWasPlayingPreviously, visualNavCurrentTime, config.demoVideos.standardVisualNav, false, isInitialGenerationPlay),
                setupStandardVideo(indoorMapVideo, indoorMapWasPlayingPreviously, indoorMapCurrentTime, config.demoVideos.standardIndoorMap, false, isInitialGenerationPlay)
            ]).then(results => {
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        console.error("A standard video setup failed:", result.reason);
                    }
                });
            }).catch(err => {
                console.error("Error setting up standard videos (Promise.allSettled):", err);
            }).finally(() => {
                requestAnimationFrame(() => { globalIsSyncing = false; console.log("All standard videos setup promise chain done."); });
            });
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

        console.log("Generate Videos clicked. Calling updateVisualNavSource.");
        updateVisualNavSource();

        const attemptScroll = () => {
            if (!globalIsSyncing) {
                console.log("generateVideos: updateVisualNavSource async operations likely complete. Scrolling.");
                const parentSection = document.getElementById('video-generation-output-section');
                if (parentSection) parentSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                console.log("generateVideos: Waiting for globalIsSyncing to be false before scrolling.");
                requestAnimationFrame(attemptScroll);
            }
        };
        requestAnimationFrame(attemptScroll);
    }


    function performSyncAction(sourceVideo, targetVideo, action, value) {
        if (targetVideo === visualNavVideo && navModeToggle.checked && targetVideo.srcObject) return;
        if (sourceVideo === visualNavVideo && navModeToggle.checked && sourceVideo.srcObject && action === 'seek') return;
        if (globalIsSyncing && sourceVideo.id !== 'programmatic') return;

        // Check if the source video of the event is the camera stream
        const eventSourceIsCamera = sourceVideo === visualNavVideo && navModeToggle.checked && sourceVideo.srcObject;

        if (sourceVideo.id !== 'programmatic') {
            // If the event source is camera, and we are trying to control the map, allow it.
            // Otherwise, if syncing is already true, and it's not a programmatic action, potentially skip.
            // This needs careful handling. For now, let's assume programmatic syncs are fine.
            // User-initiated syncs (from video events) check globalIsSyncing.
            globalIsSyncing = true;
        }


        let operationPromise = Promise.resolve();
        switch (action) {
            case 'play':
                if (targetVideo.paused) {
                    console.log(`Sync: ${sourceVideo.id} triggered PLAY on ${targetVideo.id}`);
                    operationPromise = targetVideo.play();
                }
                break;
            case 'pause':
                if (!targetVideo.paused) {
                    console.log(`Sync: ${sourceVideo.id} triggered PAUSE on ${targetVideo.id}`);
                    targetVideo.pause(); // Pause is synchronous
                }
                break;
            case 'seek':
                if (targetVideo.readyState >= 1 && Math.abs(targetVideo.currentTime - value) > 0.2) {
                    console.log(`Sync: ${sourceVideo.id} triggered SEEK on ${targetVideo.id} to ${value}`);
                    targetVideo.currentTime = value;
                }
                break;
        }

        if (operationPromise && typeof operationPromise.catch === 'function' && typeof operationPromise.finally === 'function') {
            operationPromise
                .catch(e => console.warn(`同步 ${action} 錯誤 ${targetVideo.id}:`, e.name, e.message))
                .finally(() => {
                    if (sourceVideo.id !== 'programmatic') requestAnimationFrame(() => { globalIsSyncing = false; });
                });
        } else {
            if (sourceVideo.id !== 'programmatic') requestAnimationFrame(() => { globalIsSyncing = false; });
        }
    }


    function setupVideoEventListeners(video1, video2) {
        const createHandler = (action) => () => {
            const isVideo1Camera = video1 === visualNavVideo && navModeToggle.checked && video1.srcObject;
            const isVideo2Camera = video2 === visualNavVideo && navModeToggle.checked && video2.srcObject;

            // Prevent camera from being controlled by map video for play/pause/seek
            if (isVideo2Camera) {
                console.log(`Event from ${video1.id} (${action}) ignored for target ${video2.id} (camera).`);
                return;
            }
            // Prevent camera's seek events from controlling map (camera can't be seeked by user)
            if (isVideo1Camera && action === 'seek') {
                console.log(`Seek event from ${video1.id} (camera) ignored.`);
                return;
            }
            // If video1 is camera, allow its play/pause to control video2 (map).
            // If video1 is map, allow its play/pause/seek to control video2 (visual nav if not camera).

            // More robust check for globalIsSyncing:
            // If an operation is already in progress by the other video, this event might be an echo.
            // However, user actions should still try to sync.
            // The performSyncAction itself has a globalIsSyncing check.
            console.log(`Event: ${action} on ${video1.id}. globalIsSyncing: ${globalIsSyncing}`);
            performSyncAction(video1, video2, action, action === 'seek' ? video1.currentTime : undefined);
        };
        video1.addEventListener('play', createHandler('play'));
        video1.addEventListener('pause', createHandler('pause'));
        video1.addEventListener('seeked', createHandler('seeked'));
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
    visualNavVideo.onerror = (e) => console.error("視覺導航影片錯誤 (initial setup):", visualNavVideo.id, visualNavVideo.error, e);
    indoorMapVideo.onerror = (e) => console.error("室內地圖影片錯誤 (initial setup):", indoorMapVideo.id, indoorMapVideo.error, e);

    updateGenerateButtonState();
    stopCamera();

    setupInitialVideoSources();

    visualNavTitle.textContent = "視覺導航影片";
    indoorMapTitle.textContent = "室內地圖定位與導航";
    navModeTextLabel.textContent = "視覺導航";
});