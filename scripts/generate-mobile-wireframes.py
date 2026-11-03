#!/usr/bin/env python3
"""Build current mobile wireframes as matching, editable JSON and SVG vectors.

The application is the content source. These are viewport/state diagrams, not
screenshots: scrolling context belongs in screen metadata and on the board.
Run with Python 3; no third-party packages or network access are required.
"""

from __future__ import annotations

import json
import math
import unicodedata
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "design" / "mobile"
W, H = 390, 844
FONT = "Noto Sans KR"
WHITE = "#FFFFFF"
PAPER = "#FAFAFA"
LIGHT = "#F2F2F2"
MID = "#E5E5E5"
LINE = "#D0D0D0"
MUTED = "#717171"
INK = "#222222"
BLACK = "#111111"

PRODUCTS = {
    "toner": {"name": "토너 T.1", "en": "Transparency. Toner T.1", "type": "수분 토너", "volume": "150 mL", "price": "18,000원", "rating": "3.1", "step": "STEP 01 · 피부 정돈하기", "key": "글리세린 3.0% · 판테놀 0.5% · 베타글루칸 0.1%"},
    "serum": {"name": "세럼 S.1", "en": "Transparency. Serum S.1", "type": "수분 세럼", "volume": "30 mL", "price": "24,000원", "rating": "3.3", "step": "STEP 02 · 수분 채우기", "key": "글리세린 5.0% · 판테놀 1.0% · 소듐하이알루로네이트 0.1%"},
    "cream": {"name": "크림 C.1", "en": "Transparency. Cream C.1", "type": "보습 크림", "volume": "50 mL", "price": "26,000원", "rating": "3.0", "step": "STEP 03 · 보습 마무리", "key": "글리세린 5.0% · 스쿠알란 3.0% · 세라마이드 NP 0.05%"},
}


def glyph_width(char: str, size: float) -> float:
    """Conservative Korean-capable estimate used only for explicit line breaks."""
    if char.isspace():
        return size * 0.31
    if unicodedata.east_asian_width(char) in ("W", "F"):
        return size
    if char in "ilI.,:;!'|":
        return size * 0.31
    if char in "MW@%":
        return size * 0.86
    return size * 0.59


def wrap(value: str, width: float, size: float) -> list[str]:
    """Wrap at spaces when possible; split long Korean words only if necessary."""
    result: list[str] = []
    for paragraph in value.split("\n"):
        if not paragraph:
            result.append("")
            continue
        current = ""
        for word in paragraph.split(" "):
            candidate = f"{current} {word}" if current else word
            if sum(glyph_width(c, size) for c in candidate) <= width:
                current = candidate
                continue
            if current:
                result.append(current)
                current = ""
            for char in word:
                if current and sum(glyph_width(c, size) for c in current + char) > width:
                    result.append(current)
                    current = ""
                current += char
        result.append(current)
    return result


