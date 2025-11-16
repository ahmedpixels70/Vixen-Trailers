// content.js
var downloadButton;
var downloadQualitySelect;

// Global cross-domain storage for extension
const Storage = {
  async getItem(key) {
    return new Promise(resolve => {
      chrome.storage.local.get(key, result => resolve(result[key]));
    });
  },
  async setItem(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }
};

CreateButtons();

function CreateButtons() {
  const el = document.querySelectorAll('.sc-8b1255af-5.gIlYiJ')[1];
  if (!el) return;

  // Prevent duplicates
  if (el.querySelector('#vixen-quality-select')) return;

  // --- Create buttons ---
  downloadButton = document.createElement('a');
  downloadButton.target = '_blank';
  downloadButton.id = 'vixen-trailer-download-btn';
  downloadButton.className = 'vixen-btn vixen-download-btn';
  downloadButton.textContent = 'Download Trailer';
  downloadButton.rel = 'noopener noreferrer';

  const copyNameButton = document.createElement('button');
  copyNameButton.id = 'vixen-copy-name-btn';
  copyNameButton.className = 'vixen-btn vixen-copy-btn';
  copyNameButton.textContent = 'Copy Name';

  downloadQualitySelect = document.createElement('select');
  downloadQualitySelect.id = 'download-quality-select';
  downloadQualitySelect.className = 'vixen-select';

  const playButton = document.createElement('button');
  playButton.id = 'vixen-trailer-play-btn';
  playButton.className = 'vixen-btn vixen-play-btn';
  playButton.textContent = 'Play Trailer';

  // Append all buttons
  el.appendChild(downloadButton);
  el.appendChild(copyNameButton);
  el.appendChild(downloadQualitySelect);
  el.appendChild(playButton);

  // Load download qualities
  loadTrailerQualities();

  // Copy name
  copyNameButton.onclick = () => {
    const filename = getFilename();
    navigator.clipboard.writeText(filename).then(() => {
      copyNameButton.textContent = 'Copied!';
      setTimeout(() => (copyNameButton.textContent = 'Copy Name'), 1500);
    });
  };

  // Play button → will be wired after video is created
  // Video player is created early, hidden, and shown on click
  createHiddenVideoPlayer().then(() => {
    playButton.onclick = () => {
      const container = document.querySelector('.vixen-player-container');
      container.style.display = 'block';               // show player
      const video = document.getElementById('vixen-inline-player');
      video.play();
      toggleHero(false);                               // hide Hero only on Play
    };
  });
}
function toggleHero(show) {
  const hero = document.querySelector('div[data-test-component="Hero"].sc-e04b663a-0.gHGUBv');
  if (hero) hero.style.display = show ? 'block' : 'none';
}
// ------------------------------------------------------------------
// 1. CREATE HIDDEN VIDEO PLAYER + QUALITY SELECT (custom dropdown)
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// 1. CREATE HIDDEN VIDEO PLAYER + QUALITY SELECT (uses existing CSS classes)
// ------------------------------------------------------------------
async function createHiddenVideoPlayer() {
  const playbackRoot = document.querySelector('div[data-test-component="PlaybackMedia"]');
  if (!playbackRoot) return;

  // remove any old player
  const old = playbackRoot.querySelector('.vixen-player-container');
  if (old) old.remove();

  // ----- container (uses .vixen-player-container) -----
  const container = document.createElement('div');
  container.className = 'vixen-player-container';
  container.style.display = 'none';               // hidden until Play

  // ----- <video> (uses .vixen-video) -----
  const video = document.createElement('video');
  video.id = 'vixen-inline-player';
  video.className = 'vixen-video';
  video.controls = true;
  video.playsInline = true;

  // ----- quality <select> (uses .vixen-select) -----
  const qualitySelect = document.createElement('select');
  qualitySelect.id = 'vixen-inline-quality-select';
  qualitySelect.className = 'vixen-select';

  // ----- load all qualities -----
  const urls = await getTrailerQualityUrls();

  urls.forEach(q => {
    // <source> for the video
    const src = document.createElement('source');
    src.src = q.url;
    src.type = 'video/mp4';
    video.appendChild(src);

    // <option> for the dropdown
    const opt = document.createElement('option');
    opt.value = q.url;
    opt.textContent = q.label;
    qualitySelect.appendChild(opt);
  });

  // ----- keep playback position when switching quality -----
  let pendingSeek = 0;
  let seeking = false;

  qualitySelect.onchange = () => {
    const newUrl = qualitySelect.value;
    pendingSeek = video.currentTime;
    seeking = true;

    // replace all sources with the new one
    video.querySelectorAll('source').forEach(s => s.remove());
    video.removeAttribute('src');

    const newSrc = document.createElement('source');
    newSrc.src = newUrl;
    newSrc.type = 'video/mp4';
    video.appendChild(newSrc);

    video.load();
    const onCanPlay = () => {
      if (seeking) {
        video.currentTime = pendingSeek;
        video.play();
        seeking = false;
      }
      video.removeEventListener('canplay', onCanPlay);
    };
    video.addEventListener('canplay', onCanPlay);
  };

  // ----- restore saved quality -----
  const saved = await Storage.getItem('vixenInlineQuality');
  if (saved) {
    const match = Array.from(qualitySelect.options).find(o => o.textContent === saved);
    if (match) {
      qualitySelect.value = match.value;

      // replace all existing sources with saved one
      video.querySelectorAll('source').forEach(s => s.remove());
      const newSrc = document.createElement('source');
      newSrc.src = match.value;
      newSrc.type = 'video/mp4';
      video.appendChild(newSrc);
      video.load();
    }
  }

  // ----- save quality when changed -----
  qualitySelect.addEventListener('change', () => {
    Storage.setItem('vixenInlineQuality', qualitySelect.selectedOptions[0].textContent);
  });

  // ----- assemble -----
  container.appendChild(video);
  container.appendChild(qualitySelect);
  playbackRoot.insertBefore(container, playbackRoot.firstChild);
}

