#!/usr/bin/env python3
"""Generate editable, vector-only diagrams from the current application flows."""

from __future__ import annotations

import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "public" / "design" / "mobile"
FONT = "Noto Sans CJK KR"


def node(identifier, label, kind="screen", group=None):
    return {"id": identifier, "label": label, "kind": kind, "group": group}


def edge(start, end, label="", dashed=False):
    return {"start": start, "end": end, "label": label, "dashed": dashed}


FLOWS = [
    {
        "id": "F01", "title": "전체 내비게이션", "slug": "navigation", "direction": "LR",
        "description": "홈·제품 탐색·내 제품·더보기와 외부 QR 상세 진입, 구매 화면의 연결을 보여줍니다.",
        "groups": {"main": "하단 주요 메뉴", "detail": "제품 상세와 구매"},
        "nodes": [
            node("start", "사이트 접속", "start"),
            node("guest", "회원가입 없이 이용\n로그인 절차 없음", "note"),
            node("header", "모든 화면의 공통 헤더\n테마 전환: 라이트 ↔ 다크\n테마를 바꿔도 현재 화면 유지", "note"),
            node("M01", "M01 · 홈 첫 화면\n브랜드와 제품 살펴보기", group="main"),
            node("M02", "M02 · 홈 제품 영역\nSTEP 01 토너 → 02 세럼 → 03 크림", group="main"),
            node("M03", "M03 · 제품 탐색\n제품명·성분 검색 / 종류 필터", group="main"),
            node("my", "M16 / M17 / M18 / M19\n내 제품 · 한 목록에서 상태 관리", group="main"),
            node("M21", "M21 · 더보기\n브랜드·공개 원칙·이용 안내", group="main"),
            node("M22", "M22 · 개인정보·기록 관리\n아코디언 열기", group="main"),
            node("qr", "외부 카메라로 QR 스캔\n또는 제품 상세 링크 접속", "start"),
            node("M05", "M05 · 제품 상세\n제품 정보·가격·구매·등록", group="detail"),
            node("tabs", "M07 / M08 / M09 / M10 / M14\n성분·근거·사용 안내·질문·리뷰", group="detail"),
            node("M23", "M23 / M24 · 구매 화면\n상품·수량·배송 정보", group="detail"),
            node("M26", "M26 · 주문 내용 확인\n선택 내용 확인·수정", group="detail"),
            node("stop", "현재 여기까지\n실제 결제·주문 접수 없음", "stop", "detail"),
        ],
        "edges": [
            edge("start", "M01"), edge("start", "guest", dashed=True),
            edge("M01", "header", "항상 접근 가능", dashed=True),
            edge("header", "my", "MY PRODUCTS 바로가기"),
            edge("M01", "M02", "스크롤"), edge("M01", "M03", "제품 살펴보기"),
            edge("M02", "M03", "모든 제품 보기"), edge("M02", "M05", "제품 선택"),
            edge("M03", "M05", "제품 선택"), edge("M01", "my", "하단 내 제품"),
            edge("M01", "M21", "하단 더보기"), edge("M21", "M22", "안내 항목 펼치기"),
            edge("qr", "M05", "제품별 바로가기"), edge("M05", "tabs", "정보 탭 선택"),
            edge("M05", "my", "내 제품에 추가"), edge("my", "M05", "제품 정보 보기"),
            edge("M05", "M23", "구매하기"), edge("M21", "M23", "푸터 제품 구매"),
            edge("M23", "M26", "배송 정보 확인"), edge("M26", "stop"),
            edge("M23", "M05", "제품으로 돌아가기", dashed=True),
        ],
    },
    {
        "id": "F02", "title": "제품 탐색과 상세 정보", "slug": "product-discovery", "direction": "TB",
        "description": "검색·필터·검색 결과 없음, 제형 이미지 전환과 제품 상세의 다섯 정보 탭 흐름입니다.",
        "groups": {"discovery": "검색과 제품 선택", "information": "같은 제품의 상세 정보"},
        "nodes": [
            node("home", "M01 / M02 · 홈\n제품 살펴보기 / 모든 제품 보기", "start"),
            node("M03", "M03 · 제품 목록\n토너 → 세럼 → 크림 순서", group="discovery"),
            node("query", "제품명·성분명 입력\n또는 제품 종류 필터 선택", "action", "discovery"),
            node("found", "일치하는\n제품이 있나요?", "decision", "discovery"),
            node("results", "필터링한 제품 표시\n사용 순서 유지", "action", "discovery"),
            node("M04", "M04 · 검색 결과 없음\n다른 검색어 / 검색·필터 초기화", group="discovery"),
            node("M06", "M06 · 제형 이미지 상태\n현재 영역에서 제품 ↔ 제형 전환", group="discovery"),
            node("textureNote", "제형 보기 버튼은 화면 이동이 아님\n모바일 터치로도 전환 가능", "note", "discovery"),
            node("M05", "M05 · 제품 상세 첫 영역\n가격·제형·성분 요약·QR", group="information"),
            node("tabs", "보고 싶은 정보 탭 선택", "action", "information"),
            node("M07", "M07 · 성분·함량\n성분의 역할과 표기 기준", group="information"),
            node("M08", "M08 · 효능·근거\n연구 자료와 완제품 시험 구분", group="information"),
            node("M09", "M09 · 사용 안내\n순서·양·보관·잔량·분리배출", group="information"),
            node("M10", "M10 · 질문하기\n제품 질문과 FAQ", group="information"),
            node("M14", "M14 · 사용자 리뷰\n해당 제품의 낮은 별점부터", group="information"),
        ],
        "edges": [
            edge("home", "M03"), edge("M03", "query"), edge("query", "found"),
            edge("found", "results", "예"), edge("found", "M04", "아니요"),
            edge("M04", "query", "검색어 수정", dashed=True), edge("M04", "M03", "초기화", dashed=True),
            edge("results", "M05", "제품 카드 선택"), edge("M03", "M05", "제품 카드 선택"),
            edge("M03", "M06", "카드의 제형 보기"), edge("M05", "M06", "상세의 제형 보기"),
            edge("M06", "M03", "원래 카드에서 제품 보기", dashed=True),
            edge("M06", "M05", "원래 상세에서 제품 보기", dashed=True),
            edge("M06", "textureNote", dashed=True), edge("M05", "tabs"),
            edge("tabs", "M07", "성분·함량"), edge("tabs", "M08", "효능·근거"),
            edge("tabs", "M09", "사용 안내"), edge("tabs", "M10", "질문하기"),
            edge("tabs", "M14", "사용자 리뷰"), edge("M05", "M03", "제품 목록으로", dashed=True),
        ],
    },
    {
        "id": "F03", "title": "리뷰 작성과 내 제품 관리", "slug": "reviews-and-my-products", "direction": "TB",
        "description": "제품별 리뷰 작성·오류·저장·집계와 내 제품의 미개봉·사용 중·완료·삭제를 실제 한 목록 구조로 나타냅니다.",
        "groups": {"reviews": "제품별 사용자 리뷰", "my": "내 제품 · 동일 목록 안의 상태"},
        "nodes": [
            node("M05", "M05 · 제품 상세", "start"),
            node("M14", "M14 · 리뷰 목록\n같은 제품 안에서 낮은 별점순", group="reviews"),
            node("write", "별점 1~5점 선택\n본문 10~1,000자 작성", "action", "reviews"),
            node("valid", "작성 조건을\n충족했나요?", "decision", "reviews"),
            node("M15", "M15 · 입력 오류\n별점·본문 안내 후 수정", group="reviews"),
            node("reviewSave", "현재 브라우저에 저장\n목록·전체 개수·평균 갱신", "action", "reviews"),
            node("reviewDelete", "직접 작성한 리뷰 삭제\n별도 확인창 없이 반영", "action", "reviews"),
            node("reviewNote", "준비된 글과 입력 리뷰를 함께 집계\n작성/예시 구분과 출처 안내 유지\n입력 리뷰는 다른 기기와 공유 안 됨", "note", "reviews"),
            node("registered", "이미 등록된\n제품인가요?", "decision", "my"),
            node("add", "미개봉 상태로 즉시 추가\n별도 등록 폼 없음", "action", "my"),
            node("list", "내 제품 한 목록\n기존 등록이면 상태 그대로 유지", "action", "my"),
            node("any", "등록된 제품이\n있나요?", "decision", "my"),
            node("M16", "M16 · 내 제품 비어 있음\n제품 등록하기 → 제품 탐색", group="my"),
            node("done", "선택한 제품이\n사용 완료인가요?", "decision", "my"),
            node("opened", "개봉일이\n입력되어 있나요?", "decision", "my"),
            node("M17", "M17 · 미개봉\n개봉일이 비어 있음", group="my"),
            node("M18", "M18 · 사용 중\n개봉일이 입력됨", group="my"),
            node("M19", "M19 · 사용 완료\n개봉일과 별개로 완료 상태", group="my"),
            node("date", "목록에서 개봉일 인라인 수정\n비우면 미개봉으로 판정", "action", "my"),
            node("complete", "사용 완료 선택\n완료 상태 저장", "action", "my"),
            node("resume", "사용 중으로 변경 선택\n개봉일에 따라 상태 재판정", "action", "my"),
            node("M20", "M20 · 등록 삭제 확인\n제품과 사용 기록을 삭제할까요?", "decision", "my"),
            node("remove", "등록 제품과 사용 기록 삭제\n남은 목록 다시 표시", "action", "my"),
            node("myNote", "상태별 별도 화면이나 상세 페이지 없음\nM17·M18·M19는 같은 목록의 행 상태\n제품·개봉일·상태는 브라우저에 저장", "note", "my"),
        ],
        "edges": [
            edge("M05", "M14", "사용자 리뷰"), edge("M14", "write", "리뷰 남기기"),
            edge("write", "valid"), edge("valid", "M15", "아니요"), edge("M15", "write", "수정", True),
            edge("valid", "reviewSave", "예"), edge("reviewSave", "M14", "재정렬·재집계", True),
            edge("M14", "reviewDelete", "작성 리뷰의 삭제"), edge("reviewDelete", "reviewSave"),
            edge("M14", "reviewNote", dashed=True),
            edge("M05", "registered", "내 제품에 추가"), edge("registered", "add", "아니요"),
            edge("registered", "list", "예"), edge("add", "list"), edge("list", "any"),
            edge("any", "M16", "아니요"), edge("any", "done", "예"),
            edge("done", "M19", "예"), edge("done", "opened", "아니요"),
            edge("opened", "M18", "예"), edge("opened", "M17", "아니요"),
            edge("list", "date", "개봉일 변경"), edge("date", "done", "저장 후 판정", True),
            edge("M17", "complete", "사용 완료"), edge("M18", "complete", "사용 완료"), edge("complete", "M19"),
            edge("M19", "resume", "사용 중으로 변경"), edge("resume", "opened", "완료 해제", True),
            edge("list", "M20", "등록 삭제"), edge("M20", "remove", "확인"),
            edge("M20", "list", "취소", True), edge("remove", "list", "목록 갱신", True),
            edge("list", "myNote", dashed=True),
        ],
    },
    {
        "id": "F04", "title": "AI 질문과 근거 확인", "slug": "questions-and-sources", "direction": "TB",
        "description": "질문 입력·검증·취소, Gemini 또는 제품 자료 답변, 오류 재시도와 근거 화면 이동을 구분합니다.",
        "groups": {"input": "제품 상세의 질문하기 탭", "answer": "답변과 연결 상태", "sources": "선택한 제품의 근거 위치"},
        "nodes": [
            node("M10", "M10 · 질문하기\nFAQ와 같은 탭에서 시작", "start", "input"),
            node("compose", "직접 질문 입력 또는 추천 질문\nEnter 전송 / Shift+Enter 줄바꿈", "action", "input"),
            node("valid", "1~500자로\n입력했나요?", "decision", "input"),
            node("inputError", "빈 질문·길이 안내\n질문 수정", "action", "input"),
            node("pending", "질문 전송 / 답변 준비 중\n입력과 추천 질문은 잠시 비활성", "action", "input"),
            node("cancel", "요청 취소\n질문을 초안으로 복원", "action", "input"),
            node("publicDocs", "해당 제품의 공개 자료 확인\n성분·사용법·시험 자료의 범위", "action", "answer"),
            node("connected", "자료 범위 안에서\nAI 답변이 가능한가요?", "decision", "answer"),
            node("M11", "M11 · Gemini 답변\n답변 문장과 근거 목록 표시", group="answer"),
            node("M12", "M12 · 제품 자료 답변\nAI 미연결·응답 실패·자료 밖 질문", group="answer"),
            node("M13", "M13 · 요청 오류\n네트워크·지연·요청 제한 안내", group="answer"),
            node("retry", "다시 시도\n기존 질문 재전송", "action", "answer"),
            node("next", "이어서 할 일 선택", "decision", "answer"),
            node("clear", "대화 지우기\n대화·진행 중 요청 초기화", "action", "input"),
            node("sourceChoice", "표시된 답변 근거 선택", "action", "sources"),
            node("M05", "M05 · 제품 정보\n상세 첫 영역으로 스크롤", group="sources"),
            node("M07", "M07 · 성분·함량\n같은 제품의 해당 탭", group="sources"),
            node("M08", "M08 · 효능·근거\n같은 제품의 해당 탭", group="sources"),
            node("M09", "M09 · 사용 안내\n같은 제품의 해당 탭", group="sources"),
            node("memory", "대화는 제품별로 화면에서만 유지\n새로고침하면 대화 초기화\n등록 자료 답변을 AI 답변과 구분", "note", "answer"),
        ],
        "edges": [
            edge("M10", "compose"), edge("compose", "valid", "전송"),
            edge("valid", "inputError", "아니요"), edge("inputError", "compose", "수정", True),
            edge("valid", "pending", "예"), edge("pending", "cancel", "요청 취소"),
            edge("cancel", "compose", "초안 복원", True), edge("pending", "publicDocs"),
            edge("publicDocs", "connected"), edge("connected", "M11", "예 / 정상 답변"),
            edge("connected", "M12", "아니요 / 자료로 안내"),
            edge("pending", "M13", "요청 자체 실패"), edge("M13", "retry", "다시 시도"),
            edge("retry", "pending", "같은 질문", True), edge("M11", "next"), edge("M12", "next"),
            edge("next", "compose", "추가 질문", True), edge("next", "clear", "대화 지우기"),
            edge("clear", "M10", "빈 대화", True), edge("next", "sourceChoice", "근거가 있으면 열기"),
            edge("sourceChoice", "M05", "제품 정보"), edge("sourceChoice", "M07", "성분·함량"),
            edge("sourceChoice", "M08", "효능·근거"), edge("sourceChoice", "M09", "사용 안내"),
            edge("publicDocs", "memory", dashed=True),
        ],
    },
    {
        "id": "F05", "title": "구매 내용 확인", "slug": "purchase", "direction": "TB",
        "description": "상품·수량·배송 정보, 배송비 계산, 입력 오류와 수정 후 주문 내용 확인까지의 구매 흐름입니다. 실제 결제는 포함하지 않습니다.",
        "groups": {"select": "상품과 금액", "delivery": "배송 정보 입력", "review": "주문 내용 확인"},
        "nodes": [
            node("M05", "M05 · 제품 상세\n또는 푸터 제품 구매", "start"),
            node("M23", "M23 · 상품·수량 선택\n토너 / 세럼 / 크림 · 수량 1~99개", group="select"),
            node("prices", "토너 18,000원 · 세럼 24,000원\n크림 26,000원\n상품 금액 = 단가 × 수량", "note", "select"),
            node("shipping", "상품 금액이\n50,000원 이상인가요?", "decision", "select"),
            node("free", "배송비 0원", "action", "select"),
            node("fee", "배송비 3,000원", "action", "select"),
            node("total", "주문 금액 표시\n상품 금액 + 배송비", "action", "select"),
            node("M24", "M24 · 배송 정보 입력\n상품 선택과 같은 구매 화면", group="delivery"),
            node("required", "받는 분·전화·5자리 우편번호·주소\n선택: 상세 주소·이메일·배송 요청", "note", "delivery"),
            node("check", "필수 값과 입력 형식이\n올바른가요?", "decision", "delivery"),
            node("M25", "M25 · 배송 입력 오류\n필드 안내 / 첫 오류 항목으로 이동", group="delivery"),
            node("M26", "M26 · 주문 내용 확인\n상품·수량·배송지·금액 확인", group="review"),
            node("edit", "수정하기\n입력한 배송 정보 유지", "action", "review"),
            node("stop", "여기서 종료 · 결제 버튼 비활성\n실제 결제·주문 접수는 연결 전", "stop", "review"),
            node("memory", "배송 정보는 화면 메모리에만 유지\n서버 전송·브라우저 저장 없음\n새로고침하면 입력 초기화", "note", "review"),
        ],
        "edges": [
            edge("M05", "M23", "구매하기"), edge("M23", "prices", dashed=True),
            edge("M23", "shipping", "상품·수량 변경 시 계산"), edge("shipping", "free", "예 / 50,000원 포함"),
            edge("shipping", "fee", "아니요"), edge("free", "total"), edge("fee", "total"),
            edge("total", "M24", "배송 정보로 이어짐"), edge("M24", "required", dashed=True),
            edge("M24", "check", "주문 내용 확인"), edge("check", "M25", "아니요"),
            edge("M25", "M24", "수정 후 다시 확인", True), edge("check", "M26", "예"),
            edge("M26", "edit", "수정하기"), edge("edit", "M24", "제품·수량도 같은 화면에서 수정", True),
            edge("M26", "stop"), edge("M24", "memory", dashed=True),
            edge("M23", "M05", "제품으로 돌아가기 / 성분·사용법", True),
        ],
    },
]


