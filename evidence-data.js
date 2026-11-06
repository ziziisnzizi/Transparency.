import { products } from './products.js';
import { ingredientReviewedResearch } from './ingredient-reviewed-research.js';
import { extraIngredientResearch } from './ingredient-extra-research.js';

export const RESEARCH_CHECKED_AT = '2026.11.03';

export const INFORMATION_CHECKS = Object.freeze([
  { key: 'bibliography', label: '서지·원문 연결', description: '저자·연도·학술지와 DOI 또는 논문 페이지를 확인했습니다.' },
  { key: 'design', label: '연구 설계', description: '인체시험·체외시험·문헌고찰 등 연구 방법을 확인했습니다.' },
  { key: 'population', label: '대상·표본 또는 모델', description: '참여자 수 또는 실험에 사용한 모델을 확인했습니다.' },
  { key: 'intervention', label: '농도·사용 조건', description: '시험 성분의 농도와 도포·사용 조건을 확인했습니다.' },
  { key: 'comparator', label: '비교·대조 조건', description: '대조 제형이나 비교군의 조건을 확인했습니다.' },
  { key: 'results', label: '관찰 결과', description: '공개된 초록 또는 본문에서 연구 결과를 확인했습니다.' },
]);

const ingredientCatalog = {
  glycerin: '글리세린',
  panthenol: '판테놀',
  'hyaluronic-acid': '소듐하이알루로네이트',
  'beta-glucan': '베타글루칸',
  squalane: '스쿠알란',
  'ceramide-np': '세라마이드 NP',
  centella: '병풀추출물',
  allantoin: '알란토인',
  propanediol: '프로판다이올',
  'butylene-glycol': '부틸렌글라이콜',
};

const productIngredients = {
  'toner-t1': ['glycerin', 'panthenol', 'beta-glucan', 'hyaluronic-acid', 'allantoin', 'propanediol', 'butylene-glycol'],
  'serum-s1': ['glycerin', 'panthenol', 'centella', 'hyaluronic-acid', 'allantoin', 'propanediol', 'butylene-glycol'],
  'cream-c1': ['glycerin', 'squalane', 'ceramide-np', 'allantoin', 'panthenol', 'propanediol', 'butylene-glycol'],
};

