// content.js
var downloadButton
 var downloadQualitySelect
CreateButtons();

function CreateButtons() {
  const el = document.querySelectorAll('.sc-8b1255af-5.gIlYiJ')[1];
  if (!el) return;

  // Prevent duplicates
  if (el.querySelector('#vixen-quality-select')) return;

  // --- Create elements ---
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

  // ✅ Append all buttons first so loadTrailerQualities() can find them
  el.appendChild(downloadButton);
  el.appendChild(copyNameButton);
  el.appendChild(downloadQualitySelect);
  el.appendChild(playButton);

  // ✅ Now load trailer qualities (uses getElementById internally)
  loadTrailerQualities();

  // Copy Name functionality
  copyNameButton.onclick = () => {
    const filename = getFilename();
    navigator.clipboard.writeText(filename).then(() => {
      copyNameButton.textContent = 'Copied!';
      setTimeout(() => (copyNameButton.textContent = 'Copy Name'), 1500);
    });
  };

  // Actions
  // downloadButton.onclick = downloadTrailer;
  playButton.onclick = () => playTrailerInPage(downloadQualitySelect.value);
}

async function loadTrailerQualities() {

  if (!downloadButton || !downloadQualitySelect) {
    console.error('Missing elements for trailer quality setup.');
    return;
  }

  const savedQualityLabel = localStorage.getItem('vixenDownloadQuality');
  const filename = getFilename() + ".mp4";

  try {
    const urls = await getTrailerQualityUrls();
    if (!urls.length) {
      console.error('No trailer URLs found');
      return;
    }

    // Populate select
    downloadQualitySelect.innerHTML = '';
    urls.forEach(({ label, url }) => {
      const option = document.createElement('option');
      option.value = url;
      option.textContent = label;
      downloadQualitySelect.appendChild(option);
    });

    // Restore saved quality
    if (savedQualityLabel) {
      const match = Array.from(downloadQualitySelect.options)
        .find(opt => opt.textContent === savedQualityLabel);
      if (match) downloadQualitySelect.value = match.value;
    }

    // Default to first if none selected
    if (!downloadQualitySelect.value && urls.length > 0)
      downloadQualitySelect.value = urls[0].url;

    // Update download link + filename
    downloadButton.href = downloadQualitySelect.value;
    downloadButton.download = filename;

    // Update when user changes quality
    downloadQualitySelect.onchange = () => {
      const selected = downloadQualitySelect.options[downloadQualitySelect.selectedIndex];
      if (selected) {
        localStorage.setItem('vixenDownloadQuality', selected.textContent);
        downloadButton.href = selected.value;
        downloadButton.download = getFilename() + ".mp4";
      }
    };

  } catch (err) {
    alert('Error loading trailer qualities. See console for details.');
    console.error('Failed to load trailer qualities:', err);
  }
}



function downloadTrailer() {
  const select = downloadQualitySelect
  if (!select || !select.value) {
    alert('Please select a quality first');
    return;
  }

  const videoUrl = select.value;
  const filename = getFilename();
  const a = document.createElement('a');
  a.href = videoUrl;
  a.target = '_blank';
  a.download = filename+".mp4"; // set your custom filename
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


function playTrailerInPage(initialUrl = null) {
  // Find the playback area (not Hero)
  const playbackRoot = document.querySelector('div[data-test-component="PlaybackMedia"]');
  if (!playbackRoot) {
    alert('Playback area not found');
    return;
  }

  // Prevent multiple players
  if (playbackRoot.querySelector('#vixen-inline-player')) {
    console.warn('Trailer player already exists.');
    return;
  }

  // --- Create container for our trailer player ---
  const container = document.createElement('div');
  container.className = 'vixen-player-container';

  // Create <video> tag
  const video = document.createElement('video');
  video.id = 'vixen-inline-player';
  video.className = 'vixen-video';
  video.controls = true;
  video.autoplay = true;
  video.muted = false;
  video.playsInline = true;

  // Create quality selector
  const playSelect = document.createElement('select');
  playSelect.id = 'vixen-inline-quality';
  playSelect.className = 'vixen-select';

  const savedLabel = localStorage.getItem('videoQualityLabel');

  // --- Load trailer URLs ---
  getTrailerQualityUrls().then(urls => {
    playSelect.innerHTML = '';
    urls.forEach(({ label, url }) => {
      const opt = document.createElement('option');
      opt.value = url;
      opt.textContent = label;
      playSelect.appendChild(opt);
    });

    // Restore previous quality
    if (savedLabel) {
      const match = Array.from(playSelect.options).find(o => o.textContent === savedLabel);
      if (match) playSelect.value = match.value;
    }

    // Default to first quality
    if (!playSelect.value && urls.length) playSelect.value = urls[0].url;

    // Set source
    video.src = initialUrl || playSelect.value;
  });

  // Update video when quality changes
  playSelect.onchange = () => {
    video.src = playSelect.value;
    const selectedLabel = playSelect.options[playSelect.selectedIndex].textContent;
    localStorage.setItem('videoQualityLabel', selectedLabel);
  };

  // Add elements to our container
  container.appendChild(video);
  container.appendChild(playSelect);

  // ✅ Insert our trailer container as the first child
  playbackRoot.insertBefore(container, playbackRoot.firstChild);
  document.querySelector('div[data-test-component="Hero"].sc-e04b663a-0.gHGUBv')?.style.setProperty('display', 'none', 'important');

}

function getFilename(){
  // get script tag <script id="__NEXT_DATA__" type="application/json">
  // get title , releaseDate , domain name Capilize first letter (without www. and com)
  // return `YY.MM.DDD - ${title} - ${domainName }.mp4`
  const scriptTag = document.getElementById('__NEXT_DATA__');
  if (!scriptTag) return 'trailer';
  const data = JSON.parse(scriptTag.textContent);
  const title = data.props.pageProps.video.title;
  const releaseDate = data.props.pageProps.video.releaseDate;
  const domainMatch = document.URL.match(/www\.(.+)\.com/);
  const domainName = domainMatch ? domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1) : 'UnknownSite';
  const dateObj = new Date(releaseDate);
  const year = dateObj.getFullYear().toString().slice(-2);
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}.${month}.${day}`;
  return `${formattedDate} - ${title} - ${domainName}`;

}

async function getTrailerQualityUrls() {
  // Step 1: Extract URL components
  const currentSiteUrl = document.URL;
  const siteSlugMatch = currentSiteUrl.match(/[\w\d-]+$/);
  const siteNameMatch = currentSiteUrl.match(/www\.(.+)\.com/);
  const baseUrlMatch = currentSiteUrl.match(/^https\:\/\/[^/]+/);
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
    // Step 2: Get videoId via GraphQL
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

    // Step 3: Get trailer tokens
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

    // Step 4: Build array of { label, value, url }
    const qualityMap = [
      { label: "4K UHD", value: "2160", key: "p2160" },
      { label: "HD 1080p", value: "1080", key: "p1080" },
      { label: "HD 720p", value: "720", key: "p720" },
      { label: "SD 480p", value: "480", key: "p480" },
      { label: "LQ 360p", value: "360", key: "p360" }
    ];

    return qualityMap
      .map(q => ({
        label: q.label,
        quality: q.value,
        url: trailers[q.key]?.token || null
      }))
      .filter(item => item.url !== null)
      .map(({ label, quality, url }) => ({
        label,
        quality,
        url
      }));

  } catch (error) {
    console.error("Failed to fetch trailer URLs:", error);
    return [];
  }
}