def quoted(value):
    return json.dumps(str(value), ensure_ascii=False)


def dot_node(value):
    attributes = {"label": value["label"]}
    if value["kind"] == "decision":
        attributes.update(shape="diamond", style="filled", fillcolor="#ffffff", width="3.15", height="1.10", fontsize="15")
    elif value["kind"] == "note":
        attributes.update(shape="note", style="filled,dashed", fillcolor="#ffffff", color="#a3a3a3", fontsize="14")
    elif value["kind"] in {"start", "stop"}:
        attributes.update(shape="oval", fillcolor="#ededed", penwidth="1.8")
        if value["kind"] == "stop":
            attributes.update(peripheries="2")
    elif value["kind"] == "action":
        attributes.update(fillcolor="#ffffff")
    return f'    {value["id"]} [' + ", ".join(f"{key}={quoted(item)}" for key, item in attributes.items()) + "];"


def dot_document(flow):
    lines = [
        f'digraph {flow["id"]} {{',
        '  graph [charset="UTF-8", bgcolor="#ffffff", fontname=' + quoted(FONT) + ', fontsize=24, fontcolor="#171717", labelloc=t, labeljust=l, pad="0.45", margin="0.20", ranksep="0.80", nodesep="0.55", splines=spline, compound=true, newrank=true, rankdir=' + flow["direction"] + ', label=' + quoted(f'{flow["id"]}  {flow["title"]}\nTransparency. · 현재 모바일 서비스 흐름') + '];',
        '  node [shape=box, style="rounded,filled", fillcolor="#f6f6f6", color="#6e6e6e", penwidth=1.3, fontname=' + quoted(FONT) + ', fontsize=16, fontcolor="#171717", margin="0.22,0.16", width="2.8", height="0.70"];',
        '  edge [fontname=' + quoted(FONT) + ', fontsize=14, fontcolor="#484848", color="#777777", penwidth=1.15, arrowsize=0.8];',
    ]
    for value in flow["nodes"]:
        if value["group"] is None:
            lines.append(dot_node(value))
    for group, title in flow["groups"].items():
        lines.extend([f'  subgraph cluster_{group} {{', f'    label={quoted(title)}; fontsize=17; color="#d0d0d0"; penwidth=1; style="rounded"; margin=24;'])
        lines.extend(dot_node(value) for value in flow["nodes"] if value["group"] == group)
        lines.append("  }")
    for value in flow["edges"]:
        attrs = []
        if value["label"]:
            attrs.append(f'label={quoted(value["label"])}')
        if value["dashed"]:
            attrs.append('style="dashed"')
        options = " [" + ", ".join(attrs) + "]" if attrs else ""
        lines.append(f'  {value["start"]} -> {value["end"]}{options};')
    lines.append("}")
    return "\n".join(lines) + "\n"


