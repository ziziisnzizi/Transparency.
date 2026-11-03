import assert from 'node:assert/strict';
import { test } from 'node:test';
import { products } from '../products.js';
import {
  researchPapers,
  INFORMATION_CHECKS,
  RESEARCH_CHECKED_AT,
  getInformationCoverage,
  getResearchIngredients,
  getProductResearch,
} from '../evidence-data.js';
import { renderProductEvidence } from '../evidence.js';

const checkKeys = ['bibliography', 'design', 'population', 'intervention', 'comparator', 'results'];
const idsByProduct = {
  'serum-s1': ['glycerin', 'panthenol', 'hyaluronic-acid'],
  'toner-t1': ['glycerin', 'panthenol', 'beta-glucan'],
  'cream-c1': ['glycerin', 'squalane', 'ceramide-np'],
};
const ingredientIds = new Set(Object.values(idsByProduct).flat());
const sourceHosts = new Set([
  'doi.org', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov',
  'www.kci.go.kr', 'kci.go.kr', 'scienceon.kisti.re.kr',
  'koreascience.kr', 'www.koreascience.or.kr', 'koreascience.or.kr',
  'www.dbpia.co.kr', 'dbpia.co.kr', 'www.riss.kr', 'riss.kr',
  'link.springer.com', 'onlinelibrary.wiley.com', 'academic.oup.com',
  'www.sciencedirect.com', 'sciencedirect.com', 'journals.sagepub.com',
  'www.tandfonline.com', 'tandfonline.com', 'www.mdpi.com', 'mdpi.com',
  'www.nature.com', 'nature.com', 'www.frontiersin.org', 'frontiersin.org',
]);
const allChecks = Object.fromEntries(checkKeys.map(key => [key, true]));