class Scene:
    def __init__(self, sid: str, slug: str, title: str, group: str, note: str, active: int = 0):
        self.meta = {"id": sid, "slug": slug, "title": title, "group": group, "note": note}
        self.nodes: list[dict] = []
        self.chrome(active)

    def rect(self, x, y, width, height, fill=WHITE, stroke=LINE, radius=0, stroke_width=1):
        self.nodes.append({"type": "rect", "x": x, "y": y, "width": width, "height": height, "fill": fill, "stroke": stroke, "radius": radius, "strokeWidth": stroke_width})

    def text(self, x, y, value, size=13, fill=INK, weight=400, width=342, align="left"):
        self.nodes.append({"type": "text", "x": x, "y": y, "text": str(value), "fontSize": size, "fontWeight": weight, "fill": fill, "width": width, "align": align})

    def para(self, x, y, value, width=342, size=12, gap=None, fill=MUTED, weight=400):
        gap = gap or math.ceil(size * 1.65)
        lines = wrap(value, width, size)
        for index, row in enumerate(lines):
            if row:
                self.text(x, y + index * gap, row, size, fill, weight, width)
        return y + len(lines) * gap

    def line(self, x1, y1, x2, y2, stroke=LINE, stroke_width=1):
        self.nodes.append({"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "stroke": stroke, "strokeWidth": stroke_width})

    def ellipse(self, x, y, width, height, fill=WHITE, stroke=LINE, stroke_width=1):
        self.nodes.append({"type": "ellipse", "x": x, "y": y, "width": width, "height": height, "fill": fill, "stroke": stroke, "strokeWidth": stroke_width})

    def chrome(self, active):
        self.rect(0.5, 0.5, 389, 843, WHITE, LINE, 29)
        self.text(25, 16, "9:41", 14, BLACK, 700, 60)
        self.rect(146, 11, 98, 27, BLACK, BLACK, 15, 0)
        for idx, height in enumerate((5, 8, 11, 14)):
            self.rect(291 + idx * 5, 30 - height, 3, height, BLACK, BLACK, 1, 0)
        self.text(317, 16, "⌁", 18, BLACK, 700, 20)
        self.rect(343, 19, 22, 11, WHITE, BLACK, 3)
        self.rect(345, 21, 17, 7, BLACK, BLACK, 1, 0)
        self.rect(366, 22, 2, 5, BLACK, BLACK, 1, 0)
        self.text(20, 63, "Transparency.", 21, BLACK, 700, 214)
        self.ellipse(252, 59, 32, 32, LIGHT, LINE)
        self.ellipse(261, 68, 14, 14, WHITE, MUTED)
        self.rect(268, 68, 7, 14, MUTED, MUTED, 0, 0)
        self.rect(292, 60, 79, 30, PAPER, LINE, 15)
        self.text(297, 70, "MY PRODUCTS", 10, INK, 500, 68, "center")
        self.line(0, 101, W, 101)
        # Floating navigation is identical on every viewport. Content stops at 742.
        self.rect(16, 757, 358, 66, PAPER, LINE, 28)
        step = 86
        self.rect(22 + active * step, 763, 86, 54, MID, MID, 22, 0)
        labels = ["홈", "제품 탐색", "내 제품", "더보기"]
        for idx, label in enumerate(labels):
            cx = 65 + idx * step
            color = BLACK if idx == active else MUTED
            self.nav_icon(cx, 772, idx, color)
            self.text(cx - 39, 798, label, 10, color, 700 if idx == active else 400, 78, "center")
        self.rect(135, 833, 120, 4, BLACK, BLACK, 2, 0)

    def nav_icon(self, cx, y, kind, color):
        if kind == 0:
            self.line(cx - 9, y + 9, cx, y + 1, color, 1.5)
            self.line(cx, y + 1, cx + 9, y + 9, color, 1.5)
            self.line(cx - 6, y + 7, cx - 6, y + 19, color, 1.5)
            self.line(cx + 6, y + 7, cx + 6, y + 19, color, 1.5)
            self.line(cx - 6, y + 19, cx + 6, y + 19, color, 1.5)
        elif kind == 1:
            self.ellipse(cx - 9, y + 1, 13, 13, PAPER, color, 1.5)
            self.line(cx + 2, y + 13, cx + 9, y + 20, color, 1.5)
        elif kind == 2:
            self.rect(cx - 8, y + 5, 16, 16, PAPER, color, 2, 1.5)
            self.line(cx - 4, y + 5, cx - 4, y + 1, color, 1.5)
            self.line(cx + 4, y + 5, cx + 4, y + 1, color, 1.5)
            self.line(cx - 4, y + 1, cx + 4, y + 1, color, 1.5)
        else:
            for dx in (-8, 0, 8):
                self.ellipse(cx + dx - 1.5, y + 10, 3, 3, color, color, 0)

    def eyebrow(self, y, value, x=24, width=342):
        self.text(x, y, value, 10, MUTED, 700, width)

    def heading(self, y, value, size=27, x=24, width=342):
        return self.para(x, y, value, width, size, math.ceil(size * 1.28), INK, 700)

    def button(self, y, label, x=24, width=342, height=44, primary=False, disabled=False):
        fill = MID if disabled else INK if primary else WHITE
        self.rect(x, y, width, height, fill, LINE if disabled else INK if primary else LINE, 12)
        self.text(x + 8, y + (height - 18) / 2, label, 12, MUTED if disabled else WHITE if primary else INK, 600, width - 16, "center")

    def pill(self, x, y, label, width=72, selected=False):
        self.rect(x, y, width, 28, INK if selected else LIGHT, INK if selected else LINE, 14)
        self.text(x + 5, y + 6, label, 11, WHITE if selected else INK, 500, width - 10, "center")

    def placeholder(self, x, y, width, height, label="제품 이미지", texture=False):
        self.rect(x, y, width, height, LIGHT if not texture else MID, LINE, 12)
        self.line(x + 1, y + 1, x + width - 1, y + height - 1, LINE)
        self.line(x + width - 1, y + 1, x + 1, y + height - 1, LINE)
        if label:
            label_width = min(width - 16, max(76, len(label) * 11 + 16))
            self.rect(x + (width - label_width) / 2, y + height / 2 - 13, label_width, 26, LIGHT if not texture else MID, LIGHT if not texture else MID, 4, 0)
            self.text(x + (width - label_width) / 2, y + height / 2 - 8, label, 11, MUTED, 400, label_width, "center")

    def field(self, y, label, value="", placeholder="", x=24, width=342, height=42, error=None):
        self.text(x, y, label, 12, INK, 600, width)
        self.rect(x, y + 22, width, height, WHITE, INK if error else LINE, 9, 1.5 if error else 1)
        self.text(x + 12, y + 33, value or placeholder, 12, INK if value else MUTED, 400, width - 24)
        if error:
            return self.para(x, y + 22 + height + 6, error, width, 10, 15, INK)
        return y + 22 + height

    def row(self, y, label, value="", height=44, x=24, width=342):
        self.text(x, y + 13, label, 12, INK, 500, width * 0.57)
        self.text(x + width * 0.57, y + 13, value, 12, MUTED, 400, width * 0.43, "right")
        self.line(x, y + height, x + width, y + height)

    def detail_tabs(self, active, y=173):
        labels = ["성분·함량", "효능·근거", "사용 안내", "질문하기", "사용자 리뷰"]
        self.rect(16, y, 358, 43, LIGHT, LINE, 12)
        step = 70
        self.rect(20 + active * step, y + 4, step, 35, WHITE, LINE, 9)
        for index, label in enumerate(labels):
            self.text(20 + index * step, y + 15, label, 10, INK if index == active else MUTED, 700 if index == active else 400, step, "center")

    def detail_top(self, active):
        self.text(24, 116, "← 제품 목록", 11, MUTED, 500, 145)
        self.text(24, 139, "세럼 S.1", 21, INK, 700, 220)
        self.text(260, 145, "30 mL · 24,000원", 10, MUTED, 400, 106, "right")
        self.detail_tabs(active)

    def product_card(self, y, key):
        product = PRODUCTS[key]
        self.rect(24, y, 342, 336, WHITE, LINE, 20)
        self.placeholder(34, y + 10, 322, 170, f'{product["name"]} · 제품 이미지')
        self.pill(45, y + 22, product["type"], 72)
        self.button(y + 22, "제형 보기", 246, 100, 44)
        self.text(39, y + 197, product["en"], 10, MUTED, 400, 245)
        self.text(284, y + 197, product["volume"], 10, MUTED, 400, 57, "right")
        self.text(39, y + 219, product["name"], 20, INK, 700, 200)
        self.text(241, y + 224, product["price"], 13, INK, 600, 100, "right")
        self.text(39, y + 256, f'★ {product["rating"]}  전체 10개 리뷰', 12, INK, 600, 270)
        self.para(39, y + 282, product["key"], 294, 10, 15)
        self.text(39, y + 314, product["step"], 10, MUTED, 500, 290)

    def export(self):
        return {**self.meta, "nodes": self.nodes}


SCENES: list[Scene] = []


def add(sid, slug, title, group, note, active=0):
    screen = Scene(sid, slug, title, group, note, active)
    SCENES.append(screen)
    return screen


def home_scenes():
    s = add("M01", "home", "홈 · 첫 화면", "홈", "앱 시작 화면. 아래로 스크롤하면 브랜드 원칙과 제품 순서가 이어집니다.")
    s.eyebrow(126, "NOTHING TO HIDE.")
    s.heading(159, "가릴 것이\n없으니까.", 38)
    s.text(24, 267, "Transparency.", 30, BLACK, 700, 342)
    s.para(24, 316, "궁금했던 성분부터,\n나에게 맞는 사용법까지.", 342, 14, 24, INK)
    s.button(386, "제품 살펴보기 ↗", width=183)
    s.placeholder(24, 458, 342, 216, "투명 유리 · 세럼 이미지")
    s.text(24, 698, "극도의 투명함, 손안에서.", 13, INK, 500, 342)
    s.eyebrow(725, "TRANSPARENCY. / NOTHING TO HIDE.")

    s = add("M02", "home-products", "홈 · 제품 순서", "홈", "홈 제품 영역의 T.1 전체 카드와 S.1 시작 부분. 스크롤 순서는 T.1 → S.1 → C.1입니다.")
    s.eyebrow(120, "THE FORMULAS")
    s.heading(144, "궁금했던 성분부터.", 26)
    s.text(24, 188, "토너 → 세럼 → 크림", 12, MUTED, 400, 225)
    s.text(244, 188, "모든 제품 보기 ↗", 11, INK, 500, 122, "right")
    s.product_card(231, "toner")
    # Next card enters the viewport; its metadata continues below the screen.
    s.rect(24, 585, 342, 157, WHITE, LINE, 20)
    s.placeholder(34, 595, 322, 147, "세럼 S.1 · 제품 이미지")
    s.pill(45, 607, "수분 세럼", 72)


def explore_scenes():
    s = add("M03", "explore", "제품 탐색 · 기본 목록", "제품 탐색", "모바일 세로 카드 목록의 첫 제품 T.1. 아래로 S.1·C.1이 이어지며 별점은 각 제품 리뷰 기준입니다.", 1)
    s.eyebrow(119, "EXPLORE / THE FORMULAS")
    s.heading(143, "성분에 장난 없이.", 28)
    s.para(24, 188, "궁금했던 성분부터, 제품의 근거와 사용법까지.", 342, 12)
    s.field(222, "제품 검색", placeholder="제품명 또는 성분명으로 검색")
    for x, label, width, selected in ((24, "전체", 58, True), (89, "수분 토너", 86, False), (182, "수분 세럼", 86, False), (275, "보습 크림", 91, False)):
        s.pill(x, 303, label, width, selected)
    s.text(24, 349, "사용 순서대로", 12, INK, 600, 210)
    s.text(270, 351, "03 PRODUCTS", 10, MUTED, 500, 96, "right")
    s.text(24, 373, "STEP 01 토너 → STEP 02 세럼 → STEP 03 크림", 10, MUTED, 400, 342)
    s.product_card(402, "toner")

    s = add("M04", "search-empty", "제품 탐색 · 검색 결과 없음", "제품 탐색", "입력어 ‘레미콘’에 일치하는 제품이 없는 상태. 검색·필터 초기화로 목록을 복구합니다.", 1)
    s.eyebrow(119, "EXPLORE / THE FORMULAS")
    s.heading(143, "성분에 장난 없이.", 28)
    s.field(208, "제품 검색", value="레미콘")
    s.text(332, 242, "×", 18, MUTED, 400, 20, "center")
    for x, label, width, selected in ((24, "전체", 58, True), (89, "수분 토너", 86, False), (182, "수분 세럼", 86, False), (275, "보습 크림", 91, False)):
        s.pill(x, 289, label, width, selected)
    s.text(24, 337, "00 PRODUCTS", 10, MUTED, 500, 342)
    s.ellipse(159, 411, 72, 72, LIGHT, LINE)
    s.ellipse(181, 432, 24, 24, LIGHT, MUTED)
    s.line(201, 452, 211, 462, MUTED, 2)
    s.text(24, 510, "일치하는 제품이 없어요.", 22, INK, 700, 342, "center")
    s.para(52, 553, "다른 검색어로 찾아보거나\n필터를 초기화해 보세요.", 286, 13, 22)
    s.button(624, "검색·필터 초기화 ↗", 62, 266)


def overview(sid, slug, title, texture=False):
    note = "제품 탐색에서 S.1 선택. 상세 첫 영역이며 아래에 성분·함량 탭과 QR 정보가 이어집니다."
    if texture:
        note = "M05에서 ‘제형 보기’ 선택. 같은 제품·같은 주소에서 대표 이미지가 제형으로 전환됩니다."
    s = add(sid, slug, title, "제품 상세", note, 1)
    s.text(24, 116, "← 제품 목록", 11, MUTED, 500, 342)
    s.placeholder(24, 144, 342, 190, "세럼 S.1 · 제형 이미지" if texture else "세럼 S.1 · 제품 이미지", texture)
    s.button(156, "제품 보기" if texture else "제형 보기", 254, 100, 44)
    s.eyebrow(354, "TRANSPARENCY. SERUM S.1")
    s.heading(377, "세럼 S.1", 28)
    s.text(256, 389, "30 mL", 12, MUTED, 400, 110, "right")
    s.text(24, 422, "24,000원", 19, INK, 700, 170)
    s.text(194, 429, "★ 3.3 · 전체 10개 리뷰", 11, INK, 500, 172, "right")
    s.para(24, 462, "필요한 수분, 확인할 수 있는 성분.\n매일의 수분 관리를 위한 세럼입니다.", 342, 12, 21)
    s.rect(24, 522, 342, 76, LIGHT, LINE, 12)
    s.text(38, 535, "루틴 단계", 10, MUTED, 500, 90)
    s.text(133, 535, "STEP 02 · 수분 채우기", 12, INK, 500, 215)
    s.text(38, 568, "제형", 10, MUTED, 500, 90)
    s.text(133, 568, "투명 수용성 젤", 12, INK, 400, 215)
    s.button(616, "구매하기 ↗", primary=True)
    s.button(672, "내 제품에 추가 ＋")
    s.text(24, 727, "성분·함량 / 효능·근거 / 사용 안내 / 질문하기 / 리뷰", 10, MUTED, 400, 342)


def information_scenes():
    overview("M05", "product-overview", "제품 상세 · 제품 이미지")
    overview("M06", "product-texture", "제품 상세 · 제형 이미지", True)

    s = add("M07", "product-ingredients", "성분·함량 · 핵심 성분", "제품 상세", "세럼 S.1 상세에서 성분·함량 영역까지 스크롤. 주요 성분 3개와 각 역할을 확인합니다.", 1)
    s.detail_top(0)
    s.eyebrow(239, "01 / INGREDIENTS")
    s.heading(262, "무엇을, 얼마나 담았는지.", 23)
    for y, title, amount, role, description in (
        (310, "글리세린", "5.0%", "보습", "피부가 촉촉한 상태를 유지하도록 돕습니다."),
        (432, "판테놀", "1.0%", "피부 컨디셔닝 · 보습", "보습과 피부 컨디셔닝에 사용하는 성분입니다.\n매일의 수분 관리에 함께합니다."),
        (554, "소듐하이알루로네이트", "0.1%", "보습", "물을 붙잡는 특성을 가진 보습 성분입니다.\n피부 표면의 수분 유지에 도움을 줍니다."),
    ):
        s.rect(24, y, 342, 109, WHITE, LINE, 12)
        s.text(38, y + 14, title, 16, INK, 700, 258)
        s.text(298, y + 15, amount, 14, INK, 700, 54, "right")
        s.text(38, y + 44, role, 11, MUTED, 500, 310)
        s.para(38, y + 66, description, 304, 11, 17)
    s.text(24, 685, "성분표 읽는 법", 13, INK, 600, 342)
    s.para(24, 708, "함량만으로 제품의 효과를 판단할 수 없습니다.\n전성분은 제품 표시에서 함께 확인하세요.", 342, 10, 15)

    s = add("M08", "product-evidence", "효능·근거 · 연구 범위", "제품 상세", "세럼 S.1 효능·근거 탭. 성분 연구와 공개되지 않은 완제품 결과를 구분합니다.", 1)
    s.detail_top(1)
    s.eyebrow(239, "02 / EVIDENCE")
    s.heading(262, "성분 연구와 완제품 결과를\n구분합니다.", 23)
    s.rect(24, 334, 342, 94, LIGHT, LINE, 12)
    s.text(38, 349, "공개된 완제품 시험 자료가 없습니다.", 13, INK, 700, 314)
    s.para(38, 376, "세럼 S.1의 보습 효과와 지속시간에 관한\n완제품 시험 결과는 공개된 자료에 포함되지 않습니다.", 310, 11, 18)
    s.text(24, 453, "히알루론산 · 성분 연구", 17, INK, 700, 342)
    s.para(24, 487, "여성 76명을 대상으로 한 연구에서 히알루론산 0.1% 크림을 60일간 사용했을 때 피부 수분과 탄력이 개선되었습니다.", 342, 12, 21)
    s.text(24, 563, "참고 연구: Pavicic 외(2011)", 11, INK, 500, 342)
    s.line(24, 593, 366, 593)
    s.text(24, 615, "연구 적용 범위", 14, INK, 700, 342)
    s.para(24, 645, "성분 또는 연구용 제형의 결과이며 세럼 S.1의 완제품 시험 결과가 아닙니다. 원료 특성·배합·사용 조건에 따라 실제 효과는 달라질 수 있습니다.", 342, 11, 19)
    s.text(24, 721, "자료 확인일 2026.10.27", 10, MUTED, 400, 342)

    s = add("M09", "product-guide", "사용 안내 · 루틴과 주의사항", "제품 상세", "세럼 S.1 사용 안내 탭. 사용 순서·약 0.5 mL·잔량 확인·보관·분리배출 안내입니다.", 1)
    s.detail_top(2)
    s.eyebrow(239, "03 / HOW TO USE")
    s.heading(262, "첫 사용부터,\n마지막 한 방울까지.", 25)
    s.rect(24, 338, 342, 66, LIGHT, LINE, 12)
    s.text(38, 351, "사용 순서", 11, MUTED, 600, 310)
    s.text(38, 377, "세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1", 11, INK, 600, 310)
    for y, label, body in (
        (427, "1회 사용량", "약 0.5 mL · 피부 상태와 사용감에 맞춰 조절"),
        (488, "잔량 확인", "용기에서 남은 양을 직접 확인"),
        (549, "보관 방법", "직사광선과 고온을 피해 보관"),
        (610, "분리배출", "부품별 재질 확인 후 분리"),
    ):
        s.text(24, y, label, 13, INK, 700, 342)
        s.text(24, y + 26, body, 12, MUTED, 400, 342)
        s.line(24, y + 47, 366, y + 47)
    s.para(24, 679, "사용 중 피부에 이상이 생기면 사용을 멈추고\n전문가와 상담하세요. 제품의 주의사항을 확인하세요.", 342, 11, 19)


def question_header(s, mode="Gemini AI"):
    s.detail_top(3)
    s.eyebrow(236, "ASK TRANSPARENCY.")
    s.heading(259, "Transparency.에게 물어보기", 21)
    s.pill(24, 298, mode, 118 if mode == "제품 자료 답변" else 102)


def question_composer(s, y, draft="", height=72, compact=False):
    s.text(24, y, "질문 작성", 12, INK, 600, 260)
    s.text(300, y + 1, f"{len(draft)}/500", 10, MUTED, 400, 66, "right")
    s.rect(24, y + 24, 342, height, WHITE, LINE, 12)
    s.para(37, y + 37, draft or "예: 이 제품을 토너 다음에 사용하면 되나요?", 316, 11, 18, INK if draft else MUTED)
    if not compact:
        s.text(24, y + height + 33, "Enter로 전송 · Shift+Enter로 줄바꿈", 10, MUTED, 400, 342)
    s.button(y + height + (57 if not compact else 36), "질문 보내기 ↗", primary=True)


def source(s, y, title="세럼 S.1 사용 안내", section="사용 안내", excerpt="토너 다음에 약 0.5 mL를 사용합니다.", height=79):
    s.rect(37, y, 316, height, WHITE, LINE, 10)
    s.text(49, y + 12, title, 12, INK, 600, 224)
    s.text(273, y + 14, f"{section} ↗", 10, MUTED, 400, 67, "right")
    s.para(49, y + 38, excerpt, 290, 11, 17)


def question_scenes():
    s = add("M10", "questions-idle", "질문하기 · 입력과 FAQ", "질문하기", "질문하기 초기 상태의 입력·FAQ 구성. 추천 질문 3개와 500자 입력, 아래쪽 FAQ가 이어집니다.", 1)
    question_header(s)
    s.button(342, "글리세린의 역할이 궁금해요.", height=36)
    s.button(386, "어떤 순서와 양으로 사용하나요?", height=36)
    s.button(430, "제품 효능의 근거를 확인하고 싶어요.", height=36)
    question_composer(s, 488, height=57, compact=True)
    s.text(24, 638, "질문과 제품 자료는 답변을 위해 전송됩니다.", 10, MUTED, 400, 342)
    s.text(24, 656, "대화는 이 브라우저의 저장소에 보관하지 않습니다.", 10, MUTED, 400, 342)
    s.line(24, 686, 366, 686)
    s.text(24, 699, "자주 묻는 질문", 14, INK, 700, 235)
    s.text(24, 724, "어떤 피부 타입을 위한 제품인가요?", 11, INK, 500, 306)
    s.text(341, 719, "+", 17, MUTED, 400, 25, "center")

    s = add("M11", "questions-ai-answer", "질문하기 · Gemini 답변", "질문하기", "Gemini 연결 성공 상태의 답변 영역. 근거는 실제 정보 탭으로 연결되며 다음 질문 입력란이 아래에 이어집니다.", 1)
    question_header(s)
    s.text(262, 307, "대화 지우기", 10, MUTED, 500, 104, "right")
    s.rect(58, 345, 308, 57, LIGHT, LINE, 12)
    s.text(72, 357, "나의 질문", 10, MUTED, 600, 280)
    s.text(72, 377, "토너 다음에 사용하면 되나요?", 12, INK, 400, 280)
    s.rect(24, 418, 342, 227, PAPER, LINE, 12)
    s.text(37, 431, "Gemini 답변", 11, INK, 700, 316)
    s.para(37, 457, "네. 세럼 S.1은 토너 T.1 다음, 크림 C.1 전에 약 0.5 mL를 사용하도록 안내합니다.", 316, 12, 20, INK)
    s.text(37, 529, "답변의 근거", 11, INK, 700, 316)
    source(s, 552)
    s.para(24, 657, "AI 답변은 정확하지 않을 수 있습니다.\n근거와 제품 표기를 함께 확인하세요.", 342, 10, 16)
    s.text(24, 701, "질문 작성", 12, INK, 600, 260)
    s.text(300, 702, "0/500", 10, MUTED, 400, 66, "right")
    s.rect(24, 724, 342, 18, WHITE, LINE, 8)

    s = add("M12", "questions-reference-answer", "질문하기 · 제품 자료 답변", "질문하기", "Gemini 미연결 시 제품 자료를 안내한 상태. AI로 표현하지 않으며 다음 질문 입력란이 아래에 이어집니다.", 1)
    question_header(s, "제품 자료 답변")
    s.para(24, 339, "지금은 등록된 제품 자료로 안내합니다.\nGemini 답변은 연결 후 사용할 수 있습니다.", 342, 11, 18)
    s.rect(58, 393, 308, 56, LIGHT, LINE, 12)
    s.text(72, 405, "나의 질문", 10, MUTED, 600, 280)
    s.text(72, 425, "한 번에 얼마나 사용하나요?", 12, INK, 400, 280)
    s.rect(24, 465, 342, 205, PAPER, LINE, 12)
    s.text(37, 479, "제품 자료 답변", 12, INK, 700, 316)
    s.para(37, 508, "1회 약 0.5 mL를 사용합니다.\n피부 상태와 사용감에 맞춰 조절해 주세요.", 316, 12, 20, INK)
    source(s, 562, excerpt="1회 사용량: 약 0.5 mL")
    s.text(37, 648, "Gemini가 연결되지 않아 제품 자료로 안내했습니다.", 10, MUTED, 400, 316)
    s.text(24, 701, "질문 작성", 12, INK, 600, 260)
    s.text(300, 702, "0/500", 10, MUTED, 400, 66, "right")
    s.rect(24, 724, 342, 18, WHITE, LINE, 8)

    s = add("M13", "questions-error", "질문하기 · 연결 오류", "질문하기", "네트워크 연결 실패. 전송한 질문은 대화에 남고 입력란은 비워지며 ‘다시 시도’로 같은 질문을 재요청합니다.", 1)
    question_header(s, "연결 확인 필요")
    s.rect(58, 346, 308, 69, LIGHT, LINE, 12)
    s.text(72, 359, "나의 질문", 10, MUTED, 600, 280)
    s.para(72, 383, "이 제품을 토너 다음에 사용하면 되나요?", 280, 12, 20, INK)
    s.rect(24, 439, 342, 139, LIGHT, LINE, 12)
    s.ellipse(39, 455, 21, 21, WHITE, MUTED)
    s.text(39, 457, "!", 13, INK, 700, 21, "center")
    s.para(73, 454, "네트워크에 연결하지 못했습니다.\n연결 상태를 확인한 뒤 다시 시도해 주세요.", 277, 12, 21, INK)
    s.button(518, "다시 시도", 39, 312, 43)
    question_composer(s, 603, height=58, compact=True)


def reviews_scenes():
    s = add("M14", "reviews-list", "사용자 리뷰 · 낮은 별점부터", "사용자 리뷰", "S.1의 리뷰만 별점 낮은 순으로 표시. 준비된 10개 리뷰도 전체 수와 평균 별점에 포함됩니다.", 1)
    s.detail_top(4)
    s.eyebrow(239, "05 / USER REVIEWS")
    s.heading(261, "사용자의 경험을 먼저 봅니다.", 23)
    s.rect(24, 309, 342, 83, LIGHT, LINE, 12)
    s.text(38, 321, "★ 3.3", 30, INK, 700, 150)
    s.text(197, 324, "전체 10개 리뷰", 14, INK, 700, 153, "right")
    s.text(38, 363, "작성 0 · 예시 10", 10, MUTED, 400, 140)
    s.text(191, 363, "별점은 전체 리뷰 기준", 10, MUTED, 400, 159, "right")
    s.text(24, 413, "★ 별점 낮은 순", 12, INK, 700, 342)
    s.para(24, 442, "평균 별점과 전체 리뷰 수에는 화면 구성을 위해 작성한 글이 포함됩니다. 해당 글은 실제 구매 후기가 아닙니다.", 342, 10, 16)
    s.line(24, 505, 366, 505)
    s.text(24, 524, "★☆☆☆☆", 15, INK, 600, 342)
    s.para(24, 554, "젤을 스포이트로 덜 때 한 번에 얼마나 나오는지 가늠하기 어려웠어요. 스포이트에도 한 번 사용할 양을 참고할 수 있는 표시가 필요해 보여요.", 342, 12, 21, INK)
    s.line(24, 654, 366, 654)
    s.text(24, 675, "★★☆☆☆", 15, INK, 600, 342)
    s.para(24, 705, "제 기준에는 한꺼번에 많이 바르면 손에 남는 느낌이 있었어요.", 342, 11, 18, INK)

    s = add("M15", "review-form-validation", "사용자 리뷰 · 작성 검증", "사용자 리뷰", "리뷰 작성 영역까지 스크롤. 3점을 선택하고 ‘좋아요’만 제출하여 내용 길이 오류가 표시된 상태입니다.", 1)
    s.detail_top(4)
    s.eyebrow(239, "YOUR EXPERIENCE")
    s.heading(262, "사용 경험을 들려주세요.", 24)
    s.text(24, 315, "별점 선택 필수", 12, INK, 700, 342)
    for index in range(5):
        s.pill(24 + index * 70, 342, f"{index + 1}점", 62, selected=index == 2)
    s.text(24, 387, "1점은 아쉬웠어요, 5점은 만족했어요.", 11, MUTED, 400, 342)
    s.text(24, 412, "좋았던 점과 불편했던 점을 10~1,000자로 작성해 주세요.", 10, MUTED, 400, 342)
    s.text(24, 456, "리뷰 내용 필수", 12, INK, 700, 260)
    s.text(293, 458, "3/1,000", 10, MUTED, 400, 73, "right")
    s.rect(24, 484, 342, 97, WHITE, INK, 12, 1.5)
    s.text(38, 499, "좋아요", 13, INK, 400, 314)
    s.text(24, 593, "! 리뷰 내용을 10~1,000자로 작성해 주세요.", 11, INK, 700, 342)
    s.para(24, 626, "리뷰는 현재 브라우저에 저장되며\n다른 기기와 공유되지 않습니다.", 342, 11, 18)
    s.button(687, "리뷰 남기기 ↗", primary=True)


def my_header(s, count=0, unopened=0, inuse=0, done=0):
    s.eyebrow(122, "MY PRODUCTS")
    s.heading(150, "나의 제품.\n나의 사용 기록.", 28)
    s.text(24, 237, "개봉일부터 마지막 한 방울까지, 한눈에.", 12, MUTED, 400, 342)
    s.button(277, "제품 등록하기 ＋")
    s.rect(24, 341, 342, 47, LIGHT, LINE, 14)
    labels = [f"전체 {count}", f"사용 중 {inuse}", f"미개봉 {unopened}", f"사용 완료 {done}"]
    for index, label in enumerate(labels):
        s.text(29 + index * 83, 359, label, 10, INK, 600, 83, "center")


def my_record(s, status="미개봉", date="", done=False):
    s.rect(24, 410, 342, 294, WHITE, LINE, 16)
    s.placeholder(38, 426, 96, 104, "")
    s.pill(151, 427, status, 90, selected=False)
    s.text(151, 468, "세럼 S.1", 20, INK, 700, 196)
    s.text(151, 502, "Transparency. Serum S.1", 10, MUTED, 400, 196)
    s.text(151, 520, "30 mL", 10, MUTED, 400, 196)
    s.field(555, "개봉일", date, "연도 - 월 - 일", 38, 314, 39)
    s.text(318, 589, "▦", 13, MUTED, 400, 20, "center")
    s.text(38, 626, "개봉일을 비워두면 미개봉으로 기록됩니다.", 10, MUTED, 400, 314)
    s.button(655, "사용 중으로 변경 ↗" if done else "사용 완료 ↗", 38, 193, 35)
    s.text(247, 666, "등록 삭제", 11, INK, 500, 96, "right")
    s.text(24, 723, "제품 기록은 현재 사용 중인 브라우저에 저장됩니다.", 10, MUTED, 400, 342)


def my_scenes():
    s = add("M16", "my-empty", "내 제품 · 등록 전", "내 제품", "제품 등록 전. 등록하기는 제품 탐색으로 이동하며 별도의 가입 또는 등록 입력 화면은 없습니다.", 2)
    my_header(s)
    s.ellipse(163, 428, 64, 64, LIGHT, LINE)
    s.text(163, 439, "+", 30, MUTED, 400, 64, "center")
    s.eyebrow(521, "YOUR DAILY RECORD")
    s.heading(548, "첫 제품을 등록해 보세요.", 23)
    s.para(24, 591, "개봉일부터 사용 완료까지,\n나의 제품을 투명하게 기록하세요.", 342, 12, 22)
    s.button(660, "등록할 제품 찾기 ↗", primary=True)
    s.text(24, 726, "제품 기록은 현재 사용 중인 브라우저에 저장됩니다.", 10, MUTED, 400, 342)

    s = add("M17", "my-unopened", "내 제품 · 미개봉", "내 제품", "제품 상세의 ‘내 제품에 추가’를 누르면 즉시 등록. 개봉일이 비어 있으면 미개봉입니다.", 2)
    my_header(s, count=1, unopened=1)
    my_record(s)

    s = add("M18", "my-in-use", "내 제품 · 개봉일 입력", "내 제품", "통합 목록의 개봉일 입력란에서 2026-11-03 입력. 날짜가 있으면 ‘사용 중’으로 표시됩니다.", 2)
    my_header(s, count=1, inuse=1)
    my_record(s, "사용 중", "2026-11-03")

    s = add("M19", "my-completed", "내 제품 · 사용 완료", "내 제품", "같은 목록에서 ‘사용 완료’ 실행. 별도 완료 탭 없이 상태와 되돌리기 버튼이 바뀝니다.", 2)
    my_header(s, count=1, done=1)
    my_record(s, "사용 완료", "2026-11-03", done=True)

    s = add("M20", "my-delete-confirm", "내 제품 · 삭제 확인", "내 제품", "‘등록 삭제’ 클릭 후 브라우저의 기본 확인 대화상자. 운영체제·브라우저에 따라 외형이 달라집니다.", 2)
    my_header(s, count=1, inuse=1)
    my_record(s, "사용 중", "2026-11-03")
    # Simulate native modal dimming with flat lightened vector colors, no raster.
    lighten = {WHITE: "#DBDBDB", PAPER: "#D9D9D9", LIGHT: "#D5D5D5", MID: "#CDCDCD", LINE: "#C0C0C0", MUTED: "#A0A0A0", INK: "#858585", BLACK: "#808080"}
    for node in s.nodes:
        for key in ("fill", "stroke"):
            if key in node:
                node[key] = lighten.get(node[key], node[key])
    s.rect(39, 317, 312, 182, WHITE, LINE, 17)
    s.text(55, 339, "transparency-web-five.vercel.app", 11, MUTED, 500, 280, "center")
    s.para(65, 375, "등록한 제품과 사용 기록을\n삭제할까요?", 260, 15, 23, INK, 600)
    s.line(39, 449, 351, 449)
    s.line(195, 449, 195, 499)
    s.text(43, 466, "취소", 14, INK, 500, 148, "center")
    s.text(199, 466, "확인", 14, INK, 700, 148, "center")


def more_scenes():
    s = add("M21", "more", "더보기 · 브랜드와 안내", "더보기", "더보기의 실제 6개 아코디언. 각 항목은 현재 화면 안에서 열리며 별도 법률·계정 페이지는 없습니다.", 3)
    s.eyebrow(123, "ABOUT TRANSPARENCY.")
    s.heading(154, "가릴 것이 없으니까.", 27)
    s.text(24, 204, "Transparency.", 29, INK, 700, 342)
    s.para(24, 260, "궁금했던 성분부터, 나에게 맞는 사용법까지.\n극도의 투명함, 손안에서.", 342, 12, 23)
    for idx, label in enumerate(("브랜드 철학", "정보 공개 원칙", "서비스 이용 안내", "계정 관리", "정보 상태와 문의", "개인정보·기록 관리")):
        y = 345 + idx * 61
        s.rect(24, y, 342, 50, WHITE, LINE, 12)
        s.text(39, y + 17, label, 13, INK, 600, 278)
        s.text(325, y + 13, "+", 20, MUTED, 400, 25, "center")

    s = add("M22", "more-privacy-open", "더보기 · 개인정보 안내 펼침", "더보기", "‘개인정보·기록 관리’ 아코디언을 연 뒤 해당 영역까지 스크롤한 상태입니다.", 3)
    s.eyebrow(121, "ABOUT TRANSPARENCY.")
    s.heading(146, "안내와 기록 관리", 27)
    for idx, label in enumerate(("계정 관리", "정보 상태와 문의")):
        y = 202 + idx * 60
        s.rect(24, y, 342, 49, WHITE, LINE, 12)
        s.text(39, y + 17, label, 13, INK, 600, 278)
        s.text(325, y + 13, "+", 20, MUTED, 400, 25, "center")
    s.rect(24, 322, 342, 370, PAPER, LINE, 12)
    s.text(39, 340, "개인정보·기록 관리", 14, INK, 700, 278)
    s.text(325, 338, "−", 19, MUTED, 400, 25, "center")
    s.line(38, 376, 352, 376)
    s.text(39, 397, "제품 기록과 리뷰", 13, INK, 700, 312)
    s.para(39, 425, "제품 기록과 작성한 리뷰는 현재 브라우저에 저장됩니다. 내 제품과 제품 리뷰에서 직접 삭제할 수 있습니다.", 310, 12, 21)
    s.text(39, 508, "질문과 답변", 13, INK, 700, 312)
    s.para(39, 537, "질문과 제품 자료는 답변을 위해 서버로 전송됩니다. Gemini 연결 시 AI 서비스로 전달되며, 대화는 브라우저 저장소에 보관하지 않습니다.", 310, 12, 21)
    s.text(39, 641, "문의  ztheng@inha.edu", 12, INK, 500, 310)
    s.text(24, 721, "필요한 안내를 같은 화면에서 확인하세요.", 11, MUTED, 400, 342)


def purchase_top(s, review=False):
    s.text(24, 116, "← 제품으로 돌아가기", 11, MUTED, 500, 342)
    s.eyebrow(149, "TRANSPARENCY. / SHOP")
    s.heading(177, "주문 내용을 확인하세요." if review else "나의 루틴을 선택하세요.", 25)
    s.text(24, 220, "선택한 상품과 배송 정보를 마지막으로 살펴보세요." if review else "토너부터 크림까지. 필요한 제품을 필요한 만큼.", 11, MUTED, 400, 342)
    s.rect(24, 254, 342, 43, LIGHT, LINE, 12)
    for index, label in enumerate(("01 제품·배송 정보", "02 주문 내용 확인")):
        s.text(30 + index * 166, 269, label, 11, INK if review == bool(index) else MUTED, 700 if review == bool(index) else 400, 164, "center")


def purchase_scenes():
    s = add("M23", "purchase-selection", "구매 · 제품 선택과 수량", "구매", "구매 페이지 첫 단계. 하나의 제품을 선택하고 수량 1~99개를 정합니다. 실제 결제는 없습니다.", 1)
    purchase_top(s)
    s.eyebrow(321, "01 / THE FORMULA")
    s.heading(345, "나의 루틴 선택", 22)
    for idx, key in enumerate(("toner", "serum", "cream")):
        p = PRODUCTS[key]
        x = 24 + idx * 118
        selected = idx == 1
        s.rect(x, 391, 106, 171, LIGHT if selected else WHITE, INK if selected else LINE, 12, 1.5 if selected else 1)
        s.placeholder(x + 8, 400, 90, 79, "")
        s.ellipse(x + 77, 407, 14, 14, WHITE, INK if selected else LINE)
        if selected:
            s.ellipse(x + 81, 411, 6, 6, INK, INK, 0)
        s.text(x + 8, 491, p["name"], 13, INK, 700, 90, "center")
        s.text(x + 8, 518, p["volume"], 10, MUTED, 400, 90, "center")
        s.text(x + 8, 540, p["price"], 11, INK, 600, 90, "center")
    s.text(24, 586, "수량", 12, INK, 700, 120)
    s.rect(211, 576, 155, 43, WHITE, LINE, 12)
    s.text(216, 586, "−", 18, INK, 500, 42, "center")
    s.line(258, 576, 258, 619)
    s.text(258, 590, "1", 13, INK, 600, 59, "center")
    s.line(317, 576, 317, 619)
    s.text(321, 586, "+", 18, INK, 500, 40, "center")
    s.text(24, 638, "1~99개까지 선택할 수 있습니다.", 11, MUTED, 400, 342)
    s.text(24, 670, "성분·사용법 확인 ↗", 12, INK, 500, 342)
    s.line(24, 707, 366, 707)
    s.text(24, 724, "다음: 배송 정보", 12, INK, 700, 342)

    s = add("M24", "purchase-shipping", "구매 · 배송 정보 입력", "구매", "배송 정보 영역으로 스크롤. 모바일 1열 입력이며 상세 주소 아래에 배송 요청사항·입력 보관 안내가 이어집니다.", 1)
    s.text(24, 117, "← 제품으로 돌아가기", 11, MUTED, 500, 342)
    s.eyebrow(150, "02 / DELIVERY")
    s.heading(174, "배송 정보", 26)
    s.field(225, "받는 분 *", placeholder="이름")
    s.field(310, "연락처 *", placeholder="010-0000-0000")
    s.field(395, "우편번호 *", placeholder="5자리")
    s.field(480, "이메일", placeholder="선택 입력")
    s.field(565, "기본 주소 *", placeholder="도로명 또는 지번 주소")
    s.field(650, "상세 주소", placeholder="동·호수 등 (선택)")

    s = add("M25", "purchase-shipping-validation", "구매 · 배송 입력 검증", "구매", "주문 내용 확인 시 필수 입력 오류. 모바일 1열 필드 순서를 유지하며 나머지 입력과 확인 버튼은 아래에 이어집니다.", 1)
    s.text(24, 117, "← 제품으로 돌아가기", 11, MUTED, 500, 342)
    s.eyebrow(149, "02 / DELIVERY")
    s.heading(173, "배송 정보", 26)
    s.field(223, "받는 분 *", placeholder="이름", error="! 받는 분의 이름을 1~50자로 입력해 주세요.")
    s.field(327, "연락처 *", value="010", error="! 연락 가능한 전화번호를 확인해 주세요.")
    s.field(431, "우편번호 *", value="12", error="! 5자리 우편번호를 입력해 주세요.")
    s.field(535, "이메일", placeholder="선택 입력")
    s.field(620, "기본 주소 *", value="서울", error="! 기본 주소를 5~200자로 입력해 주세요.")

    s = add("M26", "purchase-order-review", "구매 · 주문 내용 확인", "구매", "크림 C.1 2개 선택, 상품 52,000원·배송 0원. 검토 화면이며 결제와 주문 접수는 제공되지 않습니다.", 1)
    purchase_top(s, True)
    s.rect(24, 318, 342, 116, WHITE, LINE, 14)
    s.placeholder(37, 331, 84, 88, "")
    s.text(139, 334, "주문 상품", 10, MUTED, 600, 210)
    s.text(139, 358, "크림 C.1", 19, INK, 700, 210)
    s.text(139, 390, "50 mL · 26,000원 × 2개", 12, MUTED, 400, 210)
    s.row(447, "상품 금액", "52,000원", 35)
    s.row(485, "배송비", "0원", 35)
    s.text(24, 538, "총 주문 금액", 14, INK, 700, 170)
    s.text(212, 535, "52,000원", 21, INK, 700, 154, "right")
    s.text(24, 580, "배송 정보", 13, INK, 700, 210)
    s.text(260, 580, "수정하기 ↗", 11, MUTED, 500, 106, "right")
    s.text(24, 606, "김하늘 · 010-0000-0000", 12, INK, 400, 342)
    s.text(24, 628, "12345  서울시 테스트로 123, 101호", 11, MUTED, 400, 342)
    s.para(24, 660, "현재 결제와 주문 접수는 제공되지 않으며,\n입력한 정보는 전송되지 않습니다.", 342, 11, 18)
    s.button(706, "결제 서비스 연결 전", height=36, disabled=True)


def number(value):
    return str(int(value)) if float(value).is_integer() else str(value)


def svg_node(node: dict) -> str:
    attrs = lambda values: " ".join(f'{key}="{escape(str(value), quote=True)}"' for key, value in values.items())
    kind = node["type"]
    if kind == "text":
        align = node.get("align", "left")
        x = node["x"] + (node["width"] / 2 if align == "center" else node["width"] if align == "right" else 0)
        properties = {"x": number(x), "y": number(node["y"]), "fill": node["fill"], "font-size": node["fontSize"], "font-weight": node["fontWeight"], "text-anchor": {"left": "start", "center": "middle", "right": "end"}[align], "dominant-baseline": "text-before-edge"}
        return f'<text {attrs(properties)}>{escape(node["text"])}</text>'
    properties = {"fill": node["fill"], "stroke": node["stroke"], "stroke-width": node["strokeWidth"]} if kind != "line" else {"stroke": node["stroke"], "stroke-width": node["strokeWidth"], "stroke-linecap": "round"}
    if kind == "rect":
        properties.update({key: number(node[key]) for key in ("x", "y", "width", "height")})
        properties["rx"] = node["radius"]
    elif kind == "ellipse":
        properties.update({"cx": number(node["x"] + node["width"] / 2), "cy": number(node["y"] + node["height"] / 2), "rx": number(node["width"] / 2), "ry": number(node["height"] / 2)})
    elif kind == "line":
        properties.update({key: number(node[key]) for key in ("x1", "y1", "x2", "y2")})
    return f'<{kind} {attrs(properties)}/>'


def svg_document(nodes: list[dict], width: int, height: int, title: str, description: str) -> str:
    return '\n'.join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="Noto Sans KR,Noto Sans CJK KR,Apple SD Gothic Neo,Malgun Gothic,sans-serif">',
        f'<title>{escape(title)}</title>', f'<desc>{escape(description)}</desc>',
        *(svg_node(node) for node in nodes), '</svg>', '',
    ])