def mermaid_document(flow):
    direction = "LR" if flow["direction"] == "LR" else "TD"
    lines = [f'---\ntitle: "{flow["id"]} · {flow["title"]}"\n---', f"flowchart {direction}", "    %% 현재 구현을 기준으로 작성. 화면 ID는 모바일 와이어프레임과 대응합니다."]

    def render(value, indent="    "):
        label = quoted(value["label"].replace("\n", "<br/>"))
        if value["kind"] == "decision":
            item = f'{value["id"]}{{{label}}}'
        elif value["kind"] in {"start", "stop"}:
            item = f'{value["id"]}([{label}])'
        else:
            item = f'{value["id"]}[{label}]'
        return indent + item

    lines.extend(render(value) for value in flow["nodes"] if value["group"] is None)
    for group, title in flow["groups"].items():
        lines.append(f'    subgraph {group}[{quoted(title)}]')
        lines.extend(render(value, "        ") for value in flow["nodes"] if value["group"] == group)
        lines.append("    end")
    for value in flow["edges"]:
        connector = "-.->" if value["dashed"] else "-->"
        if value["label"]:
            lines.append(f'    {value["start"]} {connector}|{quoted(value["label"])}| {value["end"]}')
        else:
            lines.append(f'    {value["start"]} {connector} {value["end"]}')
    lines.extend([
        "    classDef screen fill:#f6f6f6,stroke:#6e6e6e,color:#171717,stroke-width:1.3px,font-size:16px;",
        "    classDef action fill:#ffffff,stroke:#6e6e6e,color:#171717,font-size:16px;",
        "    classDef decision fill:#ffffff,stroke:#6e6e6e,color:#171717,font-size:15px;",
        "    classDef note fill:#ffffff,stroke:#a3a3a3,color:#484848,stroke-dasharray:4 3,font-size:14px;",
        "    classDef terminal fill:#ededed,stroke:#6e6e6e,color:#171717,stroke-width:1.8px,font-size:16px;",
    ])
    for kind in ["screen", "action", "decision", "note", "start", "stop"]:
        identifiers = [value["id"] for value in flow["nodes"] if value["kind"] == kind]
        if identifiers:
            lines.append(f'    class {",".join(identifiers)} {"terminal" if kind in {"start", "stop"} else kind};')
    return "\n".join(lines) + "\n"


