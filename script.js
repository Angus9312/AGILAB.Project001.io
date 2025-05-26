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

    // --- Helper Functions for Loading Animation ---
    function getLoadingElements(videoElement) {
        const container = videoElement.closest('.video-player-container');
        if (!container) return null;
        return {
            overlay: container.querySelector('.loading-animation-overlay'),
            rocket: container.querySelector('.loading-rocket'),
            progressBarFill: container.querySelector('.progress-bar-fill'),
            flames: container.querySelector('.rocket-flames')
        };
    }

    function showLoadingAnimation(videoElement) {
        const elements = getLoadingElements(videoElement);
        if (!elements || !elements.overlay || !elements.rocket || !elements.progressBarFill || !elements.flames) {
            console.warn("Could not find loading elements for", videoElement.id);
            return;
        }
        elements.progressBarFill.style.transition = 'none';
        elements.progressBarFill.style.width = '0%';
        requestAnimationFrame(() => { elements.progressBarFill.style.transition = 'width 0.3s linear'; });
        elements.rocket.classList.remove('takeoff');
        elements.rocket.classList.add('bouncing');
        elements.flames.style.opacity = '0';
        elements.flames.style.height = '0px';
        elements.overlay.classList.add('active');
        videoElement.closest('.video-player-container').classList.add('loading-active');
        console.log(`Show loading for ${videoElement.id}`);
    }

    function updateLoadingProgress(videoElement, progress) {
        const elements = getLoadingElements(videoElement);
        if (!elements || !elements.progressBarFill) return;
        elements.progressBarFill.style.width = `${Math.min(progress, 100)}%`;
    }

    function hideLoadingAnimation(videoElement, withTakeoff = true) {
        const elements = getLoadingElements(videoElement);
        if (!elements || !elements.overlay || !elements.rocket || !elements.flames) {
            console.warn("Could not find loading elements for hide for", videoElement.id);
            return;
        }
        console.log(`Hide loading for ${videoElement.id}, takeoff: ${withTakeoff}`);

        if (withTakeoff && videoElement.srcObject !== cameraStream) {
            elements.rocket.classList.remove('bouncing');
            elements.rocket.classList.add('takeoff');
            setTimeout(() => {
                elements.overlay.classList.remove('active');
                elements.rocket.classList.remove('takeoff');
                videoElement.closest('.video-player-container').classList.remove('loading-active');
            }, 1400);
        } else {
            elements.overlay.classList.remove('active');
            elements.rocket.classList.remove('bouncing', 'takeoff');
            elements.flames.style.opacity = '0';
            elements.flames.style.height = '0px';
            videoElement.closest('.video-player-container').classList.remove('loading-active');
        }
    }

    function setupVideoLoadingListeners(videoElement) {
        if (videoElement.dataset.loadingListenersAttached === 'true') return;
        videoElement.dataset.loadingListenersAttached = 'true';

        videoElement.addEventListener('loadstart', () => {
            console.log(`${videoElement.id} loadstart event`);
            if (videoElement.srcObject !== cameraStream) {
                showLoadingAnimation(videoElement);
            }
            updateLoadingProgress(videoElement, 0);
        });
        videoElement.addEventListener('progress', () => {
            if (videoElement.duration && videoElement.buffered.length > 0) {
                const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
                const progress = (bufferedEnd / videoElement.duration) * 100;
                updateLoadingProgress(videoElement, progress);
            }
        });
        videoElement.addEventListener('waiting', () => {
            console.log(`${videoElement.id} waiting event`);
            if (videoElement.srcObject !== cameraStream) showLoadingAnimation(videoElement);
        });
        videoElement.addEventListener('canplaythrough', () => {
            console.log(`${videoElement.id} canplaythrough event`);
            updateLoadingProgress(videoElement, 100);
        });
        videoElement.addEventListener('playing', () => {
            console.log(`${videoElement.id} playing event`);
            updateLoadingProgress(videoElement, 100);
            hideLoadingAnimation(videoElement, videoElement.srcObject !== cameraStream);
        });
        videoElement.addEventListener('error', (e) => {
            console.error(`${videoElement.id} error event:`, e);
            updateLoadingProgress(videoElement, 0);
            hideLoadingAnimation(videoElement, false);
        });
        videoElement.addEventListener('emptied', () => {
            console.log(`${videoElement.id} emptied event`);
            updateLoadingProgress(videoElement, 0);
        });
        if (videoElement.src && videoElement.networkState === HTMLMediaElement.NETWORK_LOADING && videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA && videoElement.srcObject !== cameraStream) {
            showLoadingAnimation(videoElement);
        }
    }
    
    // --- Core Functions (From version where playback and sync were stable) ---
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
        console.log("Attempting to start camera...");
        showLoadingAnimation(visualNavVideo); 

        if (cameraStream && visualNavVideo.srcObject === cameraStream && !visualNavVideo.paused) {
            console.log("Camera already started and playing.");
            hideLoadingAnimation(visualNavVideo, false); 
            return;
        }
        if (cameraStream && visualNavVideo.srcObject !== cameraStream) {
            visualNavVideo.srcObject = cameraStream;
            console.log("Reattached existing camera stream.");
        }
        if (cameraStream && visualNavVideo.paused) {
             try {
                await visualNavVideo.play(); 
                console.log("Resumed paused camera stream.");
                return; 
            } catch (e) {
                console.warn("Resuming camera stream failed, will try to get new stream.", e);
                hideLoadingAnimation(visualNavVideo, false);
            }
        }
        
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        try {
            const constraints = { video: { facingMode: "environment" }, audio: false };
            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            visualNavVideo.srcObject = cameraStream;
            visualNavVideo.src = ""; 
            visualNavVideo.muted = true;
            visualNavVideo.controls = false; 
            await visualNavVideo.play(); 
            console.log("Camera started successfully and playing.");
            visualNavTitle.textContent = "當前位置影像"; 
        } catch (err) {
            console.error("Error starting camera:", err);
            visualNavTitle.textContent = "鏡頭畫面 (錯誤)";
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            visualNavVideo.srcObject = null;
            visualNavVideo.controls = true; 
            hideLoadingAnimation(visualNavVideo, false);
        }
    }

    function stopCamera() {
        console.log("Stopping camera...");
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
            console.log("Camera stream tracks stopped.");
        }
        if (visualNavVideo.srcObject) {
            visualNavVideo.srcObject = null; 
            console.log("Camera stream detached from video element.");
        }
        // Controls are set in updateVisualNavSource based on mode
        hideLoadingAnimation(visualNavVideo, false); 
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
        console.log("Initial video sources set for preloading (standard mode).");
    }

    function updateVisualNavSource() {
        const isRealtimeMode = navModeToggle.checked;
        console.log(`updateVisualNavSource called. Realtime mode: ${isRealtimeMode}. globalIsSyncing: ${globalIsSyncing}`);

        const visualNavWasPlayingPreviously = !visualNavVideo.paused && visualNavVideo.readyState >= 2 && visualNavVideo.srcObject !== cameraStream;
        const visualNavCurrentTime = visualNavVideo.srcObject === cameraStream ? 0 : visualNavVideo.currentTime;
        const indoorMapWasPlayingPreviously = !indoorMapVideo.paused && indoorMapVideo.readyState >= 2;
        const indoorMapCurrentTime = indoorMapVideo.currentTime;

        const isInitialGenerationPlay = !videoOutputArea.classList.contains('hidden') &&
                                       !isRealtimeMode &&
                                       (!visualNavVideo.played.length && !indoorMapVideo.played.length);

        if (globalIsSyncing) {
            console.warn("Sync operation in progress. updateVisualNavSource call deferred.");
            requestAnimationFrame(updateVisualNavSource);
            return;
        }
        globalIsSyncing = true;

        visualNavVideo.pause();
        indoorMapVideo.pause();
        console.log("Paused both videos for source update.");

        if (isRealtimeMode) {
            visualNavTitle.textContent = "當前位置影像";
            indoorMapTitle.textContent = "即時室內地圖定位與導航";
            videoOutputArea.classList.add('realtime-mode');
        } else {
            visualNavTitle.textContent = "視覺導航影片";
            indoorMapTitle.textContent = "室內地圖定位與導航";
            videoOutputArea.classList.remove('realtime-mode');
        }
        navModeTextLabel.textContent = isRealtimeMode ? "即時視覺導航" : "視覺導航";
        
        visualNavVideo.onloadeddata = null; 
        visualNavVideo.onerror = (e) => { console.error("visualNavVideo error during update:", visualNavVideo.error, e); hideLoadingAnimation(visualNavVideo, false); };
        indoorMapVideo.onloadeddata = null;
        indoorMapVideo.onerror = (e) => { console.error("indoorMapVideo error during update:", indoorMapVideo.error, e); hideLoadingAnimation(indoorMapVideo, false); };

        if (isRealtimeMode) {
            console.log("Switching to Realtime Mode.");
            stopCamera(); 

            visualNavVideo.src = ""; 
            visualNavVideo.removeAttribute("src");
            visualNavVideo.srcObject = null; 
            visualNavVideo.controls = false;
            
            startCamera().then(() => { 
                console.log("Camera started for visualNavVideo in realtime mode.");
                if (indoorMapVideo.src !== config.demoVideos.realtimeIndoorLocation) {
                    console.log("Setting indoorMapVideo source for realtime.");
                    indoorMapVideo.src = config.demoVideos.realtimeIndoorLocation;
                    indoorMapVideo.load();
                } else if (indoorMapVideo.paused && (indoorMapWasPlayingPreviously || (cameraStream && !visualNavVideo.paused))) {
                    console.log("indoorMapVideo source is same (realtime), attempting to play.");
                    indoorMapVideo.play().catch(e => console.warn("Error playing indoorMapVideo (realtime, same src):", e));
                }
                indoorMapVideo.controls = true;

                const onMapLoadedRT = () => {
                    console.log("indoorMapVideo (realtime) loadeddata.");
                    indoorMapVideo.currentTime = indoorMapWasPlayingPreviously ? indoorMapCurrentTime : 0;
                    if (indoorMapWasPlayingPreviously || (cameraStream && !visualNavVideo.paused)) { 
                        indoorMapVideo.play().catch(e => console.warn("Error playing indoorMapVideo (realtime, onMapLoadedRT):", e));
                    }
                    cleanupListeners(indoorMapVideo, onMapLoadedRT, onMapErrorRT);
                };
                const onMapErrorRT = (e) => {
                    console.error("Error loading indoorMapVideo (realtime):", e);
                    hideLoadingAnimation(indoorMapVideo, false);
                    cleanupListeners(indoorMapVideo, onMapLoadedRT, onMapErrorRT);
                };
                
                if (indoorMapVideo.src === config.demoVideos.realtimeIndoorLocation && indoorMapVideo.readyState >= 2) {
                    onMapLoadedRT();
                } else if (indoorMapVideo.src === config.demoVideos.realtimeIndoorLocation) {
                    indoorMapVideo.addEventListener('loadeddata', onMapLoadedRT);
                    indoorMapVideo.addEventListener('error', onMapErrorRT);
                } else {
                     hideLoadingAnimation(indoorMapVideo, false);
                }
                requestAnimationFrame(() => { globalIsSyncing = false; console.log("Realtime mode setup potentially complete."); });

            }).catch(err => {
                console.error("startCamera promise rejected in realtime mode:", err);
                hideLoadingAnimation(visualNavVideo, false); 
                hideLoadingAnimation(indoorMapVideo, false); 
                requestAnimationFrame(() => { globalIsSyncing = false; });
            });

        } else { // Standard Mode
            console.log("Switching to Standard Mode.");
            stopCamera(); 
            visualNavVideo.srcObject = null; 

            visualNavVideo.controls = true;
            indoorMapVideo.controls = true;

            const setupStandardVideo = (video, wasPlaying, time, videoSrc, attemptAutoplay) => {
                return new Promise((resolve, reject) => {
                    let sourceChanged = false;
                    const currentFullSrc = video.currentSrc ? new URL(video.currentSrc, document.baseURI).pathname : "";
                    const targetFullSrc = videoSrc ? new URL(videoSrc, document.baseURI).pathname : "";

                    if (currentFullSrc !== targetFullSrc && videoSrc) {
                        video.src = videoSrc;
                        sourceChanged = true;
                    } else if (!video.src && videoSrc) {
                        video.src = videoSrc;
                        sourceChanged = true;
                    }

                    if (sourceChanged) {
                        console.log(`Source for ${video.id} changed to ${videoSrc}. JS calling load().`);
                        video.load();
                    } else if (video.src === videoSrc && video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
                        showLoadingAnimation(video);
                    }

                    const onLoadedStd = () => {
                        console.log(`${video.id} (standard) loadeddata.`);
                        if (video.readyState >= 1 && (sourceChanged || Math.abs(video.currentTime - time) > 0.2)) {
                            video.currentTime = time;
                        }
                        if (attemptAutoplay || wasPlaying) {
                            console.log(`Attempting to play ${video.id} (standard). Autoplay: ${attemptAutoplay}, WasPlaying: ${wasPlaying}`);
                            video.play().catch(e => console.warn(`Error playing ${video.id} (standard, onLoadedStd):`, e));
                        }
                        cleanupListeners(video, onLoadedStd, onErrorStd);
                        resolve();
                    };
                    const onErrorStd = (e) => {
                        console.error(`Error loading ${video.id} (standard):`, e);
                        hideLoadingAnimation(video, false);
                        cleanupListeners(video, onLoadedStd, onErrorStd);
                        reject(e);
                    };

                    if (video.src === videoSrc && video.readyState >= 2 && !sourceChanged) { 
                        hideLoadingAnimation(video, false); 
                        onLoadedStd();
                    } else if (video.src === videoSrc || sourceChanged) { 
                        video.addEventListener('loadeddata', onLoadedStd);
                        video.addEventListener('error', onErrorStd);
                        if (!sourceChanged && (video.networkState === HTMLMediaElement.NETWORK_EMPTY || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) {
                           video.load(); 
                        }
                    } else if (!videoSrc) { 
                        hideLoadingAnimation(video, false);
                        resolve();
                    } else {
                        hideLoadingAnimation(video, false);
                        reject(new Error(`${video.id} in unexpected state for standard mode.`));
                    }
                });
            };

            Promise.allSettled([
                setupStandardVideo(visualNavVideo, visualNavWasPlayingPreviously, visualNavCurrentTime, config.demoVideos.standardVisualNav, isInitialGenerationPlay),
                setupStandardVideo(indoorMapVideo, indoorMapWasPlayingPreviously, indoorMapCurrentTime, config.demoVideos.standardIndoorMap, isInitialGenerationPlay)
            ]).then(results => {
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        console.error("A standard video setup failed:", result.reason);
                    }
                });
            }).finally(() => {
                requestAnimationFrame(() => { globalIsSyncing = false; console.log("Standard mode video setup complete."); });
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
        console.log("Generate Videos button clicked.");
        updateVisualNavSource();

        const attemptScroll = () => {
            if (!globalIsSyncing) {
                const parentSection = document.getElementById('video-generation-output-section');
                if (parentSection) parentSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                requestAnimationFrame(attemptScroll);
            }
        };
        requestAnimationFrame(attemptScroll);
    }

    function performSyncAction(sourceVideo, targetVideo, action, value) {
        if (targetVideo === visualNavVideo && navModeToggle.checked && targetVideo.srcObject) return;
        if (sourceVideo === visualNavVideo && navModeToggle.checked && sourceVideo.srcObject && action === 'seeked') return;

        let shouldSetGlobalSync = sourceVideo.id !== 'programmatic' && !globalIsSyncing;
        if (shouldSetGlobalSync) {
            globalIsSyncing = true;
        }

        let operationPromise = Promise.resolve();
        switch (action) {
            case 'play':
                if (targetVideo.paused) {
                    operationPromise = targetVideo.play().catch(e => console.warn(`Sync PLAY on ${targetVideo.id} failed:`, e));
                }
                break;
            case 'pause':
                if (!targetVideo.paused) targetVideo.pause();
                break;
            case 'seeked':
                if (targetVideo.readyState >= 1 && Math.abs(targetVideo.currentTime - value) > 0.2) {
                    targetVideo.currentTime = value;
                }
                break;
        }
        Promise.resolve(operationPromise).finally(() => {
            if (shouldSetGlobalSync) {
                requestAnimationFrame(() => { globalIsSyncing = false; });
            }
        });
    }

    function setupVideoEventListeners(video1, video2) {
        const createHandler = (action) => () => {
            const isVideo1Camera = video1 === visualNavVideo && navModeToggle.checked && video1.srcObject;
            const isVideo2Camera = video2 === visualNavVideo && navModeToggle.checked && video2.srcObject;

            if (isVideo2Camera) return;
            if (isVideo1Camera && action === 'seeked') return;

            if (!globalIsSyncing || action === 'seeked') {
                performSyncAction(video1, video2, action, action === 'seeked' ? video1.currentTime : undefined);
            } else {
                 console.log(`Sync for ${action} on ${video1.id} throttled by globalIsSyncing.`);
            }
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
    
    // --- Initial Setup ---
    imgCurrentPhoto.style.display = 'none';
    imgDestinationPhoto.style.display = 'none';
    videoOutputArea.classList.remove('realtime-mode');

    setupVideoLoadingListeners(visualNavVideo);
    setupVideoLoadingListeners(indoorMapVideo);
    
    setupVideoEventListeners(visualNavVideo, indoorMapVideo);
    setupVideoEventListeners(indoorMapVideo, visualNavVideo);

    updateGenerateButtonState();
    stopCamera(); 
    setupInitialVideoSources();

    visualNavTitle.textContent = "視覺導航影片";
    indoorMapTitle.textContent = "室內地圖定位與導航";
    navModeTextLabel.textContent = "視覺導航";
});