// Manually curated from the linked original abstracts/full texts. A paper is not
// a finished-product trial, and metadata completeness is not efficacy certainty.
export const researchPapers = [
  ...ingredientReviewedResearch,
  ...extraIngredientResearch,
  {
    "id": "ceramide-np-rct-2026",
    "ingredientIds": [
      "ceramide-np"
    ],
    "origin": "international",
    "originLabel": "해외 연구진 · 중국",
    "originalTitle": "Effect of a Ceramide NP-Containing Moisturizer on Skin Barrier Function in Adults with Atopic Dermatitis: A Randomized, Double-Blind, Placebo-Controlled Study.",
    "authors": "Gu CY, Ying JY, Yin HB, Huang CY, Xiang LH",
    "year": 2026,
    "journal": "Skin Pharmacology and Physiology",
    "doi": "10.1159/spp/aetag011",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13722463/",
    "studyType": "인체시험",
    "designDetails": "단일기관 무작위 이중눈가림 위약대조 평행군 시험. 중등도 아토피피부염 성인을1:1배정했으며 양군 모두 표준치료를 병행했습니다.21일과42일에 피부 장벽 지표와 임상 지표를 평가했습니다.",
    "summary": "세라마이드 NP를 포함한 복합 보습제와 위약 기제를 표준치료에 더해 비교했습니다. 양군 모두 사용 전보다 개선됐지만, 기저치 대비 변화의 군간 차이는 통계적으로 유의하지 않았습니다.",
    "population": "중등도 아토피피부염 성인60명(실험30명·대조30명).53명 완료(실험28명·대조25명).",
    "intervention": "세라마이드 NP, 스쿠알란, 시어버터, 소듐하이알루로네이트, 올리브유 불검화물, 알란토인 등을 함유한 연구용 보습제를 하루2회 전신에 도포하고 표준치료를 병행했습니다. 사용량은 약250g/주, 평가 기간42일입니다. 제조사는 완제품의 NP 농도를 공개하지 않았습니다.",
    "comparator": "겉모양이 동일한 위약 기제 보습제와 동일한 표준치료. 기제에는 물, 카프릴릭/카프릭트라이글리세라이드, 세테아릴알코올, 다이메티콘 등이 포함되었습니다.",
    "results": [
      "피부 수분, TEWL, 표면 피지 지표에서 양군 모두 전반적인 기저치 대비 개선을 보였습니다.",
      "실험군의 수치상 유리한 경향이 있었으나 기저치 대비 변화의 군간 차이는 통계적으로 유의하지 않았습니다.",
      "EASI, SCORAD, 삶의 질, 가려움·불면 점수는 양군 모두 기저 대비 개선했지만 변화의 군간 유의차는 확인되지 않았습니다.",
      "피부 표면 pH에서도 일관된 군간 차이가 확인되지 않았습니다."
    ],
    "limitations": [
      "시험 보습제의 우월성이나 세라마이드 NP 단독 효과가 입증된 결과가 아닙니다.",
      "여러 보습 성분을 포함한 혼합 제형이며 양군의 표준치료가 결과에 영향을 줄 수 있습니다.",
      "단일기관, 소규모,42일 연구이며7명이 중도탈락했습니다.",
      "원료 순도95%이상은 완제품의 NP 함량95%를 뜻하지 않으며 완제품 NP 농도는 비공개입니다."
    ],
    "applicationNote": "아토피피부염 환자의 표준치료 병행 연구이며 NP 농도도 공개되지 않았습니다. 크림 C.1의 세라마이드 NP0.1% 또는 완제품의 피부 장벽 개선·질환 개선을 입증하지 않습니다. 스쿠알란을 함께 포함했지만 단독 효과를 평가하지 않았으므로 스쿠알란 근거로 분류하지 않습니다.",
    "access": "원문 공개",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": false,
      "comparator": true,
      "results": true
    },
    "verificationNote": "NCBI PubMed PMID42868105와 PMC 공개 전문을 확인했습니다.2026-10-13발행으로 자료 확인일2026-11-03이전입니다. 무작위배정, 양군 표준치료,60명/53명완료, 하루2회·약250g/주·42일, NP농도비공개, 군간비유의결과를 원문에서 확인했습니다. 완제품 NP농도가 없으므로 intervention은 false입니다. 연구진·학술지 정보: 중국 푸단대학교 화산병원 연구진 · Skin Pharmacology and Physiology.",
    "koreanTitle": "아토피피부염 성인에서 세라마이드 NP 함유 보습제의 피부 장벽 기능 평가: 무작위 이중눈가림 위약대조시험",
    "language": "en"
  },
  {
    "id": "feng-2025-beta-glucan-review",
    "ingredientIds": [
      "beta-glucan"
    ],
    "origin": "international",
    "originLabel": "국외 연구팀 · 국제 학술지(영문 종설)",
    "originalTitle": "Exploring the Properties and Application Potential of β-Glucan in Skin Care",
    "authors": "Xiaoyue Feng, Jianli Shang, Yuhui Wang, Yong Chen, Youting Liu",
    "year": 2025,
    "journal": "Food Science & Nutrition 13(4), e70212",
    "doi": "10.1002/fsn3.70212",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12023766/",
    "studyType": "문헌고찰",
    "designDetails": "중국 연구진이 베타글루칸의 기원·구조·물성, 보습 및 피부 관리 활용 문헌을 종합한 리뷰입니다. 새 인체시험을 수행한 논문이 아닙니다.",
    "summary": "베타글루칸의 수분 결합과 막 형성 특성 등 보습 관련 문헌을 정리한 종설입니다. 원료의 기원, 분자량과 구조에 따라 특성이 달라진다는 점을 강조합니다.",
    "population": "문헌고찰이므로 새로 모집한 단일 인체시험 대상이나 N이 없습니다.",
    "intervention": "여러 기원과 구조의 베타글루칸에 관한 연구를 검토했습니다. 단일 농도·도포량·사용기간은 없습니다.",
    "comparator": "리뷰에 포함된 연구별로 달라 단일 대조군은 없습니다.",
    "results": [
      "저자는 베타글루칸의 수분 유지와 관련된 물성 및 기존 피부 연구를 정리했습니다.",
      "베타글루칸의 생물학적·물리적 특성이 기원, 분자 구조와 분자량에 영향을 받는다고 설명했습니다."
    ],
    "limitations": [
      "보습 외에 질환·상처·다른 투여 경로의 문헌도 다루므로 각 결과의 실험계와 적용 경로를 구분해야 합니다.",
      "리뷰 논문이므로 이 자료에 단일 인체시험의 대상자 수·농도·기간·효과율을 부여하면 안 됩니다.",
      "T.1에 사용되는 베타글루칸의 원료 기원·분자량·구조는 이 리뷰에서 확인되지 않습니다."
    ],
    "applicationNote": "T.1의 베타글루칸 0.1%에 관한 배경 성분 자료입니다. 해당 함량의 보습효과, 얼굴 피부에서의 장기 효과 또는 T.1 완제품 효능을 입증하는 자료는 아닙니다.",
    "access": "원문 공개",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": false,
      "intervention": false,
      "comparator": false,
      "results": true
    },
    "verificationNote": "Europe PMC 초록과 공개 원문 JATS, DOI·저자·발행정보 및 PMC 페이지(HTTP 200)를 확인했습니다. 중국 소속 연구진의 영문 리뷰로 국내 논문이 아닙니다.",
    "koreanTitle": "피부 관리에서 베타글루칸의 특성과 활용 가능성",
    "language": "en"
  },
  {
    "id": "lee-2025-liposomal-hyaluronic-acid",
    "ingredientIds": [
      "hyaluronic-acid"
    ],
    "origin": "domestic",
    "originLabel": "국내 연구팀 · 국제 학술지(영문)",
    "originalTitle": "Liposomal Hyaluronic Acid Enhances Skin Permeation and Hydration: Evidence from In Vitro, Ex Vivo, and In Vivo Studies",
    "authors": "Jeong Mi Lee, Young Hun Hwang, Bo Mi Park, Hee Bin Seo, Da Yeong Nam, Eung Won Kim, So Min Kang, Jae Sung Hwang",
    "year": 2025,
    "journal": "Biomolecules & Therapeutics",
    "doi": "10.4062/biomolther.2025.163",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12580642/",
    "studyType": "인체시험",
    "designDetails": "경희대학교·한국콜마·KBI 연구진의 세포, 인체 피부 조직 및 인체 보습시험. 인체 부분은 테이프 스트리핑 후 전완부의 리포솜 HA 처리 부위와 반대쪽 무처리 부위를 비교했습니다.",
    "summary": "리포솜으로 제형화한 히알루론산을 평가한 국내 연구팀의 영문 논문입니다. 20명의 단기 전완부 시험에서 처리 부위의 각질층 수분 증가가 무처리 부위보다 컸습니다.",
    "population": "건강한 여성 20명, 20–50세. 전완 안쪽의 3×3 cm² 시험 부위에 9회 테이프 스트리핑을 시행했습니다.",
    "intervention": "LPS-HA 50 µL를 시험 부위에 도포했습니다. 이 인체시험 설명에서 HA 유효농도와 정확한 평가 시점을 확인하지 못했습니다.",
    "comparator": "같은 참여자의 반대쪽 무처리 전완부. 인체시험의 비교는 일반 HA 제형과의 직접 비교가 아닙니다.",
    "results": [
      "각질층 수분 측정값은 처리 부위에서 35.50±1.83에서 69.93±1.78 A.U.로, 무처리 부위에서 35.20±1.74에서 47.98±2.23 A.U.로 증가했습니다.",
      "저자는 증가율을 각각 96.99%와 36.31%로 보고했으며, 집단 간 차이는 반복측정 분석에서 유의했습니다(p<0.001).",
      "이 증가율은 논문의 전완부 시험 조건에 한정되며 제품의 보습 개선율로 사용할 수 없습니다."
    ],
    "limitations": [
      "리포솜 HA라는 특수 원료·제형이며 일반 소듐하이알루로네이트와 동일하지 않습니다.",
      "소규모의 테이프 스트리핑 전완부 시험으로 정상 얼굴 피부의 장기간 결과와 구분해야 합니다.",
      "세포실험의 0.1–1% 농도를 인체시험 농도로 옮겨 적으면 안 됩니다.",
      "시험 도포량은 확인했지만 인체시험의 유효농도와 세부 평가 시점은 확인되지 않았습니다."
    ],
    "applicationNote": "HA의 제형에 따라 보습과 전달 특성이 달라질 수 있다는 참고 자료입니다. S.1의 소듐하이알루로네이트 0.1% 또는 완제품의 인체시험 근거는 아닙니다.",
    "access": "원문 공개",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": false,
      "comparator": true,
      "results": true
    },
    "verificationNote": "Europe PMC 원문 JATS와 PMC 공개 페이지(HTTP 200)를 확인했습니다. 인체시험 도포량·부위·대조군은 확인되나 유효농도와 평가 시점이 불명확하여 intervention을 보수적으로 false로 표시했습니다.",
    "koreanTitle": "리포솜 히알루론산의 피부 투과와 보습: 세포·피부 조직·인체 연구",
    "language": "en"
  },
  {
    "id": "squalane-fibroblast-2025",
    "ingredientIds": [
      "squalane"
    ],
    "origin": "international",
    "originLabel": "해외 연구진 · 폴란드",
    "originalTitle": "Squalane as a Promising Agent Protecting UV-Induced Inhibition of Collagen Biosynthesis and Wound Healing in Human Dermal Fibroblast.",
    "authors": "Wolosik K, Chalecka M, Gasiewska G, Palka J, Surazynski A",
    "year": 2025,
    "journal": "Molecules 30(9):1964",
    "doi": "10.3390/molecules30091964",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12073650/",
    "studyType": "체외시험",
    "designDetails": "배양 인간 진피 섬유아세포를 이용한 UVA 손상 모델. 스쿠알란 전처리군을 UVA 단독군 및 비조사·비스쿠알란 대조군과 비교했습니다. 세포생존율, 콜라겐 합성·prolidase 활성, 관련 신호 및 세포 이동을 평가했습니다.",
    "summary": "스쿠알란을 전처리한 배양 섬유아세포에서 UVA 손상 관련 일부 지표의 변화가 보고됐습니다. 콜라겐 합성 증가는 통계적으로 유의하지 않은 경향이었으며, 인체의 보습·피부 장벽·자외선 차단을 평가한 시험은 아닙니다.",
    "population": "ATCC에서 확보한 배양 인간 진피 섬유아세포(HDF). 사람에게 제품을 도포한 임상시험이 아닙니다. 주요 실험은3회 반복했습니다.",
    "intervention": "스쿠알란0.005%,0.01%,0.015%를30분 전처리한 뒤 세척하고 UVA10J/cm²(365nm)를 조사했습니다. 이후 새 배지에서24시간 배양했습니다.",
    "comparator": "스쿠알란 없이 UVA만 조사한 세포 및 PBS에서 동일 조건으로 유지하되 UVA와 스쿠알란에 노출하지 않은 대조 세포.",
    "results": [
      "UVA 단독군의 세포생존율은 비조사 대조의55%였으며 스쿠알란0.005%,0.01%,0.015% 전처리군은 각각64%,75%,78%였습니다. UVA 단독군 대비 유의한 생존율 증가는0.015%에서만 확인됐습니다.",
      "콜라겐 합성 수치는 증가 방향을 보였으나 UVA 단독군 대비 차이는 통계적으로 유의하지 않았습니다(p>0.05).",
      "prolidase 활성 및 세포 이동 등 다른 세포 수준 지표에서도 변화가 보고됐습니다."
    ],
    "limitations": [
      "배양 세포는 실제 피부의 각질층, 제형 흡수, 대사 및 사용 환경을 재현하지 못합니다.",
      "인체 피부 수분, TEWL, 피부 장벽 개선 또는 자외선 차단 성능은 직접 평가하지 않았습니다.",
      "콜라겐 합성 증가의 비유의 결과를 주름 개선이나 콜라겐 생성 효능 입증으로 표현할 수 없습니다.",
      "스쿠알란(squalane)의 시험이며 스쿠알렌(squalene) 연구와 혼동하면 안 됩니다."
    ],
    "applicationNote": "배양액의 스쿠알란0.005–0.015%와 크림 C.1의 피부 도포용 스쿠알란3%는 노출 방식과 조건이 달라 직접 비교할 수 없습니다. C.1의 인체 보습, 피부 장벽, 주름 개선, 자외선 차단 또는 안전성을 입증하지 않습니다.",
    "access": "원문 공개",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": true,
      "comparator": true,
      "results": true
    },
    "verificationNote": "NCBI PubMed PMID40363772와 PMC 공개 전문의 방법·결과를 확인했습니다. HDF,3회반복,0.005–0.015%·30분·UVA10J/cm²·24시간, 대조 조건이 확인됐습니다. 원문의 콜라겐 합성 결과가 p>0.05임을 확인하여 긍정적인 초록 표현만을 단독으로 사용하지 않았습니다. 연구진·학술지 정보: 폴란드 비아위스토크 의과대학교 연구진 · Molecules.",
    "koreanTitle": "UVA로 손상된 인간 진피 섬유아세포에서 스쿠알란의 콜라겐 대사와 세포 이동 관련 연구",
    "language": "en"
  },
  {
    "id": "squalane-bakuchiol-human-2023",
    "ingredientIds": [
      "squalane"
    ],
    "origin": "international",
    "originLabel": "해외 연구진 · 인도",
    "originalTitle": "Daily use of a bakuchiol and squalane-containing face serum impacts skin esthetics",
    "authors": "Rastogi R, Gholap A",
    "year": 2023,
    "journal": "CosmoDerma 3:182",
    "doi": "10.25259/CSDM_224_2023",
    "url": "https://doi.org/10.25259/CSDM_224_2023",
    "studyType": "인체시험",
    "designDetails": "대조군 없는 단일군의4주 사용 전후 비교시험입니다. 바쿠치올·스쿠알란 혼합 세럼과 별도 제공 세안제·아침 보습제를 함께 사용했습니다. 무작위 기제 대조시험이 아닙니다.",
    "summary": "바쿠치올과 스쿠알란을 함께 함유한 연구용 세럼을 사용한 뒤 TEWL이 사용 전보다 감소했다고 보고했습니다. 대조군이 없고 다른 성분 및 아침 보습제가 병행되어 스쿠알란 단독의 효과로 해석할 수 없습니다.",
    "population": "건강한 인도 여성50명 모집,47명 완료. 완료자의 나이는18–49세, 평균29±8.9세였습니다.",
    "intervention": "바쿠치올·스쿠알란 세럼 약0.25g(4–5방울)을 세안 후 밤에1회,4주간 사용했습니다. 제공된 세안제는 하루2회 사용했고 아침용 보습제도 병행했습니다. 스쿠알란의 정확한 배합 농도는 확인하지 못했습니다.",
    "comparator": "대조군 없음. 동일 참가자의 사용 전 측정값과7일·14일·28일 측정값을 비교했습니다.",
    "results": [
      "TEWL의 사용 전 대비 평균 변화는7일−2.61,14일−3.39,28일−3.76g/m²/h로 보고됐습니다(P<0.001).",
      "이 수치는 기저치 대비 변화이며 위약 또는 무사용 대조군 대비 효과 크기가 아닙니다."
    ],
    "limitations": [
      "기제 또는 무사용 대조군이 없어 자연 변화, 계절, 세안 및 병행 보습제 영향을 분리하기 어렵습니다.",
      "바쿠치올과 다른 제형 성분을 함께 포함하며 스쿠알란 단독의 기여를 평가하지 않았습니다.",
      "스쿠알란 농도를 확인하지 못했고4주간47명의 완료자 자료입니다.",
      "두 저자 모두 소비재 기업의 연구개발팀 소속입니다.",
      "논문 서론에서 인용한 스쿠알렌 자료를 스쿠알란의 동일 효과를 입증한 자료로 취급하지 않았습니다."
    ],
    "applicationNote": "혼합 세럼과 별도 보습제를 병행한 무대조 연구이며 스쿠알란 농도도 확인되지 않았습니다. 스쿠알란3%를 함유한 크림 C.1의 TEWL 감소, 단독 성분 효과 또는 완제품 효능을 입증하지 않습니다.",
    "access": "원문 공개",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": false,
      "comparator": false,
      "results": true
    },
    "verificationNote": "출판사 공개 전문과 Crossref 서지정보를 확인했습니다.50명모집/47명완료, 나이,0.25g·야간1회·4주, 세안제·아침보습제병행, TEWL변화 및 기업R&D저자소속을 확인했습니다. 스쿠알란 농도가 미확인이라 intervention은 false이며 독립 대조군이 없어 comparator는 false입니다. 연구진·학술지 정보: 인도 DPKA Universal Consumer Ventures 연구개발팀 · CosmoDerma.",
    "koreanTitle": "바쿠치올과 스쿠알란 함유 세럼의 4주 사용 전후 피부 지표 연구",
    "language": "en"
  },
  {
    "id": "ceramide-np-korean-2022",
    "ingredientIds": [
      "ceramide-np"
    ],
    "origin": "domestic",
    "originLabel": "국내 연구진 · 국제 학술지(영문)",
    "originalTitle": "Ceramide NPs derived from natural oils of Korean traditional plants enhance skin barrier functions and stimulate expressions of genes for epidermal homeostasis.",
    "authors": "Choi HK, Hwang K, Hong YD, Cho YH, Kim JW, Lee EO, Park WS, Park CS",
    "year": 2022,
    "journal": "Journal of Cosmetic Dermatology 21(10):4931–4941",
    "doi": "10.1111/jocd.14905",
    "url": "https://pubmed.ncbi.nlm.nih.gov/35262269/",
    "studyType": "인체시험",
    "designDetails": "식물유 유래 세라마이드 NP의 세포 유전자 발현시험과 사람의 손상 피부 장벽 회복·각질층 응집 비교시험을 함께 수행했습니다. 인체시험의 무작위배정·눈가림 여부는 확인한 초록에 명시되지 않았습니다.",
    "summary": "국내 연구진은 특정 녹차씨유 지방산으로 제조한 고순도 세라마이드 NP 0.5% 크림의 손상 피부 장벽 회복과 각질층 응집을 비교했습니다. 지방산 조성과 정제 방법이 다른 세라마이드 NP의 결과를 동일한 원료의 효과로 취급할 수는 없습니다.",
    "population": "사람 피부의 유도된 장벽 손상 회복과 각질층 응집을 평가했습니다. 인체 표본 수, 연령 및 사용 기간은 확인한 공개 초록에 제시되지 않았습니다. 별도의 세포 유전자 발현시험도 수행했습니다.",
    "intervention": "잔류 phytosphingosine을 제거하도록 정제한 녹차씨유 유래 HP-C. sinensis CER NP 0.5% 크림. 도포량·빈도·기간은 공개 초록에서 확인되지 않았습니다.",
    "comparator": "C18-CER NP를 함유한 대조 크림. 대조 원료의 이름은 확인했으나 상세 배합과 도포 조건은 공개 초록만으로 확인되지 않았습니다.",
    "results": [
      "HP-C. sinensis CER NP 0.5% 크림이 C18-CER NP 대조보다 유도 손상 피부 장벽의 회복을 유의하게 빠르게 했다고 보고했습니다.",
      "같은 연구용 크림을 사용한 피부에서 각질층 응집 증가를 보고했습니다.",
      "세포시험에서는 HP-C. sinensis CER NP가 FLG, CASP14, INV 발현을 증가시켰으나 C18-CER NP 대조는 같은 발현 변화를 보이지 않았습니다.",
      "상세 효과 크기와 정확한 p값은 확인한 초록에 제시되지 않았습니다."
    ],
    "limitations": [
      "특정 식물유의 지방산 조성과 정제 공정으로 만든 원료의 연구입니다.",
      "초록만 확인하여 인체 표본 수, 기간, 도포 빈도·용량 및 상세 통계를 확인하지 못했습니다.",
      "인위적으로 손상시킨 장벽의 회복 결과는 일반인의 일상 사용 조건과 다릅니다.",
      "연구진에 화장품 기업과 원료 기업 소속이 포함되어 있습니다."
    ],
    "applicationNote": "연구의 HP-C. sinensis CER NP는 특정 지방산 조성의 원료이며 농도는0.5%입니다. 크림 C.1의 세라마이드 NP0.1%는 농도가5분의1이고 동일한 원료인지 확인되지 않았습니다. 성분 계열이 같다는 이유로 동일 효과를 주장할 수 없습니다. 제목의 NPs를 나노입자 효과로 해석하지 않습니다.",
    "access": "초록 확인",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": false,
      "intervention": false,
      "comparator": true,
      "results": true
    },
    "verificationNote": "NCBI PubMed XML과 Europe PMC의 메타데이터·초록·저자 소속을 교차 확인했습니다. 사람 피부 모델 자체는 확인했으나 표본 수와 사용 기간은 초록에 없습니다. 원료 농도0.5%는 확인했지만 도포 조건이 불완전하여 intervention은 false입니다. Wiley 전문은 접근 차단되어 확인하지 못했습니다. 연구진·학술지 정보: 동국대학교·아모레퍼시픽·LCS Biotech 국내 연구진 · Journal of Cosmetic Dermatology. 인체 표본 수와 세포 실험 모델의 구체적 식별 정보를 확인하지 못해 대상·표본 또는 모델 항목도 미확인으로 표시했습니다.",
    "koreanTitle": "한국 전통 식물유 유래 세라마이드 NP의 피부 장벽 기능과 표피 항상성 관련 유전자 발현 연구",
    "language": "en"
  },
  {
    "id": "cho-2022-dexpanthenol-review",
    "ingredientIds": [
      "panthenol"
    ],
    "origin": "domestic",
    "originLabel": "국내 연구팀 · 국제 학술지(영문 종설)",
    "originalTitle": "Use of Dexpanthenol for Atopic Dermatitis—Benefits and Recommendations Based on Current Evidence",
    "authors": "Yoon Sun Cho, Hye One Kim, Seung Man Woo, Dong Hun Lee",
    "year": 2022,
    "journal": "Journal of Clinical Medicine 11(14), 3943",
    "doi": "10.3390/jcm11143943",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9322723/",
    "studyType": "문헌고찰",
    "designDetails": "국내 피부과 연구진과 Bayer Korea 소속 저자가 기존 덱스판테놀 문헌을 검토하고 아토피피부염 관리 관점의 전문가 권고를 정리한 종설입니다. 새 인체시험을 수행한 논문이 아닙니다.",
    "summary": "덱스판테놀 외용제의 보습과 피부 장벽 관련 연구를 종합한 국내 연구팀의 영문 종설입니다. 질환 관리 문헌을 포함하므로 일상용 토너·세럼의 완제품 효능과 구분해 읽어야 합니다.",
    "population": "리뷰 논문이므로 단일 인체시험 모집 수가 없습니다. 인용된 자료에는 건강 피부와 아토피피부염 관련 연구가 섞여 있습니다.",
    "intervention": "외용 덱스판테놀 연고·보습제에 관한 여러 연구를 검토했습니다. 논문 전체에 적용할 단일 농도·투여량·기간은 없습니다.",
    "comparator": "인용 연구별로 다르며 통일된 대조군은 없습니다.",
    "results": [
      "저자는 외용 덱스판테놀 관련 문헌의 피부 수분량과 장벽 기능 결과를 정리했습니다.",
      "보습제의 선택과 지속 사용에 관한 전문가 권고를 제시했지만 T.1 또는 S.1을 시험하지는 않았습니다."
    ],
    "limitations": [
      "새로운 인체시험이 아닌 문헌고찰·권고입니다.",
      "아토피피부염·손상 피부와 고농도 연고 자료 등을 포함하므로 건강한 얼굴 피부에 그대로 적용할 수 없습니다.",
      "Bayer Korea 소속 저자가 참여한 문헌이라는 점을 함께 표시하는 것이 적절합니다."
    ],
    "applicationNote": "T.1의 판테놀 0.5%와 S.1의 판테놀 0.5%를 이해하기 위한 성분 문헌입니다. 특정 함량의 우수성, 민감성 피부 적합성 또는 아토피 치료효과를 제품에 부여하는 자료가 아닙니다.",
    "access": "원문 공개",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": false,
      "intervention": false,
      "comparator": false,
      "results": true
    },
    "verificationNote": "PMC 원문 JATS, 초록, 저자 소속과 PMC 공개 페이지(HTTP 200)를 확인했습니다. 리뷰의 인용 시험 수치를 이 논문의 단일 시험처럼 표시하지 않았습니다.",
    "koreanTitle": "아토피피부염에서 덱스판테놀의 사용: 현재 근거를 바탕으로 한 이점과 권고",
    "language": "en"
  },
  {
    "id": "pavicic-hyaluronic-acid-2011",
    "ingredientIds": [
      "hyaluronic-acid"
    ],
    "origin": "international",
    "originLabel": "해외 연구",
    "koreanTitle": "분자량이 다른 0.1% 히알루론산 크림의 피부 수분·탄력 비교",
    "originalTitle": "Efficacy of cream-based novel formulations of hyaluronic acid of different molecular weights in anti-wrinkle treatment",
    "authors": "Pavicic T, Gauglitz GG, Lersch P, Schwach-Abdellaoui K, Malle B, Korting HC, Farwick M",
    "year": 2011,
    "journal": "Journal of Drugs in Dermatology. 2011;10(9):990–1000",
    "url": "https://pubmed.ncbi.nlm.nih.gov/22052267/",
    "studyType": "인체시험",
    "designDetails": "무작위 비교 인체시험으로, 한쪽 눈가에 히알루론산 시험 크림을 사용하고 반대쪽 눈가에 기제 대조 크림을 사용했습니다. 사용 전과 30일·60일에 평가했습니다.",
    "summary": "여성 76명을 대상으로 분자량이 다른 0.1% 히알루론산 크림을 60일간 사용한 연구에서 기제 대조 부위보다 피부 수분과 탄력 지표가 개선되었습니다. 주름 관련 지표의 유의한 개선은 일부 분자량에서 관찰되었습니다.",
    "population": "눈가 주름이 있는 30–60세 여성 76명. 76명은 전체 참여자 수이며 분자량별 군당 인원은 공개 초록에 제시되지 않았습니다.",
    "intervention": "히알루론산 0.1%를 함유한 크림을 하루 2회, 60일간 눈가에 사용했습니다. 시험한 분자량은 50·130·300·800·2000 kDa입니다.",
    "comparator": "같은 참여자의 반대쪽 눈가에 사용한 기제 대조 크림.",
    "results": [
      "연구에 사용한 모든 히알루론산 제형에서 기제 대조 크림보다 피부 수분과 전체 탄력 지표 R2가 유의하게 개선되었습니다.",
      "평균 거칠기 Ra와 최대 거칠기 Rz로 측정한 주름 깊이 관련 지표는 60일 후 50 kDa 및 130 kDa 군에서 기제 대조 부위보다 유의하게 개선되었습니다."
    ],
    "limitations": [
      "여성의 눈가에 특정 크림 제형을 사용한 60일 연구로, 다른 부위·대상자·제형에 같은 결과가 나타난다고 볼 수 없습니다.",
      "공개 초록에는 분자량별 군당 인원과 절대 개선량이 제시되지 않았습니다.",
      "모든 분자량에서 주름 깊이 감소가 확인된 것은 아니며, 완제품의 효능이나 안전성을 검증한 자료가 아닙니다."
    ],
    "applicationNote": "세럼 S.1의 공개 성분은 소듐하이알루로네이트 0.1%입니다. 연구의 히알루론산과 제품 원료의 분자량·특성 및 크림과 세럼의 제형 동등성은 확인되지 않았습니다. 함량 숫자가 같아도 동일한 효과를 뜻하지 않습니다.",
    "access": "초록 확인",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": true,
      "comparator": true,
      "results": true
    },
    "verificationNote": "PubMed의 서지와 공개 초록에서 전체 참여자 수, 농도·분자량·사용 기간·횟수, 대조 조건과 결과를 확인했습니다. 분자량별 군당 인원과 정량 개선량은 확인되지 않았습니다. PubMed와 Europe PMC 레코드에 DOI가 기재되어 있지 않아 PMID 연결을 사용합니다.",
    "language": "en"
  },
  {
    "id": "kim-2007-oligo-hyaluronic-acid",
    "ingredientIds": [
      "hyaluronic-acid"
    ],
    "origin": "domestic",
    "originLabel": "국내 학회지 · 한국어 원저",
    "originalTitle": "Preparation of Oligo Hyaluronic Acid by Hydrolysis and Its Application as a Cosmetic Ingredient",
    "authors": "김경태, 김영희, 김진국, 한창성, 박선희, 이방용, 김기호",
    "year": 2007,
    "journal": "대한화장품학회지 33(3), 189–196",
    "url": "https://koreascience.kr/article/JAKO200703534438153.page",
    "studyType": "인체시험",
    "designDetails": "세포·인공피부 실험과 인체 전완부 보습 비교를 포함한 원료 연구. 보습 지속효과 시험은 12명을 대상으로 수행했습니다.",
    "summary": "저분자 히알루론산과 고분자 히알루론산을 같은 농도로 비교한 국내 원료 연구입니다. 인체 전완부 시험에서 두 원료 모두 단기 보습효과를 보였으며, 결과는 분자량과 측정 시점에 따라 달랐습니다.",
    "population": "보습 지속효과 시험: 피험자 12명, 전완부. 별도의 누적첩포 안전성 시험 50명과 구분합니다.",
    "intervention": "Oligo HA 0.01% 용액, 2 µL/cm². 도포 후 9분 30초에 정제수로 세척하고, 30초 후 수분을 제거한 뒤 1분 간격으로 보습을 추적했습니다.",
    "comparator": "고분자 HA 0.01% 및 trehalose 0.01%. 고분자 HA 약 110만 Da, oligo HA 약 5,000 Da.",
    "results": [
      "저자는 초기 측정에서 oligo HA 0.01%의 보습 개선이 HA 0.01%보다 높았다고 보고했습니다.",
      "세척 후 8분 시점에는 HA가 oligo HA와 비슷하거나 더 높은 보습 유지력을 보여, 저분자 HA가 모든 시점에서 우월하다고 볼 수 없습니다.",
      "인공피부·Caco-2 투과 결과는 별도 실험이며 인체 얼굴의 침투율로 해석할 수 없습니다."
    ],
    "limitations": [
      "소규모·단기 전완부 시험이며 장기간의 안면 사용 결과가 아닙니다.",
      "원료 분자량과 시험 농도는 S.1의 소듐하이알루로네이트 0.1%와 동일하게 확인되지 않았습니다.",
      "KoreaScience의 저자 메타데이터와 원문 저자 순서가 다릅니다. 원문 189쪽의 순서를 따랐습니다.",
      "DOI는 확인되지 않아 KoreaScience의 개별 논문 주소를 사용합니다."
    ],
    "applicationNote": "히알루론산 계열 원료의 분자량과 제형 조건을 이해하는 참고 자료입니다. S.1 완제품의 보습효과, 침투율 또는 유지시간을 입증하는 시험은 아닙니다.",
    "access": "원문 공개",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": true,
      "comparator": true,
      "results": true
    },
    "verificationNote": "KoreaScience의 한국어·영어 초록과 8쪽 스캔 원문을 확인했습니다. 원문 189쪽 저자, 191–192쪽 시험방법, 195쪽 보습결과를 대조했습니다.",
    "koreanTitle": "저분자량 히알루론산의 제조 및 화장품에의 응용",
    "language": "en"
  },
  {
    "id": "biro-dexpanthenol-2003",
    "ingredientIds": [
      "panthenol"
    ],
    "origin": "international",
    "originLabel": "해외 연구",
    "koreanTitle": "5% 덱스판테놀 제형의 자극 후 각질층 수분 비교",
    "originalTitle": "Efficacy of dexpanthenol in skin protection against irritation: a double-blind, placebo-controlled study",
    "authors": "Biro K, Thaçi D, Ochsendorf FR, Kaufmann R, Boehncke WH",
    "year": 2003,
    "journal": "Contact Dermatitis. 2003;49(2):80–84",
    "doi": "10.1111/j.0105-1873.2003.00184.x",
    "url": "https://pubmed.ncbi.nlm.nih.gov/14641355/",
    "studyType": "인체시험",
    "designDetails": "무작위·전향적·이중눈가림·위약 대조 인체시험으로 양쪽 팔 안쪽을 비교했습니다. 사용 기간 중 15–22일에는 2% 소듐라우릴설페이트(SLS)를 하루 2회 적용해 자극을 유발했습니다.",
    "summary": "건강한 성인 25명이 참여한 연구에서 5% 덱스판테놀 제형을 26일간 사용했습니다. 자극 유발 후 각질층 수분 측정에서 위약 대조 부위보다 유리한 결과가 관찰되었으며, 21명이 시험을 완료했습니다.",
    "population": "18–45세 건강한 성인 25명 중 21명 완료. 3명은 사용 순응도 문제로 제외되었고 1명은 연구와 관련 없는 중대한 이상사례로 중단했습니다.",
    "intervention": "5% 덱스판테놀을 함유한 Bepanthol Handbalsam을 팔 안쪽에 하루 2회, 26일간 사용했습니다. 15–22일에는 2% SLS를 하루 2회 적용했습니다.",
    "comparator": "반대쪽 팔 안쪽에 사용한 위약 제형. 시험 부위와 동일하게 SLS 자극을 적용했습니다.",
    "results": [
      "측정 항목 중 통계적으로 유의한 차이는 코르네오미터로 측정한 각질층 수분에서 보고되었습니다(P<0.05). SLS 적용 후 위약 부위의 수분 측정값이 감소했습니다.",
      "동일인 비교에서 덱스판테놀 처리 부위가 유리한 사례는 11건, 위약 부위가 유리한 사례는 1건이었습니다.",
      "자극성 피부염을 경험한 6명 중 5명에서 위약 부위의 증상이 더 심했습니다."
    ],
    "limitations": [
      "참여자 25명 중 21명이 완료한 소규모 연구이며, 특정 핸드밤을 팔 부위에 사용했습니다.",
      "인위적인 SLS 자극 조건이므로 얼굴 피부의 일상 사용 조건에 그대로 적용할 수 없습니다.",
      "공개 초록의 평가 항목은 피지량·각질층 수분·pH·임상 모습이며 TEWL은 명시되지 않았습니다. 모든 지표가 유의하게 개선된 것은 아닙니다."
    ],
    "applicationNote": "이 연구의 덱스판테놀 농도는 5%로, 세럼 S.1의 판테놀 0.5% 및 토너 T.1의 판테놀 0.5%와 다릅니다. 제품 원료의 입체이성질체·규격과 제형의 동일성도 확인되지 않았으므로 본 제품의 장벽 개선이나 자극 예방 효과를 직접 입증하지 않습니다.",
    "access": "초록 확인",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": true,
      "comparator": true,
      "results": true
    },
    "verificationNote": "PubMed의 서지와 공개 초록에서 모집·완료 인원, 5% 농도와 사용 횟수·기간, SLS 자극 조건, 위약 비교와 관찰 결과를 확인했습니다. 초록에 명시되지 않은 TEWL 개선이나 모든 지표의 개선을 주장하지 않습니다.",
    "language": "en"
  },
  {
    "id": "glycerin-healthy-2001",
    "ingredientIds": [
      "glycerin"
    ],
    "origin": "international",
    "originLabel": "해외 연구진 · 스웨덴",
    "originalTitle": "The influence of a cream containing 20% glycerin and its vehicle on skin barrier properties.",
    "authors": "Lodén M, Wessman W",
    "year": 2001,
    "journal": "International Journal of Cosmetic Science",
    "doi": "10.1046/j.1467-2494.2001.00060.x",
    "url": "https://pubmed.ncbi.nlm.nih.gov/18498456/",
    "studyType": "인체시험",
    "designDetails": "건강한 성인의 양측 피부를 비교한 이중눈가림 기제 대조시험. 공개 초록에 무작위배정 여부는 명시되지 않았습니다.",
    "summary": "글리세린 20% 연구용 크림을 10일 사용한 건강한 성인에서 피부 수분 측정값이 증가했습니다. 같은 시험에서 TEWL과 계면활성제 자극에 대한 민감도 개선은 확인되지 않았습니다.",
    "population": "건강한 지원자 17명의 정상 피부. 아토피피부염 환자 시험이 아닙니다.",
    "intervention": "글리세린 20% 크림을 정상 피부에 10일간 반복 도포. 1일 도포 횟수와 1회 사용량은 확인한 초록에 기재되어 있지 않습니다.",
    "comparator": "시험 크림의 위약 크림인 동일 기제와 양측 비교.",
    "results": [
      "10일 후 corneometer로 측정한 피부 수분 값이 유의하게 증가했습니다.",
      "TEWL 및 SLS 유발 자극에 대한 피부 민감도에서는 글리세린의 유의한 영향을 확인하지 못했습니다.",
      "정확한 효과 크기와 p값은 확인한 공개 초록에 제시되지 않았습니다."
    ],
    "limitations": [
      "표본 17명, 사용 기간 10일의 정상 피부 연구입니다.",
      "수분 증가와 피부 장벽 기능 개선은 서로 다른 평가 결과이며, 이 시험에서 장벽 개선까지 입증된 것은 아닙니다.",
      "전문을 확인하지 못해 도포 빈도, 1회량 및 상세 통계값은 확인되지 않았습니다."
    ],
    "applicationNote": "연구 농도는 글리세린 20%로 크림 C.1의 5%와 다릅니다. 연구용 크림의 수분 증가를 C.1의 효과 크기, 지속 시간 또는 장벽 개선 결과로 환산할 수 없습니다.",
    "access": "초록 확인",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": true,
      "comparator": true,
      "results": true
    },
    "verificationNote": "NCBI PubMed 원문 XML에서 PMID18498456, 저자, 제목, DOI, 건강한17명, 20%·10일, 이중눈가림·기제 대조 및 결과를 확인했습니다. 농도와 사용 기간은 확인했으나 도포 빈도·1회량은 미확인입니다. 저자 소속은 스웨덴 ACO Hud AB로 기재되어 있으며, 기업 소속을 독립적 임상 검증과 혼동하지 않아야 합니다. 연구진·학술지 정보: 스웨덴 ACO Hud 연구 · International Journal of Cosmetic Science.",
    "koreanTitle": "글리세린 20% 크림과 기제가 피부 장벽 특성에 미치는 영향",
    "language": "en"
  },
  {
    "id": "loden-glycerin-2001",
    "ingredientIds": [
      "glycerin"
    ],
    "origin": "international",
    "originLabel": "해외 연구",
    "koreanTitle": "20% 글리세린 보습제와 기제·요소 크림의 비교",
    "originalTitle": "Instrumental and dermatologist evaluation of the effect of glycerine and urea on dry skin in atopic dermatitis",
    "authors": "Lodén M, Andersson AC, Andersson C, Frödin T, Oman H, Lindberg M",
    "year": 2001,
    "journal": "Skin Research and Technology. 2001;7(4):209–213",
    "doi": "10.1034/j.1600-0846.2001.70401.x",
    "url": "https://pubmed.ncbi.nlm.nih.gov/11737814/",
    "studyType": "인체시험",
    "designDetails": "아토피피부염 환자를 대상으로 글리세린 보습제, 해당 기제 위약, 요소·염화나트륨 크림을 30일간 비교한 무작위·평행군·이중눈가림 인체시험입니다.",
    "summary": "아토피피부염 환자 109명을 대상으로 한 30일 비교 연구에서는 20% 글리세린 제형과 기제 위약 사이에 경피수분손실 차이가 관찰되지 않았습니다. 피부 정전용량의 차이도 관찰되지 않아 제형과 비교 조건에 따른 결과의 차이를 보여줍니다.",
    "population": "아토피피부염 환자 109명. 군별 인원과 세부 대상 조건은 공개 초록에 제시되지 않았습니다.",
    "intervention": "20% 글리세린을 함유한 보습제를 30일간 사용했습니다. 하루 도포 횟수는 공개 초록에 제시되지 않았습니다.",
    "comparator": "글리세린 보습제의 기제 위약 및 요소 4%·염화나트륨 4%를 함유한 크림.",
    "results": [
      "글리세린 제형과 해당 기제 위약 사이에 경피수분손실(TEWL) 차이가 관찰되지 않았습니다.",
      "피부 정전용량의 차이도 관찰되지 않았습니다.",
      "요소 제형 사용 부위는 글리세린 제형 사용 부위보다 TEWL이 낮았고, 피부과 전문의의 임상 건조도 평가에서도 요소 제형이 우수했습니다."
    ],
    "limitations": [
      "아토피피부염 환자를 대상으로 한 특정 제형의 비교이므로 건강한 피부나 다른 제형의 결과와 동일하게 볼 수 없습니다.",
      "공개 초록에는 군별 인원·정량 변화·도포 횟수가 제시되지 않았습니다.",
      "이 연구에서 차이가 관찰되지 않았다는 사실이 글리세린을 함유한 모든 제품에 효과가 없다는 뜻은 아닙니다."
    ],
    "applicationNote": "연구는 20% 글리세린 보습제를 평가했습니다. 토너 T.1의 글리세린 3.0%, 세럼 S.1과 크림 C.1의 글리세린 5.0% 및 각 제품의 배합은 연구 제형과 다릅니다. 따라서 본 제품의 보습 효과가 검증되었거나 없다고 단정하는 자료로 사용할 수 없습니다.",
    "access": "초록 확인",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": true,
      "intervention": true,
      "comparator": true,
      "results": true
    },
    "verificationNote": "PubMed 공개 초록에서 109명, 20% 글리세린, 30일 사용, 기제 및 요소·염화나트륨 비교와 결과를 확인했습니다. 도포 횟수와 군별 인원은 확인되지 않았습니다. DOI는 Europe PMC의 MED/11737814 서지 레코드와 대조했습니다.",
    "language": "en"
  },
  {
    "id": "gehring-dexpanthenol-2000",
    "ingredientIds": [
      "panthenol"
    ],
    "origin": "international",
    "originLabel": "해외 연구",
    "koreanTitle": "덱스판테놀 제형의 각질층 수분과 경피수분손실 비교",
    "originalTitle": "Effect of topically applied dexpanthenol on epidermal barrier function and stratum corneum hydration. Results of a human in vivo study",
    "authors": "Gehring W, Gloor M",
    "year": 2000,
    "journal": "Arzneimittelforschung. 2000;50(7):659–663",
    "doi": "10.1055/s-0031-1300268",
    "url": "https://pubmed.ncbi.nlm.nih.gov/10965426/",
    "studyType": "인체시험",
    "designDetails": "서로 다른 두 친유성 기제에 덱스판테놀을 배합하고 각각의 기제 대조군과 비교한 무작위·이중눈가림·위약 대조 인체시험입니다.",
    "summary": "덱스판테놀을 배합한 두 가지 친유성 제형을 7일간 사용한 연구에서 기제 대조군보다 각질층 수분이 증가하고 경피수분손실이 감소했습니다. 공개 초록에는 참여자 수와 정확한 배합 농도가 명시되지 않았습니다.",
    "population": "사람을 대상으로 한 연구입니다. 정확한 참여자 수와 세부 대상 조건은 공개 초록에서 확인되지 않았습니다.",
    "intervention": "서로 다른 두 친유성 기제에 덱스판테놀을 배합해 7일간 사용했습니다. 정확한 농도와 도포 횟수는 공개 초록에 제시되지 않았습니다.",
    "comparator": "덱스판테놀을 배합하지 않은 각 제형의 기제 대조군.",
    "results": [
      "7일 사용 후 각질층 수분이 증가하고 경피수분손실(TEWL)이 감소했습니다.",
      "활성 성분을 함유한 제형과 기제 대조군의 차이는 두 지표 모두에서 통계적으로 유의했습니다."
    ],
    "limitations": [
      "참여자 수·정확한 배합 농도·도포 횟수·절대 변화량을 공개 초록에서 확인하지 못했습니다.",
      "7일간 특정 친유성 제형을 사용한 결과이며 장기 효과나 다른 제형의 결과를 보여주지 않습니다.",
      "농도와 대상 조건이 충분히 공개되지 않은 자료이므로 제품의 판테놀 함량에 직접 대응하는 근거로 해석할 수 없습니다."
    ],
    "applicationNote": "세럼 S.1의 판테놀 0.5% 및 토너 T.1의 판테놀 0.5%와 연구 제형의 농도가 같은지 확인되지 않았습니다. 덱스판테놀 원료의 규격과 친유성 기제도 본 제품과 동일하다고 볼 수 없으므로 본 제품의 효과를 직접 검증한 자료가 아닙니다.",
    "access": "초록 확인",
    "checks": {
      "bibliography": true,
      "design": true,
      "population": false,
      "intervention": false,
      "comparator": true,
      "results": true
    },
    "verificationNote": "PubMed의 서지와 공개 초록에서 인체시험 설계, 7일 사용, 기제 대조 조건과 두 지표의 결과를 확인했습니다. 참여자 수와 정확한 농도·도포 횟수가 명시되지 않아 대상·표본 및 농도·사용 조건 항목은 미확인으로 표시합니다. 유료 원문을 확인한 자료가 아닙니다.",
    "language": "en"
  }
];