def validate(flow, svg):
    identifiers = {value["id"] for value in flow["nodes"]}
    if len(identifiers) != len(flow["nodes"]):
        raise ValueError(f'Duplicate node in {flow["id"]}')
    for value in flow["edges"]:
        if value["start"] not in identifiers or value["end"] not in identifiers:
            raise ValueError(f'Unknown edge in {flow["id"]}: {value}')
    root = ET.fromstring(svg)
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError("Invalid SVG root")
    if any(element.tag.endswith("}image") for element in root.iter()):
        raise ValueError("Flowchart must be vector-only")
    for text in root.iter("{http://www.w3.org/2000/svg}text"):
        if float(text.get("font-size", "16")) < 14:
            raise ValueError("Flowchart type is too small")
    return root.get("viewBox")


def main():
    output = DESTINATION / "flows"
    output.mkdir(parents=True, exist_ok=True)
    index = []
    references = set()
    for flow in FLOWS:
        stem = f'{flow["id"]}-{flow["slug"]}'
        dot = dot_document(flow)
        mermaid = mermaid_document(flow)
        dot_path = output / f"{stem}.dot"
        svg_path = output / f"{stem}.svg"
        dot_path.write_text(dot, encoding="utf-8")
        (output / f"{stem}.mmd").write_text(mermaid, encoding="utf-8")
        rendered = subprocess.run(["dot", "-Tsvg", str(dot_path)], check=True, capture_output=True, text=True)
        svg = re.sub(r'<!DOCTYPE[^>]*(?:\[[\s\S]*?\]\s*)?>', '', rendered.stdout)
        viewbox = validate(flow, svg)
        svg_path.write_text(svg, encoding="utf-8")
        references.update(re.findall(r"\bM\d{2}\b", dot))
        index.append({key: flow[key] for key in ["id", "title", "slug", "description"]} | {"svg": f"flows/{stem}.svg", "mermaid": f"flows/{stem}.mmd"})
        print(f'{flow["id"]}: {len(flow["nodes"])} nodes / {len(flow["edges"])} edges / viewBox {viewbox}')
    required = {f"M{number:02}" for number in range(1, 27)}
    if references != required:
        raise ValueError(f"Screen reference mismatch: missing={required - references}, extra={references - required}")
    (DESTINATION / "flow-index.json").write_text(json.dumps({"flows": index}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Validated five vector SVG diagrams, editable Mermaid/DOT, and all M01–M26 references.")


if __name__ == "__main__":
    main()