def board() -> str:
    width = 2262
    height = 6010
    margin = 64
    col_gap = 46
    row_gap = 132
    first_top = 250
    chunks = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="Noto Sans KR,Noto Sans CJK KR,Apple SD Gothic Neo,Malgun Gothic,sans-serif">',
        '<title>Transparency. 모바일 와이어프레임 · 현재 구현 26개 화면</title>',
        '<desc>390 × 844 모바일 화면과 실제 서비스 상태를 나타내는 편집 가능한 벡터 보드. 화살표 연결은 별도 사용자 흐름도를 참조합니다.</desc>',
        f'<rect width="{width}" height="{height}" fill="#EEEEEE"/>',
    ]
    def bt(x, y, value, size=14, weight=400, color=INK):
        chunks.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(value)}</text>')
    bt(margin, 34, "Transparency.", 33, 700)
    bt(margin + 277, 45, "MOBILE WIREFRAMES", 15, 700, MUTED)
    bt(margin, 91, "현재 웹앱 기준 · 26개 화면 · 390 × 844 · 이미지 영역은 X 플레이스홀더 · 모든 요소는 벡터", 16, 400, MUTED)
    bt(margin, 120, "상단·하단 내비게이션 고정 / 중간 콘텐츠는 화면별 스크롤·입력·통신 상태를 표현합니다.", 14, 400, MUTED)
    row_titles = ["01  홈 · 제품 탐색 · 상세 진입", "02  제형 · 성분 · 근거 · 사용 안내 · 질문", "03  질문 응답 상태 · 사용자 리뷰", "04  내 제품 · 하나의 목록에서 기록 관리", "05  더보기 아코디언 · 구매 입력", "06  주문 내용 확인 · 실제 결제 없음"]
    for index, scene in enumerate(SCENES):
        col, row = index % 5, index // 5
        x = margin + col * (W + col_gap)
        y = first_top + row * (H + row_gap)
        if col == 0:
            bt(margin, y - 89, row_titles[row], 16, 700)
        bt(x, y - 57, f'{scene.meta["id"]}  {scene.meta["title"]}', 15, 700)
        note_lines = wrap(scene.meta["note"], W, 11)
        for line_idx, text_value in enumerate(note_lines[:2]):
            bt(x, y - 35 + line_idx * 15, text_value, 11, 400, MUTED)
        chunks.append(f'<g transform="translate({x},{y})">')
        chunks.extend(svg_node(node) for node in scene.nodes)
        chunks.append('</g>')
    chunks.append('</svg>\n')
    return '\n'.join(chunks)


