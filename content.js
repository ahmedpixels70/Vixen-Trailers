(async function main() {
  // Extract various elements from the site URL
  redirectToVixen();
  const currentSiteUrl = document.URL;
  const siteSlug = currentSiteUrl.match(/[\w\d-]+$/)[0];
  const siteName = currentSiteUrl.match(/www\.(.+)\.com/)[1].toUpperCase();
  const baseUrl = currentSiteUrl.match(/^https\:\/\/[^/]+/)[0];
  const noProtocolUrl = baseUrl.match(/www\.(.+)/)[1];
  // Call Vixen GraphQL API to get the videoId
  async function getVideoId() {
    const videoIdResponse = await fetch(baseUrl + "/graphql", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query Video($videoSlug: String, $site: Site) {
            findOneVideo(input: {slug: $videoSlug, site: $site}) {
              videoId
            }
          }
        `,
        variables: {
          videoSlug: siteSlug,
          site: siteName
        },
      }),
    });
    const videoIdResponseJson = await videoIdResponse.json();
    return videoIdResponseJson.data.findOneVideo.videoId;
  }

  const videoId = await getVideoId();

  // Call Vixen GraphQL API to get the various trailer links
  async function getTrailerLinks() {
    const trailerLinkResponse = await fetch(baseUrl + "/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-Host": "api." + noProtocolUrl
      },
      body: JSON.stringify({
        query: `
          query getToken($videoId: ID!, $device: Device!) {
            generateVideoToken(input: {videoId: $videoId, device: $device}) {
              p360 { token }
              p480 { token }
              p720 { token }
              p1080 { token }
              p2160 { token }
            }
          }
        `,
        variables: {
          videoId: videoId,
          device: "trailer"
        },
      }),
    });
    const trailerLinkResponseJson = await trailerLinkResponse.json();
    return trailerLinkResponseJson.data.generateVideoToken;
  }

  let trailers;
  try {
    trailers = await getTrailerLinks();
  } catch (e) {
    console.error("Failed to fetch trailer links:", e);
    trailers = null;
  }

  // Map trailer links to quality options
  const qualityOptions = trailers ? [
    { label: "4K UHD", value: "2160", link: trailers.p2160?.token, filename: `${siteSlug}-4k.mp4` },
    { label: "HD 1080p", value: "1080", link: trailers.p1080?.token, filename: `${siteSlug}-1080p.mp4` },
    { label: "HD 720p", value: "720", link: trailers.p720?.token, filename: `${siteSlug}-720p.mp4` },
    { label: "SD 480p", value: "480", link: trailers.p480?.token, filename: `${siteSlug}-480p.mp4` },
    { label: "LQ 360p", value: "360", link: trailers.p360?.token, filename: `${siteSlug}-360p.mp4` },
  ].filter(opt => opt.link) : [];

  // Create video player that replaces the cover wrapper
  function createVideoPlayer() {
    const videoCoverWrapper = document.querySelector('[data-test-component="VideoCoverWrapper"]');
    if (!videoCoverWrapper) return;

    // If no trailer links, don't create player
    if (!qualityOptions.length) return;

    // Get saved qualities or use defaults
    const savedVideoQuality = localStorage.getItem('vixenVideoQuality') || "480";
    const savedDownloadQuality = localStorage.getItem('vixenDownloadQuality') || "480";
    const initialVideoQuality = qualityOptions.find(opt => opt.value === savedVideoQuality) || qualityOptions[0];

    // Create player container (hidden initially)
    const playerContainer = document.createElement('div');
    playerContainer.className = 'video-player-container';
    playerContainer.style.display = 'none';
    playerContainer.style.position = 'relative';
    playerContainer.style.width = '100%';
    playerContainer.style.height = '100%';

    // Create video element
    const videoElement = document.createElement('video');
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';
    videoElement.controls = true;

    // Add source elements for each quality
    qualityOptions.forEach(opt => {
      const source = document.createElement('source');
      source.src = opt.link;
      source.type = 'video/mp4';
      source.dataset.quality = opt.value;
      videoElement.appendChild(source);
    });

    // Set initial source
    videoElement.src = initialVideoQuality.link;

    // Create quality selector
    const qualitySelector = document.createElement('select');
    qualitySelector.style.position = 'absolute';
    qualitySelector.style.top = '10px';
    qualitySelector.style.right = '10px';
    qualitySelector.style.zIndex = '10';
    qualitySelector.style.padding = '5px';
    qualitySelector.style.borderRadius = '4px';
    qualitySelector.style.backgroundColor = 'rgba(0,0,0,0.7)';
    qualitySelector.style.color = 'white';
    qualitySelector.style.border = 'none';

    // Add quality options
    qualityOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      option.selected = opt.value === initialVideoQuality.value;
      qualitySelector.appendChild(option);
    });

    // Handle quality change
    qualitySelector.addEventListener('change', (e) => {
      const selectedQuality = e.target.value;
      const selectedOption = qualityOptions.find(opt => opt.value === selectedQuality);
      
      if (selectedOption) {
        // Save video quality preference
        localStorage.setItem('vixenVideoQuality', selectedQuality);
        
        // Change video source
        const currentTime = videoElement.currentTime;
        videoElement.src = selectedOption.link;
        videoElement.currentTime = currentTime;
        videoElement.play();
      }
    });

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.left = '10px';
    closeButton.style.zIndex = '10';
    closeButton.style.width = '30px';
    closeButton.style.height = '30px';
    closeButton.style.borderRadius = '50%';
    closeButton.style.backgroundColor = 'rgba(0,0,0,0.7)';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '18px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';

    // Handle close - restore original cover wrapper
    closeButton.addEventListener('click', () => {
      playerContainer.style.display = 'none';
      videoCoverWrapper.style.display = '';
      videoElement.pause();
    });

    // Add elements to player container
    playerContainer.appendChild(videoElement);
    playerContainer.appendChild(qualitySelector);
    playerContainer.appendChild(closeButton);

    // Insert player container after the cover wrapper
    videoCoverWrapper.parentNode.insertBefore(playerContainer, videoCoverWrapper.nextSibling);
    
    // Find the play button inside the cover wrapper
    const playButton = videoCoverWrapper.querySelector('[data-test-component="PlayButton"]');
    if (playButton) {
      // Store original onclick if it exists
      const originalOnClick = playButton.onclick;
     
      playButton.addEventListener('click', (e) => {
        // If there's an original onclick, execute it first
        if (originalOnClick) originalOnClick(e);
        // Show our player and hide the cover wrapper
        playerContainer.style.display = 'block';
        videoCoverWrapper.style.display = 'none';
        videoElement.play();
        const joinNowOverlay = document.querySelector('[data-test-component="JoinNowOverlay"]');
        if (joinNowOverlay) {
            joinNowOverlay.style.display = 'none';
        }
        document.querySelector('.VideoPlayerWrapper-sc-19xo1j4-0.keBsYD').style.display = 'none';
        
      });
    }

    // Add download button to playback controls
    // Add download button to playback controls
    function addDownloadButton() {
      const buttonGroup = document.querySelectorAll('.PlaybackContent__ButtonGroup-sc-56y4pr-5.bSupUM')[1];
      if (!buttonGroup || !qualityOptions.length) return;

      // Create download button container
      const downloadContainer = document.createElement('div');
      downloadContainer.className = 'download-button-container';
      downloadContainer.style.display = 'flex';
      downloadContainer.style.alignItems = 'center';
      downloadContainer.style.gap = '8px';

      // Create download link (changed from button to a tag)
      const downloadLink = document.createElement('a');
      downloadLink.className = 'Button-sc-1yank5k-0';
      downloadLink.innerHTML = `
        <svg width="22" height="21" viewBox="0 0 22 21" xmlns="http://www.w3.org/2000/svg" style="margin-right: 5px;">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M11 15.5L6 10.5H9V4.5H13V10.5H16L11 15.5Z" fill="white"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M19 17.5H3V19.5H19V17.5Z" fill="white"/>
        </svg>
        <span>Download</span>
      `;
      downloadLink.style.display = 'flex';
      downloadLink.style.alignItems = 'center';
      downloadLink.style.padding = '6px 12px';
      downloadLink.style.borderRadius = '4px';
      downloadLink.style.backgroundColor = 'rgba(106, 218, 41, 0.7)';
      downloadLink.style.color = 'white';
      downloadLink.style.textDecoration = 'none';
      downloadLink.style.cursor = 'pointer';
      downloadLink.style.fontWeight = '500';
      downloadLink.style.transition = 'all 0.2s ease';
      downloadLink.target = '_blank';
      downloadLink.rel = 'noopener noreferrer';

      // Hover effects
      downloadLink.onmouseenter = () => {
        downloadLink.style.backgroundColor = 'rgba(106, 218, 41, 0.9)';
        downloadLink.style.transform = 'translateY(-1px)';
      };
      downloadLink.onmouseleave = () => {
        downloadLink.style.backgroundColor = 'rgba(106, 218, 41, 0.7)';
        downloadLink.style.transform = 'translateY(0)';
      };

      // Create quality dropdown
      const downloadQualitySelect = document.createElement('select');
      downloadQualitySelect.style.padding = '6px 8px';
      downloadQualitySelect.style.borderRadius = '4px';
      downloadQualitySelect.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
      downloadQualitySelect.style.color = 'black';
      downloadQualitySelect.style.border = '1px solid rgba(0, 0, 0, 0.2)';
      downloadQualitySelect.style.fontSize = '13px';
      downloadQualitySelect.style.cursor = 'pointer';

      // Add quality options
      qualityOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        option.selected = opt.value === savedDownloadQuality;
        downloadQualitySelect.appendChild(option);
      });

      // Set initial download link
      const initialDownloadOption = qualityOptions.find(opt => opt.value === savedDownloadQuality) || qualityOptions[0];
      if (initialDownloadOption) {
        downloadLink.href = initialDownloadOption.link;
        downloadLink.download = initialDownloadOption.filename;
      }

      // Update download link when quality changes
      downloadQualitySelect.addEventListener('change', (e) => {
        const selectedQuality = e.target.value;
        const selectedOption = qualityOptions.find(opt => opt.value === selectedQuality);
        
        if (selectedOption) {
          // Save download quality preference
          localStorage.setItem('vixenDownloadQuality', selectedQuality);
          
          downloadLink.href = selectedOption.link;
          downloadLink.download = selectedOption.filename;
          
          // Visual feedback
          const originalText = downloadLink.querySelector('span').textContent;
          downloadLink.querySelector('span').textContent = 'Downloading...';
          downloadLink.style.backgroundColor = 'rgba(255, 193, 7, 0.7)';
          
          setTimeout(() => {
            downloadLink.querySelector('span').textContent = originalText;
            downloadLink.style.backgroundColor = 'rgba(106, 218, 41, 0.7)';
          }, 1500);
        }
      });

      // Create play button
      const playBtn = document.createElement('button');
      playBtn.className = 'Button-sc-1yank5k-0 play-btn';
      playBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 6px;">
          <path d="M5 3L19 12L5 21V3Z" fill="white"/>
        </svg>
        <span>Play</span>
      `;
      playBtn.style.display = 'flex';
      playBtn.style.alignItems = 'center';
      playBtn.style.justifyContent = 'center';
      playBtn.style.padding = '6px 12px';
      playBtn.style.borderRadius = '4px';
      playBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      playBtn.style.color = 'rgba(255, 255, 255, 0.9)';
      playBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      playBtn.style.cursor = 'pointer';
      playBtn.style.fontWeight = '500';
      playBtn.style.fontSize = '13px';
      playBtn.style.transition = 'all 0.2s ease';

      // Hover effects
      playBtn.onmouseenter = () => {
        playBtn.style.backgroundColor = 'rgba(255, 193, 7, 0.15)';
        playBtn.style.borderColor = 'rgba(255, 193, 7, 0.3)';
        playBtn.style.transform = 'translateY(-1px)';
      };
      playBtn.onmouseleave = () => {
        playBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        playBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        playBtn.style.transform = 'translateY(0)';
      };

      // Click event to mimic [data-test-component="PlayButton"]
      playBtn.addEventListener('click', (e) => {
        console.log('Play button clicked:', playBtn); // Debug
        // Find videoCoverWrapper and playerContainer (defined in createVideoPlayer)
        const videoCoverWrapper = document.querySelector('[data-test-component="VideoCoverWrapper"]');
        const playerContainer = document.querySelector('.video-player-container');
        const videoElement = playerContainer?.querySelector('video');
        if (videoCoverWrapper && playerContainer && videoElement) {
          playerContainer.style.display = 'block';
          videoCoverWrapper.style.display = 'none';
          videoElement.play();
          // Hide overlays
          const joinNowOverlay = document.querySelector('[data-test-component="JoinNowOverlay"]');
          if (joinNowOverlay) {
            joinNowOverlay.style.display = 'none';
          }
          const videoPreviewWrapper = document.querySelector('.VideoPlayerWrapper-sc-19xo1j4-0.keBsYD');
          if (videoPreviewWrapper) {
            videoPreviewWrapper.style.display = 'none';
          }
        } else {
          console.warn('Required elements not found for playBtn click:', { videoCoverWrapper, playerContainer, videoElement });
        }
      });

      // Add elements to container
      downloadContainer.appendChild(downloadLink);
      downloadContainer.appendChild(downloadQualitySelect);
      downloadContainer.appendChild(playBtn);
      buttonGroup.appendChild(downloadContainer);
    }

    addDownloadButton();

    // Add filename copy button to playback controls
    function addFilenameCopyButton() {
      const buttonGroup = document.querySelectorAll('.PlaybackContent__ButtonGroup-sc-56y4pr-5.bSupUM')[1];
      if (!buttonGroup) return;

      // Get video title
      const videoTitleElement = document.querySelector('[data-test-component="VideoTitle"]');
      const videoTitle = videoTitleElement ? videoTitleElement.textContent.trim() : 'Untitled';
      
      // Get release date
      const releaseDateElement = document.querySelector('[data-test-component="ReleaseDateFormatted"]');
      let releaseDate = '24.06.28'; // Default fallback date (YY.MM.DD)
      if (releaseDateElement) {
        const dateText = releaseDateElement.textContent.trim();
        const dateObj = new Date(dateText);
        if (!isNaN(dateObj)) {
          const year = dateObj.getFullYear().toString().slice(-2);
          const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
          const day = dateObj.getDate().toString().padStart(2, '0');
          releaseDate = `${year}.${month}.${day}`;
        }
      }

      // Get domain and capitalize first letter of each word
      const domain = window.location.hostname
        .replace('www.', '')
        .split('.')[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Create filename
      const filename = `${releaseDate} - ${videoTitle} - ${domain}`;

      // Create copy button container
      const copyContainer = document.createElement('div');
      copyContainer.className = 'filename-copy-container';
      copyContainer.style.display = 'flex';
      copyContainer.style.alignItems = 'center';
      copyContainer.style.marginLeft = '15px';
      copyContainer.style.position = 'relative';

      // Create copy button
      const copyButton = document.createElement('button');
      copyButton.className = 'Button-sc-1yank5k-0 filename-copy-btn';
      copyButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 6px;">
          <path d="M8 5H6C4.89543 5 4 5.89543 4 7V19C4 20.1046 4.89543 21 6 21H16C17.1046 21 18 20.1046 18 19V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="8" y="3" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Copy Date & Title</span>
      `;
      copyButton.style.display = 'flex';
      copyButton.style.alignItems = 'center';
      copyButton.style.justifyContent = 'center';
      copyButton.style.padding = '6px 10px';
      copyButton.style.borderRadius = '4px';
      copyButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      copyButton.style.color = 'rgba(255, 255, 255, 0.9)';
      copyButton.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      copyButton.style.cursor = 'pointer';
      copyButton.style.fontWeight = '500';
      copyButton.style.fontSize = '13px';
      copyButton.style.transition = 'all 0.15s ease';
      copyButton.style.minWidth = '120px';

      // Hover effects
      copyButton.onmouseenter = () => {
        copyButton.style.backgroundColor = 'rgba(255, 193, 7, 0.15)';
        copyButton.style.borderColor = 'rgba(255, 193, 7, 0.3)';
        copyButton.style.transform = 'translateY(-1px)';
      };
      copyButton.onmouseleave = () => {
        copyButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        copyButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        copyButton.style.transform = 'translateY(0)';
      };

      // Handle copy click
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(filename).then(() => {
          // Visual feedback
          const originalText = copyButton.querySelector('span').textContent;
          copyButton.querySelector('span').textContent = 'Copied!';
          copyButton.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
          copyButton.style.borderColor = 'rgba(76, 175, 80, 0.4)';
          
          setTimeout(() => {
            copyButton.querySelector('span').textContent = originalText;
            copyButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            copyButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy:', err);
        });
      });

      // Add tooltip
      copyButton.title = `Click to copy: ${filename}`;

      // Add button to container
      copyContainer.appendChild(copyButton);
      buttonGroup.appendChild(copyContainer);
    }

    addFilenameCopyButton();
  }

  // Run the player creation
  createVideoPlayer();
})();

function redirectToVixen() {
  const currentDomain = window.location.hostname.toLowerCase();
  if (currentDomain === 'wifey.com' || currentDomain === 'www.wifey.com') {
    window.location.replace('https://www.vixen.com');
  }
}
// redirectToVixen();