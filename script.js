(() => {
  const TOTAL_FRAMES = 300;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const navbar = document.getElementById('navbar');

  const landingHero = document.getElementById('landingHero');
  const landingOverlay = document.getElementById('landingOverlay');

  const endingHero = document.getElementById('endingHero');
  const endingOverlay = document.getElementById('endingOverlay');

  // Modals & Interactivity elements
  const planTripModal = document.getElementById('planTripModal');
  const joinTripModal = document.getElementById('joinTripModal');
  const toastNotification = document.getElementById('toastNotification');

  const images = new Array(TOTAL_FRAMES + 1);
  const loaded = new Array(TOTAL_FRAMES + 1).fill(false);

  let targetProgress = 0;
  let currentProgress = 0;
  let displayedFrame = -1;
  const LERP_SPEED = 0.12;

  const getFramePath = (index) => {
    const padded = String(index).padStart(3, '0');
    return `images/ezgif-frame-${padded}.jpg`;
  };

  // Find the closest loaded frame to avoid any blank flashes
  const getNearestLoaded = (index) => {
    if (loaded[index] && images[index]) return images[index];

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 1 && loaded[prev] && images[prev]) return images[prev];

      const next = index + offset;
      if (next <= TOTAL_FRAMES && loaded[next] && images[next]) return images[next];
    }

    return null;
  };

  // Render frame to canvas with object-fit: cover and HiDPI scaling
  const renderFrame = (index, force = false) => {
    const img = getNearestLoaded(index);
    if (!img) return;

    if (!force && displayedFrame === index && img === images[index]) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const bufferW = Math.round(width * dpr);
    const bufferH = Math.round(height * dpr);

    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const imgW = img.naturalWidth || 1280;
    const imgH = img.naturalHeight || 720;
    const scale = Math.max(width / imgW, height / imgH);

    const renderW = imgW * scale;
    const renderH = imgH * scale;
    const offsetX = (width - renderW) / 2;
    const offsetY = (height - renderH) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    ctx.restore();

    displayedFrame = index;
  };

  const setProgress = (val) => {
    targetProgress = Math.max(0, Math.min(1, val));
  };

  // 1. Native Window Scroll handler
  const onScroll = () => {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    setProgress(scrollY / maxScroll);
  };

  // 2. Direct Wheel / Trackpad handler
  window.addEventListener('wheel', (e) => {
    // Only scroll if modals are closed
    if (planTripModal?.classList.contains('active') || joinTripModal?.classList.contains('active')) {
      return;
    }
    const travelDistance = window.innerHeight * 4;
    setProgress(targetProgress + (e.deltaY / travelDistance));
  }, { passive: true });

  // 3. Touch Dragging for mobile / touchscreens
  let lastTouchY = null;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      lastTouchY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (planTripModal?.classList.contains('active') || joinTripModal?.classList.contains('active')) {
      return;
    }
    if (e.touches.length > 0 && lastTouchY !== null) {
      const currentY = e.touches[0].clientY;
      const deltaY = lastTouchY - currentY;
      lastTouchY = currentY;
      const travelDistance = window.innerHeight * 3;
      setProgress(targetProgress + (deltaY / travelDistance));
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    lastTouchY = null;
  }, { passive: true });

  // 4. Keyboard Arrow / Page Keys
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModals();
    }
    if (planTripModal?.classList.contains('active') || joinTripModal?.classList.contains('active')) {
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      setProgress(targetProgress + 0.03);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      setProgress(targetProgress - 0.03);
    }
  });

  // Animation Loop
  const loop = () => {
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.0001) {
      currentProgress += diff * LERP_SPEED;
    } else {
      currentProgress = targetProgress;
    }

    const frameIndex = Math.min(
      TOTAL_FRAMES,
      Math.max(1, Math.round(1 + currentProgress * (TOTAL_FRAMES - 1)))
    );

    renderFrame(frameIndex);

    // 1. Navbar: persistent with glassmorphism when scrolled
    if (navbar) {
      if (currentProgress > 0.015) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }

    // 2. Landing UI: Fades out in the initial 6% of scroll
    const LANDING_FADE = 0.06;
    const landingRatio = Math.min(1, currentProgress / LANDING_FADE);
    const landingOpacity = Math.max(0, 1 - landingRatio);

    if (landingHero) {
      landingHero.style.opacity = landingOpacity;
      landingHero.style.transform = `translateY(${-landingRatio * 35}px)`;
      landingHero.style.pointerEvents = landingOpacity <= 0.05 ? 'none' : 'auto';
      landingHero.style.visibility = landingOpacity <= 0.01 ? 'hidden' : 'visible';
    }

    if (landingOverlay) {
      landingOverlay.style.opacity = landingOpacity;
      landingOverlay.style.visibility = landingOpacity <= 0.01 ? 'hidden' : 'visible';
    }

    // 3. Ending UI: Fades in on approaching the last frame (85% to 100%)
    const END_START = 0.85;
    let endingOpacity = 0;
    if (currentProgress >= END_START) {
      endingOpacity = Math.min(1, (currentProgress - END_START) / (1 - END_START));
    }

    if (endingHero) {
      endingHero.style.opacity = endingOpacity;
      endingHero.style.transform = `translateY(${(1 - endingOpacity) * 35}px)`;
      endingHero.style.pointerEvents = endingOpacity >= 0.8 ? 'auto' : 'none';
      endingHero.style.visibility = endingOpacity <= 0.01 ? 'hidden' : 'visible';
    }

    if (endingOverlay) {
      endingOverlay.style.opacity = endingOpacity;
      endingOverlay.style.visibility = endingOpacity <= 0.01 ? 'hidden' : 'visible';
    }

    requestAnimationFrame(loop);
  };

  // Preload all 300 frames
  const preload = () => {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        loaded[i] = true;
        images[i] = img;
        if (i === 1 && displayedFrame === -1) {
          renderFrame(1, true);
        }
      };
      images[i] = img;
    }
  };

  // Modal Handlers
  const openPlanModal = () => {
    planTripModal?.classList.add('active');
  };

  const openJoinModal = () => {
    joinTripModal?.classList.add('active');
    document.getElementById('joinCodeInput')?.focus();
  };

  const closeModals = () => {
    planTripModal?.classList.remove('active');
    joinTripModal?.classList.remove('active');
  };

  const showToast = (message) => {
    if (!toastNotification) return;
    toastNotification.textContent = message;
    toastNotification.classList.add('active');
    setTimeout(() => {
      toastNotification.classList.remove('active');
    }, 4000);
  };

  // Wire up interactive buttons & CTAs
  // 1. Navigation
  document.getElementById('navPlanTripBtn')?.addEventListener('click', openPlanModal);
  document.getElementById('navSignInBtn')?.addEventListener('click', () => {
    showToast('Redirecting to Neon Auth secure sign-in...');
  });
  document.getElementById('navPlannerLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    openPlanModal();
  });
  document.getElementById('navExpensesLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Expense Tracker: Open a trip to track integer paise splits & settlements.');
  });
  document.getElementById('searchBtn')?.addEventListener('click', openPlanModal);

  // 2. Start Frame CTAs
  document.getElementById('startPlanningCta')?.addEventListener('click', openPlanModal);
  document.getElementById('joinTripCta')?.addEventListener('click', openJoinModal);
  document.getElementById('searchSubmitBtn')?.addEventListener('click', openPlanModal);
  document.getElementById('searchFieldDestination')?.addEventListener('click', openPlanModal);
  document.getElementById('searchFieldDates')?.addEventListener('click', openPlanModal);
  document.getElementById('searchFieldTravelers')?.addEventListener('click', openPlanModal);

  // 3. End Frame CTAs
  document.getElementById('endPlanTripCta')?.addEventListener('click', openPlanModal);
  document.getElementById('endJoinTripCta')?.addEventListener('click', openJoinModal);
  document.getElementById('endSearchSubmitBtn')?.addEventListener('click', openPlanModal);

  // Modal Close buttons
  document.getElementById('closePlanModal')?.addEventListener('click', closeModals);
  document.getElementById('cancelPlanBtn')?.addEventListener('click', closeModals);
  document.getElementById('closeJoinModal')?.addEventListener('click', closeModals);
  document.getElementById('cancelJoinBtn')?.addEventListener('click', closeModals);

  // Close when clicking outside modal card
  planTripModal?.addEventListener('click', (e) => {
    if (e.target === planTripModal) closeModals();
  });
  joinTripModal?.addEventListener('click', (e) => {
    if (e.target === joinTripModal) closeModals();
  });

  // Handle Plan Trip Form Submission
  document.getElementById('planTripForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const dest = document.getElementById('tripDestination').value;
    const type = document.getElementById('tripType').value;
    const people = document.getElementById('peopleCount').value;
    const budget = document.getElementById('budgetPaise').value;
    closeModals();
    showToast(`Voyara AI drafting ${dest} ${type} itinerary (${people} people, ₹${budget})...`);
  });

  // Handle Join Trip Form Submission
  document.getElementById('joinTripForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
    closeModals();
    showToast(`Joining trip with code ${code}... Validating Neon Auth session.`);
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    onScroll();
    const frameIndex = Math.min(
      TOTAL_FRAMES,
      Math.max(1, Math.round(1 + currentProgress * (TOTAL_FRAMES - 1)))
    );
    renderFrame(frameIndex, true);
  });

  preload();
  onScroll();
  requestAnimationFrame(loop);
})();