def validate(data):
    assert len(data["screens"]) == 26
    assert [scene["id"] for scene in data["screens"]] == [f"M{index:02}" for index in range(1, 27)]
    for screen in data["screens"]:
        assert screen["note"] and screen["group"]
        for node in screen["nodes"]:
            for key in ("fill", "stroke"):
                if key in node:
                    assert len(node[key]) == 7 and node[key].startswith("#"), (screen["id"], key, node)
                    int(node[key][1:], 16)
            if node["type"] == "text":
                assert node["fontSize"] >= 10
                assert node["x"] >= 0 and node["x"] + node["width"] <= W + 0.1, (screen["id"], node)
                assert node["y"] >= 0 and node["y"] + node["fontSize"] * 1.5 <= H, (screen["id"], node)
                assert sum(glyph_width(c, node["fontSize"]) for c in node["text"]) <= node["width"] * 1.06, (screen["id"], "unwrapped text", node)
            elif node["type"] in ("rect", "ellipse"):
                assert 0 <= node["x"] <= W and 0 <= node["y"] <= H
                assert node["x"] + node["width"] <= W + 0.1
                assert node["y"] + node["height"] <= H + 0.1
    return True


def main():
    home_scenes()
    explore_scenes()
    information_scenes()
    question_scenes()
    reviews_scenes()
    my_scenes()
    more_scenes()
    purchase_scenes()
    data = {"version": 1, "width": W, "height": H, "fontFamily": FONT, "screens": [scene.export() for scene in SCENES]}
    validate(data)
    screens_dir = OUT / "screens"
    screens_dir.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        path = screens_dir / f'{scene.meta["id"]}.svg'
        path.write_text(svg_document(scene.nodes, W, H, f'{scene.meta["id"]} / {scene.meta["title"]}', scene.meta["note"]), encoding="utf-8")
    (OUT / "screens.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "wireframes-board.svg").write_text(board(), encoding="utf-8")
    print(f"Generated {len(SCENES)} mobile screens, screens.json and wireframes-board.svg")
    print(f"Editable vector primitives: {sum(len(scene.nodes) for scene in SCENES):,}")


if __name__ == "__main__":
    main()
