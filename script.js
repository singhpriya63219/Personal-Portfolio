// ============================================================
// 1. THREE.JS — INTERACTIVE 3D PARTICLE BACKGROUND
// ============================================================
(function initThreeBackground() {
  const canvas = document.getElementById("three-bg");
  if (!canvas || typeof THREE === "undefined") return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 50;

  // --- Particle system ---
  const PARTICLE_COUNT = 1800;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const velocities = []; // for subtle drift

  const palette = [
    new THREE.Color("#3b82f6"), // blue
    new THREE.Color("#8b5cf6"), // purple
    new THREE.Color("#6366f1"), // indigo
    new THREE.Color("#a855f7"), // violet
    new THREE.Color("#ec4899"), // pink
    new THREE.Color("#06b6d4"), // cyan
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * 160;
    positions[i3 + 1] = (Math.random() - 0.5) * 160;
    positions[i3 + 2] = (Math.random() - 0.5) * 100;

    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i3]     = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    sizes[i] = Math.random() * 2.5 + 0.5;

    velocities.push({
      x: (Math.random() - 0.5) * 0.015,
      y: (Math.random() - 0.5) * 0.015,
      z: (Math.random() - 0.5) * 0.008,
    });
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  // Custom shader material for soft glowing dots
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vec3 pos = position;

        // Subtle wave motion
        pos.x += sin(uTime * 0.3 + position.y * 0.05) * 0.8;
        pos.y += cos(uTime * 0.2 + position.x * 0.05) * 0.8;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        float dist = length(mvPosition.xyz);
        vAlpha = smoothstep(120.0, 20.0, dist) * 0.8;

        gl_PointSize = size * uPixelRatio * (50.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;

        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        glow = pow(glow, 1.5);

        gl_FragColor = vec4(vColor, glow * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // --- Connection lines between nearby particles ---
  const MAX_CONNECTIONS = 600;
  const linePositions = new Float32Array(MAX_CONNECTIONS * 6);
  const lineColors = new Float32Array(MAX_CONNECTIONS * 6);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
  lineGeometry.setDrawRange(0, 0);

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  // --- Mouse interaction ---
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  document.addEventListener("mousemove", (e) => {
    mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // --- Scroll-based camera depth ---
  let scrollY = 0;
  window.addEventListener("scroll", () => {
    scrollY = window.pageYOffset;
  });

  // --- Resize ---
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  });

  // --- Animation loop ---
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Smooth mouse follow
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // Rotate scene based on mouse
    particles.rotation.y = mouse.x * 0.15;
    particles.rotation.x = mouse.y * 0.1;

    // Scroll-driven camera Z
    camera.position.z = 50 + scrollY * 0.01;

    // Update particle drift
    const posArray = particleGeometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      posArray[i3]     += velocities[i].x;
      posArray[i3 + 1] += velocities[i].y;
      posArray[i3 + 2] += velocities[i].z;

      // Wrap particles around boundaries
      if (posArray[i3] > 80) posArray[i3] = -80;
      if (posArray[i3] < -80) posArray[i3] = 80;
      if (posArray[i3 + 1] > 80) posArray[i3 + 1] = -80;
      if (posArray[i3 + 1] < -80) posArray[i3 + 1] = 80;
      if (posArray[i3 + 2] > 50) posArray[i3 + 2] = -50;
      if (posArray[i3 + 2] < -50) posArray[i3 + 2] = 50;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // Update connections
    let lineIndex = 0;
    const CONNECTION_DIST = 18;
    const linePos = lineGeometry.attributes.position.array;
    const lineCol = lineGeometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS; i++) {
      const i3 = i * 3;
      for (let j = i + 1; j < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS; j++) {
        const j3 = j * 3;
        const dx = posArray[i3] - posArray[j3];
        const dy = posArray[i3 + 1] - posArray[j3 + 1];
        const dz = posArray[i3 + 2] - posArray[j3 + 2];
        const dist = dx * dx + dy * dy + dz * dz;

        if (dist < CONNECTION_DIST * CONNECTION_DIST) {
          const li = lineIndex * 6;
          linePos[li]     = posArray[i3];
          linePos[li + 1] = posArray[i3 + 1];
          linePos[li + 2] = posArray[i3 + 2];
          linePos[li + 3] = posArray[j3];
          linePos[li + 4] = posArray[j3 + 1];
          linePos[li + 5] = posArray[j3 + 2];

          const alpha = 1 - dist / (CONNECTION_DIST * CONNECTION_DIST);
          lineCol[li]     = 0.38 * alpha;
          lineCol[li + 1] = 0.51 * alpha;
          lineCol[li + 2] = 0.96 * alpha;
          lineCol[li + 3] = 0.55 * alpha;
          lineCol[li + 4] = 0.36 * alpha;
          lineCol[li + 5] = 0.96 * alpha;

          lineIndex++;
        }
      }
    }
    lineGeometry.setDrawRange(0, lineIndex * 2);
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;

    // Update uniforms
    particleMaterial.uniforms.uTime.value = elapsed;
    particleMaterial.uniforms.uMouse.value.set(mouse.x, mouse.y);

    renderer.render(scene, camera);
  }

  animate();
})();


