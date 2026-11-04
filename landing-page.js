import { landingConfig } from './landing-config.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const lines = value => escape(value).replaceAll('\n', '<br>');

function renderTitlePlane(language, title) {
  const titles = title[language] || landingConfig.title[language];
  const offsets = title.lineOffsets || landingConfig.title.lineOffsets;
  return `<span class="landing-language-plane" data-language-plane="${language}" lang="${language}" aria-hidden="${language === 'ja'}">${titles.slice(0, 3).map((text, index) => `<span class="landing-title-line" data-landing-line style="--landing-line-offset:${Number(offsets[index]) || 0}%">${escape(text)}</span>`).join('')}</span>`;
}

function renderWork(work, index, brand) {
  const id = `landing-work-${index + 1}`;
  return `<section class="landing-work landing-work--${escape(work.treatment)}" id="${id}" data-landing-work data-landing-work-index="${index}" aria-labelledby="${id}-title">
    <div class="landing-work-label"><span>${escape(work.number)} / ${escape(work.category)}</span><span>${escape(work.signature || brand.text || brand.name)}</span></div>
    <figure class="landing-work-figure"><a class="landing-work-media" href="${escape(work.href)}" aria-label="${escape(work.title)} · ${escape(work.linkLabel)}"><img class="landing-work-image" src="${escape(work.image)}" alt="${escape(work.imageAlt)}" width="${Number(work.imageWidth) || 1536}" height="${Number(work.imageHeight) || 1024}" loading="lazy" decoding="async"><span class="landing-work-image-arrow" aria-hidden="true">↗</span></a></figure>
    <div class="landing-work-caption"><h2 id="${id}-title">${escape(work.title)}</h2><div><p>${lines(work.description)}</p><a class="landing-work-link" href="${escape(work.href)}">${escape(work.linkLabel)} <span aria-hidden="true">↗</span></a></div></div>
  </section>`;
}

export function renderLanding(config = landingConfig) {
  const brand = config.brand || landingConfig.brand;
  const title = config.title || landingConfig.title;
  const navigation = config.navigation || landingConfig.navigation;
  const intro = config.intro || landingConfig.intro;
  const works = Array.isArray(config.works) && config.works.length === 2 ? config.works : landingConfig.works;
  const footer = config.footer || landingConfig.footer;
  const palette = config.background?.palette || landingConfig.background.palette;
  const paletteStyle = ['black', 'orange', 'teal', 'cobalt', 'navy'].map(key => `--landing-${key}:${escape(/^#[0-9a-f]{3,8}$/i.test(palette[key]) ? palette[key] : landingConfig.background.palette[key])}`).join(';');
  return `<main id="content" class="landing-page" data-landing tabindex="-1" style="${paletteStyle}">
    <a class="landing-skip-link" href="#landing-work-1">콘텐츠로 바로 이동</a>
    <section class="landing-hero" id="landing-top" data-landing-hero aria-labelledby="landing-heading" style="${paletteStyle}">
      <canvas class="landing-background" data-landing-background aria-hidden="true"></canvas>
      <div class="landing-hero-shade" aria-hidden="true"></div>
      <header class="landing-header"><a class="landing-brand" href="${escape(brand.href || '/?')}" aria-label="${escape(brand.text)} 홈">${brand.logo ? `<img src="${escape(brand.logo)}" alt="${escape(brand.text)}" style="filter:${brand.logoInvert === false ? 'none' : 'invert(1)'}">` : escape(brand.text)}</a><nav class="landing-nav" aria-label="랜딩 주요 메뉴">${navigation.map(item => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join('')}</nav></header>
      <div class="landing-title-stage"><div class="landing-title-wrap" data-landing-title><h1 class="landing-title" id="landing-heading">${renderTitlePlane('en', title)}${renderTitlePlane('ja', title)}</h1><canvas class="landing-text-canvas" data-landing-text-canvas aria-hidden="true"></canvas></div></div>
      <div class="landing-hero-bottom"><div class="landing-intro"><span class="landing-eyebrow">${escape(intro.label)}</span><p>${lines(intro.text)}</p></div><div class="landing-hero-actions"><button class="landing-language" type="button" data-landing-language aria-label="일본어로 보기" aria-pressed="false"><span class="landing-language-label" data-language-label><span lang="en">EN</span><span class="landing-language-divider" aria-hidden="true">/</span><span lang="ja">日本語</span></span></button><a class="landing-scroll-link" href="#landing-work-1">${escape(intro.scrollLabel)}<span aria-hidden="true">↓</span></a></div></div>
      <div class="landing-lens" data-landing-lens aria-hidden="true"></div>
    </section>
    <aside class="landing-progress" data-landing-progress role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="작업 소개 스크롤 진행률"><span class="landing-progress-label">01</span><div class="landing-progress-track"><span class="landing-progress-marker" data-landing-progress-marker></span></div><span class="landing-progress-label">02</span></aside>
    <div class="landing-works">${works.map((work, index) => renderWork(work, index, brand)).join('')}</div>
    <footer class="landing-footer"><a class="landing-footer-brand" href="${escape(brand.href || '/?')}">${escape(brand.text)}</a><span>${escape(footer.copyright)}<br>${escape(footer.text)}</span><a class="landing-back-top" href="#landing-top">${escape(footer.backLabel)} <span aria-hidden="true">↑</span></a></footer>
  </main>`;
}