function nonempty(value, label) {
  assert.equal(typeof value, 'string', `${label} must be text`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

test('the coverage denominator contains six explicit research-information checks', () => {
  assert.deepEqual(INFORMATION_CHECKS.map(check => check.key), checkKeys);
  assert.equal(new Set(INFORMATION_CHECKS.map(check => check.key)).size, 6);
  for (const check of INFORMATION_CHECKS) {
    nonempty(check.label, check.key);
    nonempty(check.description, check.key);
  }
  assert.deepEqual(getInformationCoverage([{ checks: allChecks }]), { percent: 100, confirmed: 6, total: 6 });
});

test('coverage aggregates confirmed fields across papers before rounding the fraction', () => {
  const partial = { ...allChecks, comparator: false };
  assert.deepEqual(getInformationCoverage([{ checks: allChecks }, { checks: partial }]), {
    percent: 92, confirmed: 11, total: 12,
  });
  assert.deepEqual(getInformationCoverage([{ checks: {} }]), { percent: 0, confirmed: 0, total: 6 });
});

test('only explicit boolean true counts; missing, false, truthy strings and unrelated flags do not', () => {
  const paper = {
    checks: {
      bibliography: true,
      design: false,
      population: 'true',
      intervention: 1,
      comparator: null,
      efficacy: true,
    },
  };
  assert.deepEqual(getInformationCoverage([paper]), { percent: 17, confirmed: 1, total: 6 });
  assert.deepEqual(getInformationCoverage([paper, {}]), { percent: 8, confirmed: 1, total: 12 });
});

test('no connected papers means an unavailable percentage, never a zero-effect estimate', () => {
  for (const value of [[], undefined, null, {}, 'not papers']) {
    assert.deepEqual(getInformationCoverage(value), { percent: null, confirmed: 0, total: 0 });
  }
});

test('coverage and product lookup leave supplied records and published catalog data untouched', () => {
  const input = Object.freeze([
    Object.freeze({ checks: Object.freeze({ ...allChecks }) }),
    Object.freeze({ checks: Object.freeze({ design: true }) }),
  ]);
  const before = JSON.stringify(input);
  assert.deepEqual(getInformationCoverage(input), { percent: 58, confirmed: 7, total: 12 });
  assert.equal(JSON.stringify(input), before);

  const catalogBefore = JSON.stringify(products);
  const papersBefore = JSON.stringify(researchPapers);
  for (const product of products) {
    getResearchIngredients(product.slug);
    getProductResearch(product.slug);
  }
  assert.equal(JSON.stringify(products), catalogBefore);
  assert.equal(JSON.stringify(researchPapers), papersBefore);
});

test('each product exposes exactly its three current ingredients and catalog concentrations', () => {
  for (const [slug, ids] of Object.entries(idsByProduct)) {
    const product = products.find(item => item.slug === slug);
    assert.ok(product, `published product ${slug}`);
    const ingredients = getResearchIngredients(slug);
    assert.deepEqual(ingredients.map(item => item.id), ids);
    assert.equal(new Set(ingredients.map(item => item.id)).size, 3);
    for (const ingredient of ingredients) {
      const source = product.ingredients.find(([label]) => label.startsWith(ingredient.name));
      assert.ok(source, `${slug}: ${ingredient.name} must occur in the current formula`);
      assert.equal(ingredient.concentration, source[0].match(/[\d.]+%/)?.[0]);
    }
  }
  assert.equal(getResearchIngredients('toner-t1').find(item => item.id === 'panthenol').concentration, '0.5%');
  assert.equal(getResearchIngredients('serum-s1').find(item => item.id === 'panthenol').concentration, '1.0%');
});

test('unknown product identifiers cannot inherit another product’s ingredient research', () => {
  for (const slug of ['unknown', 'serum-s2', '', null, undefined]) {
    assert.deepEqual(getResearchIngredients(slug), []);
    assert.deepEqual(getProductResearch(slug), []);
  }
});

test('published papers have unique identities, traceable HTTPS sources, bibliography and explicit check status', () => {
  assert.ok(researchPapers.length > 0, 'publish the verified paper library before shipping the research page');
  const ids = new Set();
  const urls = new Set();
  const checkedYear = Number(RESEARCH_CHECKED_AT.slice(0, 4));
  assert.match(RESEARCH_CHECKED_AT, /^\d{4}\.\d{2}\.\d{2}$/);
  for (const paper of researchPapers) {
    nonempty(paper.id, 'paper id');
    assert.ok(!ids.has(paper.id), `duplicate paper id: ${paper.id}`);
    ids.add(paper.id);
    const url = new URL(paper.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(sourceHosts.has(url.hostname), `unrecognized original source: ${url.hostname}`);
    assert.equal(url.username + url.password + url.port, '');
    assert.ok(!urls.has(url.href), `duplicate original paper URL: ${url.href}`);
    urls.add(url.href);
    for (const key of ['koreanTitle', 'originalTitle', 'journal', 'summary', 'originLabel', 'access', 'applicationNote']) {
      nonempty(paper[key], `${paper.id}.${key}`);
    }
    assert.match(paper.koreanTitle, /[가-힣]/, `${paper.id} needs a Korean title`);
    assert.match(paper.originalTitle, /[A-Za-z]/, `${paper.id} needs original bibliography`);
    const authors = Array.isArray(paper.authors) ? paper.authors : [paper.authors];
    assert.ok(authors.length > 0);
    authors.forEach(author => nonempty(author, `${paper.id}.authors`));
    assert.ok(Number.isInteger(paper.year) && paper.year >= 1900 && paper.year <= checkedYear, `${paper.id}.year`);
    assert.ok(['인체시험', '체외시험', '문헌고찰'].includes(paper.studyType), `${paper.id}.studyType`);
    assert.ok(['domestic', 'international'].includes(paper.origin), `${paper.id}.origin`);
    assert.ok(Array.isArray(paper.ingredientIds) && paper.ingredientIds.length > 0);
    assert.equal(new Set(paper.ingredientIds).size, paper.ingredientIds.length);
    assert.ok(paper.ingredientIds.every(id => ingredientIds.has(id)), `${paper.id} maps an unpublished ingredient`);
    assert.deepEqual(Object.keys(paper.checks).sort(), [...checkKeys].sort());
    for (const key of checkKeys) assert.equal(typeof paper.checks[key], 'boolean', `${paper.id}.checks.${key}`);
    for (const [check, field] of [['population', 'population'], ['intervention', 'intervention'], ['comparator', 'comparator']]) {
      if (paper.checks[check]) nonempty(paper[field], `${paper.id}.${field}`);
    }
    for (const field of ['results', 'limitations']) {
      assert.ok(Array.isArray(paper[field]) && paper[field].length > 0, `${paper.id}.${field}`);
      paper[field].forEach(value => nonempty(value, `${paper.id}.${field}`));
    }
    if (paper.doi) assert.match(paper.doi, /^10\.\d{4,9}\/\S+$/, `${paper.id}.doi`);
    for (const field of ['efficacyProbability', 'efficacyPercent', 'safetyProbability', 'guaranteePercent']) {
      assert.equal(Object.hasOwn(paper, field), false, `${paper.id}: metadata must not invent ${field}`);
    }
  }
});

test('product-linked papers preserve source identity and disclose formula-specific application limits', () => {
  assert.ok(researchPapers.length > 0);
  for (const product of products) {
    const ingredients = getResearchIngredients(product.slug);
    const relevant = new Set(ingredients.map(ingredient => ingredient.id));
    const linked = getProductResearch(product.slug);
    const expected = researchPapers.filter(paper => paper.ingredientIds.some(id => relevant.has(id)));
    assert.ok(linked.length > 0, `${product.slug} needs connected papers`);
    assert.deepEqual(linked.map(paper => paper.id), expected.map(paper => paper.id));
    for (const paper of linked) {
      const source = researchPapers.find(item => item.id === paper.id);
      assert.notStrictEqual(paper, source);
      assert.deepEqual({ ...paper, productScope: undefined }, { ...source, productScope: undefined });
      assert.ok(paper.productScope.includes(product.name));
      const formulaScope = paper.productScope.slice(0, paper.productScope.indexOf('입니다.'));
      for (const ingredient of ingredients.filter(item => paper.ingredientIds.includes(item.id))) {
        assert.ok(formulaScope.includes(`${ingredient.name} ${ingredient.concentration}`), `${product.slug}/${paper.id} must use current product concentration`);
      }
      assert.match(paper.productScope, /완제품 시험 결과가 아니/);
      assert.match(paper.productScope, /효과·안전성을 보장하지 않습니다/);
    }
  }
});

test('rendering an unknown product has an explicit empty state and no fabricated percentage', () => {
  const html = renderProductEvidence({ slug: 'unknown', name: '미등록 제품' });
  assert.match(html, /연구가 없습니다/);
  assert.match(html, /전체 0편 중 0편 표시/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined/);
  assert.doesNotMatch(html, /class="evidence-metric"><strong>0<\/strong>/);
  assert.doesNotMatch(html, /data-evidence-paper=/);
});

test('the cream research view renders information coverage, real paper controls and study-type limits', () => {
  const cream = products.find(product => product.slug === 'cream-c1');
  const linked = getProductResearch(cream.slug);
  assert.ok(linked.length > 0);
  const html = renderProductEvidence(cream);
  assert.equal((html.match(/class="evidence-ingredient"/g) || []).length, 3);
  assert.match(html, /연구 정보 확인율/);
  assert.match(html, /효과·안전성 보장률이 아닙니다/);
  assert.match(html, /공개된 완제품 시험 자료가 없습니다/);
  assert.equal((html.match(/class="evidence-paper-open"/g) || []).length, linked.length);
  for (const type of new Set(linked.map(paper => paper.studyType))) assert.ok(html.includes(type));
  for (const paper of linked) assert.ok(html.includes(`data-evidence-paper="${paper.id}"`));
  assert.doesNotMatch(html, /NaN|Infinity|undefined/);
  assert.doesNotMatch(html, /(?:효능|효과|안전성)\s*(?:보장률|확률)\s*(?:은|:)?\s*\d+%/);
});