// ============================================================
// 2. MOUSE-FOLLOWING CURSOR GLOW
// ============================================================
(function initCursorGlow() {
  const glow = document.getElementById("cursorGlow");
  if (!glow) return;

  let glowX = 0, glowY = 0;
  let targetX = 0, targetY = 0;

  document.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  function updateGlow() {
    glowX += (targetX - glowX) * 0.08;
    glowY += (targetY - glowY) * 0.08;
    glow.style.left = glowX + "px";
    glow.style.top = glowY + "px";
    requestAnimationFrame(updateGlow);
  }

  updateGlow();

  // Hide on touch devices
  if ("ontouchstart" in window) {
    glow.style.display = "none";
  }
})();


// ============================================================
// 3. 3D TILT EFFECT ON CARDS
// ============================================================
(function initTiltCards() {
  const cards = document.querySelectorAll("[data-tilt]");

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -8;  // max 8deg
      const rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    });
  });
})();


// ============================================================
// 4. MOBILE MENU FUNCTIONALITY (preserved)
// ============================================================
const hamburgerBtn = document.getElementById("hamburgerBtn");
const hamburgerIcon = document.getElementById("hamburgerIcon");
const mobileMenu = document.getElementById("mobileMenu");
const mobileBackdrop = document.getElementById("mobileBackdrop");
const mobileMenuLinks = document.querySelectorAll(".mobile-menu-link");
let isMenuOpen = false;

function toggleMobileMenu() {
  isMenuOpen = !isMenuOpen;

  if (isMenuOpen) {
    mobileMenu.classList.add("active");
    mobileBackdrop.classList.add("active");
    hamburgerIcon.classList.add("active");
    hamburgerIcon.classList.remove("fa-bars");
    hamburgerIcon.classList.add("fa-times");
    document.body.style.overflow = "hidden";
  } else {
    mobileMenu.classList.remove("active");
    mobileBackdrop.classList.remove("active");
    hamburgerIcon.classList.remove("active");
    hamburgerIcon.classList.remove("fa-times");
    hamburgerIcon.classList.add("fa-bars");
    document.body.style.overflow = "auto";
  }
}

hamburgerBtn.addEventListener("click", toggleMobileMenu);
mobileBackdrop.addEventListener("click", toggleMobileMenu);

mobileMenuLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (isMenuOpen) {
      toggleMobileMenu();
    }
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isMenuOpen) {
    toggleMobileMenu();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 768 && isMenuOpen) {
    toggleMobileMenu();
  }
});


// ============================================================
// 5. CONTACT FORM (preserved)
// ============================================================
function submitForm(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Sending...";
  submitBtn.disabled = true;

  fetch(form.action, {
    method: "POST",
    body: formData,
  })
    .then((response) => response.text())
    .then((data) => {
      alert("Message sent successfully!");
      form.reset();
    })
    .catch((error) => {
      console.error("Error!", error.message);
      alert("There was an error. Please try again later.");
    })
    .finally(() => {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    });
}


// ============================================================
// 6. SMOOTH SCROLLING (preserved)
// ============================================================
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});


// ============================================================
// 7. SCROLL-TRIGGERED ANIMATIONS (enhanced)
// ============================================================
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
      entry.target.classList.add("in-view");
    }
  });
}, observerOptions);

document.querySelectorAll(".animate-slide-up, .animate-fade-in").forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(30px)";
  el.style.transition = "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
  observer.observe(el);
});


// ============================================================
// 8. PARALLAX FLOATING SHAPES (enhanced 3D)
// ============================================================
window.addEventListener("scroll", () => {
  const scrolled = window.pageYOffset;
  const shapes = document.querySelectorAll(".shape");
  shapes.forEach((shape, index) => {
    const speed = 0.3 + index * 0.15;
    const rotate = scrolled * (0.02 + index * 0.01);
    shape.style.transform = `translateY(${scrolled * speed}px) rotate(${rotate}deg) scale(${1 + Math.sin(scrolled * 0.002) * 0.1})`;
  });
});


// ============================================================
// 9. ACTIVE NAV HIGHLIGHTING (preserved)
// ============================================================
window.addEventListener("scroll", () => {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll('nav a[href^="#"]');

  let current = "";
  sections.forEach((section) => {
    const sectionTop = section.offsetTop;
    if (scrollY >= sectionTop - 200) {
      current = section.getAttribute("id");
    }
  });

  navLinks.forEach((link) => {
    link.classList.remove("text-blue-400");
    link.classList.add("text-gray-300");
    if (link.getAttribute("href") === `#${current}`) {
      link.classList.remove("text-gray-300");
      link.classList.add("text-blue-400");
    }
  });
});


// ============================================================
// 10. PROGRESS BAR ANIMATION ON SCROLL
// ============================================================
(function initProgressBars() {
  const progressBars = document.querySelectorAll(".progress-fill");

  const progressObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const targetWidth = bar.style.width;
          bar.style.width = "0%";
          bar.style.transition = "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)";
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              bar.style.width = targetWidth;
            });
          });
          progressObserver.unobserve(bar);
        }
      });
    },
    { threshold: 0.5 }
  );

  progressBars.forEach((bar) => progressObserver.observe(bar));
})();


// ============================================================
// 11. NAV BACKGROUND ON SCROLL
// ============================================================
(function initNavScroll() {
  const nav = document.querySelector("nav");
  if (!nav) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      nav.style.boxShadow = "0 4px 30px rgba(0, 0, 0, 0.4)";
    } else {
      nav.style.boxShadow = "";
    }
  });
})();