// ------------------------------------------------------------------
// 2. LOAD DOWNLOAD QUALITY SELECTOR
// ------------------------------------------------------------------
async function loadTrailerQualities() {
  if (!downloadButton || !downloadQualitySelect) return;

  const savedQualityLabel = await Storage.getItem('vixenDownloadQuality');
  const filename = getFilename() + ".mp4";

  try {
    const urls = await getTrailerQualityUrls();
    if (!urls.length) return;

    downloadQualitySelect.innerHTML = '';
    urls.forEach(({ label, url }) => {
      const option = document.createElement('option');
      option.value = url;
      option.textContent = label;
      downloadQualitySelect.appendChild(option);
    });

    // Restore saved
    if (savedQualityLabel) {
      const match = Array.from(downloadQualitySelect.options)
        .find(opt => opt.textContent === savedQualityLabel);
      if (match) downloadQualitySelect.value = match.value;
    }

    if (!downloadQualitySelect.value && urls.length > 0)
      downloadQualitySelect.value = urls[0].url;

    downloadButton.href = downloadQualitySelect.value;
    downloadButton.download = filename;

    downloadQualitySelect.onchange = () => {
      const selected = downloadQualitySelect.options[downloadQualitySelect.selectedIndex];
      if (selected) {
        Storage.setItem('vixenDownloadQuality', selected.textContent);
        downloadButton.href = selected.value;
        downloadButton.download = getFilename() + ".mp4";
      }
    };

  } catch (err) {
    console.error('Failed to load trailer qualities:', err);
  }
}

// ------------------------------------------------------------------
// 3. GET FILENAME
// ------------------------------------------------------------------
function getFilename() {
  const scriptTag = document.getElementById('__NEXT_DATA__');
  if (!scriptTag) return 'trailer';

  const data = JSON.parse(scriptTag.textContent);
  const title = data.props.pageProps.video.title;
  const releaseDate = data.props.pageProps.video.releaseDate;

  const domainMatch = document.URL.match(/www\.(.+)\.com/);
  const domainName = domainMatch
    ? domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1)
    : 'UnknownSite';

  const dateObj = new Date(releaseDate);
  const year = dateObj.getFullYear().toString().slice(-2);
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}.${month}.${day}`;

  return `${formattedDate} - ${title} - ${domainName}`;
}

// ------------------------------------------------------------------
// 4. FETCH TRAILER URLS (ALL QUALITIES)
// ------------------------------------------------------------------
async function getTrailerQualityUrls() {
  const currentSiteUrl = document.URL;
  const siteSlugMatch = currentSiteUrl.match(/[\w\d-]+$/);
  const siteNameMatch = currentSiteUrl.match(/www\.(.+)\.com/);
  const baseUrlMatch = currentSiteUrl.match(/^https?:\/\/[^/]+/);
  const noProtocolMatch = currentSiteUrl.match(/www\.(.+)/);

  if (!siteSlugMatch || !siteNameMatch || !baseUrlMatch || !noProtocolMatch) {
    console.error("Could not parse URL components");
    return [];
  }

  const siteSlug = siteSlugMatch[0];
  const siteName = siteNameMatch[1].toUpperCase();
  const baseUrl = baseUrlMatch[0];
  const noProtocolUrl = noProtocolMatch[1];

  try {
    const videoIdResponse = await fetch(baseUrl + "/graphql", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query Video($videoSlug: String, $site: Site) {
            findOneVideo(input: {slug: $videoSlug, site: $site}) {
              videoId
            }
          }
        `,
        variables: { videoSlug: siteSlug, site: siteName }
      })
    });

    const videoIdJson = await videoIdResponse.json();
    const videoId = videoIdJson.data?.findOneVideo?.videoId;
    if (!videoId) throw new Error("Video ID not found");

    const trailerResponse = await fetch(baseUrl + "/graphql", {
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
        variables: { videoId, device: "trailer" }
      })
    });

    const trailerJson = await trailerResponse.json();
    const trailers = trailerJson.data?.generateVideoToken;
    if (!trailers) throw new Error("No trailer data received");

    const qualityMap = [
      { label: "4K UHD", key: "p2160" },
      { label: "HD 1080p", key: "p1080" },
      { label: "HD 720p", key: "p720" },
      { label: "SD 480p", key: "p480" },
      { label: "LQ 360p", key: "p360" }
    ];

    return qualityMap
      .map(q => ({
        label: q.label,
        url: trailers[q.key]?.token || null
      }))
      .filter(item => item.url !== null);

  } catch (error) {
    console.error("Failed to fetch trailer URLs:", error);
    return [];
  }
}