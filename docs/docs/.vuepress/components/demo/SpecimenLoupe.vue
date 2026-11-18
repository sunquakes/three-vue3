<!--
  The loupe that rides above the fern patch. It is mounted through the library
  `Popup` (a CSS2DObject), so the card stays glued to the specimen in world
  space under both renderers. The patch texture is blown up inside a round
  aperture so the find on the rim reads at instrument scale.
-->
<template>
  <div class="loupe">
    <div class="loupe__card">
      <div class="loupe__header">
        <span class="loupe__dot"></span>
        LOUPE
        <span class="loupe__zoom">×8.0</span>
      </div>
      <div class="loupe__viewport">
        <div class="loupe__specimen"></div>
        <div class="loupe__grid"></div>
        <div class="loupe__scan"></div>
        <svg
          class="loupe__reticle"
          width="144"
          height="144"
          viewBox="0 0 128 128"
          aria-hidden="true"
        >
          <circle
            cx="64"
            cy="64"
            r="43"
            fill="none"
            stroke="rgba(142, 240, 184, 0.4)"
            stroke-width="0.8"
            stroke-dasharray="3 8"
          />
          <path
            d="M64 12v12M64 104v12M12 64h12M104 64h12"
            stroke="rgba(142, 240, 184, 0.75)"
            stroke-width="1"
          />
        </svg>
      </div>
      <div class="loupe__footer">
        <span>FERN PATCH · 01</span>
        <span class="loupe__live">LIVE SCAN</span>
      </div>
    </div>
    <div class="loupe__stalk"></div>
    <div class="loupe__anchor"></div>
  </div>
</template>

<style scoped>
.loupe {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 188px;
  pointer-events: none;
  user-select: none;
}

.loupe__card {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 10px;
  background: rgba(8, 22, 20, 0.9);
  border: 1px solid rgba(142, 240, 184, 0.36);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.6);
}

.loupe__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #cdfbe0;
}

.loupe__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8ef0b8;
  box-shadow: 0 0 8px #8ef0b8;
}

.loupe__zoom {
  margin-left: auto;
  color: #8ef0b8;
}

.loupe__viewport {
  position: relative;
  width: 144px;
  height: 144px;
  margin: 0 auto;
  border-radius: 50%;
  overflow: hidden;
  background: #0d1f16;
  box-shadow:
    inset 0 0 18px rgba(0, 0, 0, 0.9),
    0 0 12px rgba(142, 240, 184, 0.16);
}

.loupe__specimen {
  position: absolute;
  inset: 0;
  background-image: url('/models/fern_02/textures/fern_02_diff_1k.jpg');
  background-size: 560%;
  background-position: 37% 62%;
  filter: saturate(1.3) contrast(1.12) brightness(1.08);
  animation: r3l-loupe-drift 14s ease-in-out infinite;
}

.loupe__grid {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.64) 100%),
    repeating-linear-gradient(rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px, rgba(0, 26, 16, 0.34) 3px);
  pointer-events: none;
}

.loupe__scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    rgba(142, 240, 184, 0) 0%,
    rgba(142, 240, 184, 0.85) 50%,
    rgba(142, 240, 184, 0) 100%
  );
  animation: r3l-loupe-scan 5.5s linear infinite;
  pointer-events: none;
}

.loupe__reticle {
  position: absolute;
  inset: 0;
}

.loupe__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 8px;
  letter-spacing: 0.12em;
  color: rgba(174, 240, 255, 0.72);
}

.loupe__live {
  color: #8ef0b8;
}

.loupe__stalk {
  width: 1px;
  height: 20px;
  background: linear-gradient(rgba(142, 240, 184, 0.9), rgba(142, 240, 184, 0.05));
}

.loupe__anchor {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8ef0b8;
  box-shadow: 0 0 8px #8ef0b8;
}

@keyframes r3l-loupe-drift {
  0% {
    transform: scale(1.04) translate3d(0, 0, 0);
  }
  50% {
    transform: scale(1.14) translate3d(-4px, -6px, 0);
  }
  100% {
    transform: scale(1.04) translate3d(0, 0, 0);
  }
}

@keyframes r3l-loupe-scan {
  0% {
    top: -4%;
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  100% {
    top: 104%;
    opacity: 0;
  }
}
</style>