export function getResearchIngredients(productSlug) {
  const product = products.find(item => item.slug === productSlug);
  if (!product) return [];
  return (productIngredients[productSlug] || []).map(id => {
    const name = ingredientCatalog[id];
    const label = product.ingredients.find(([label]) => label.startsWith(name))?.[0] || name;
    const fullName = id === 'ceramide-np' ? '세라마이드엔피' : name;
    const index = product.fullIngredients?.indexOf(fullName) ?? -1;
    const concentration = label.match(/[\d.]+%/)?.[0] || (index >= 0 ? product.fullIngredientConcentrations?.[index] : '') || '미공개';
    return { id, name, concentration };
  });
}

export function getProductResearch(productSlug) {
  const product = products.find(item => item.slug === productSlug);
  const ingredients = getResearchIngredients(productSlug);
  if (!product) return [];
  return researchPapers.filter(paper => paper.ingredientIds.some(id => ingredients.some(ingredient => ingredient.id === id))).map(paper => {
    const labels = ingredients.filter(ingredient => paper.ingredientIds.includes(ingredient.id)).map(ingredient => `${ingredient.name} ${ingredient.concentration}`).join(' · ');
    const newlyLinked = (productSlug === 'toner-t1' && paper.ingredientIds.includes('hyaluronic-acid'))
      || (productSlug === 'cream-c1' && paper.ingredientIds.includes('panthenol'));
    const applicationNote = newlyLinked
      ? '연구에 사용한 원료·농도·제형과 이 제품의 동등성은 확인되지 않았습니다.'
      : paper.applicationNote;
    return {
      ...paper,
      applicationNote,
      productScope: `${product.name}의 공개된 관련 성분은 ${labels}입니다. ${applicationNote} 이 논문은 ${product.name}의 완제품 시험 결과가 아니며, 이 제품의 효과·안전성을 보장하지 않습니다.`,
    };
  });
}

export function getInformationCoverage(papers) {
  const entries = Array.isArray(papers) ? papers : [];
  const total = entries.length * INFORMATION_CHECKS.length;
  const confirmed = entries.reduce((sum, paper) => sum + INFORMATION_CHECKS.filter(check => paper.checks?.[check.key] === true).length, 0);
  return { percent: total ? Math.round(confirmed / total * 100) : null, confirmed, total };
}
