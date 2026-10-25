import type { DemoProject } from "@/lib/demoStore";

export type ProjectCoatStage = "top" | "middle" | "bottom" | "other";

export interface ProjectCoatingStage {
  stage: ProjectCoatStage;
  scope: string | null;
  specification: string;
  paint_code: string | null;
  color: string | null;
  finish: string | null;
  thickness_text?: string | null;
}

export interface ProjectThickness {
  scope: string | null;
  minimum_um: number | null;
  maximum_um: number | null;
  nominal_um: number | null;
  tolerance_um: number | null;
  original_text: string;
}

export interface ProjectMaster extends DemoProject {
  source_row: number;
  aliases: string[];
  maker: string | null;
  maker_source: string;
  coating_stages: ProjectCoatingStage[];
  thickness: ProjectThickness[];
  thickness_text: string;
  notes: string[];
  source_text: string;
  verification_status: "pending_verification";
}

function coat(
  stage: ProjectCoatStage,
  specification: string,
  options: Partial<Omit<ProjectCoatingStage, "stage" | "specification">> = {},
): ProjectCoatingStage {
  return {
    stage,
    scope: options.scope ?? null,
    specification,
    paint_code: options.paint_code ?? null,
    color: options.color ?? null,
    finish: options.finish ?? null,
    thickness_text: options.thickness_text ?? null,
  };
}

function thickness(
  original_text: string,
  options: Partial<Omit<ProjectThickness, "original_text">> = {
    scope: null,
    minimum_um: null,
    maximum_um: null,
    nominal_um: null,
    tolerance_um: null,
  },
): ProjectThickness {
  return {
    scope: options.scope ?? null,
    minimum_um: options.minimum_um ?? null,
    maximum_um: options.maximum_um ?? null,
    nominal_um: options.nominal_um ?? null,
    tolerance_um: options.tolerance_um ?? null,
    original_text,
  };
}

function project(
  source_row: number,
  name: string,
  maker_source: string,
  coating_stages: ProjectCoatingStage[],
  thickness_text: string,
  notes: string[] = [],
  thicknesses: ProjectThickness[] = [],
): ProjectMaster {
  return {
    id: `source-row-${String(source_row).padStart(2, "0")}`,
    source_row,
    name,
    aliases: [],
    maker: maker_source === "-" ? null : maker_source,
    maker_source,
    coating_stages,
    thickness: thicknesses.length ? thicknesses : [thickness(thickness_text)],
    thickness_text,
    notes,
    source_text: [
      `${source_row}. ${name} (Maker: ${maker_source})`,
      ...coating_stages.map((entry) => [
        `${entry.stage}${entry.scope ? ` [${entry.scope}]` : ""}: ${entry.specification}`,
        entry.paint_code ? `Paint code: ${entry.paint_code}` : "",
        entry.color ? `Color: ${entry.color}` : "",
        entry.finish ? `Finish: ${entry.finish}` : "",
        entry.thickness_text ? `Coat thickness: ${entry.thickness_text}` : "",
      ].filter(Boolean).join(" · ")),
      `Thickness: ${thickness_text || "(Blank)"}`,
      ...notes.map((note) => `Note: ${note}`),
    ].join("\n"),
    is_active: true,
    created_at: new Date().toISOString(),
    verification_status: "pending_verification",
  };
}

export const INITIAL_PROJECT_MASTER: ProjectMaster[] = [
  project(1, "크레일 24장 / 검은선 16장", "KCC", [
    coat("top", "UT2578(H)-NS.8(RT) 광택도: 80~%", { paint_code: "UT2578(H)-NS.8(RT)" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "155㎛ (±25)", [], [thickness("155㎛ (±25)", { scope: null, minimum_um: 130, maximum_um: 180, nominal_um: 155, tolerance_um: 25 })]),
  project(2, "서율 4호선 260장", "FPG", [
    coat("top", "UT-721 A/U TOP N1.5 광택도: (유광)", { paint_code: "UT-721 A/U TOP N1.5", finish: "유광" }),
    coat("other", "SKY BLUE(2.5PB 5/6) - CM BOX 제외", { scope: "건조기 박스내부", color: "SKY BLUE(2.5PB 5/6)" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "120㎛ (±40)", [], [thickness("120㎛ (±40)", { scope: null, minimum_um: 80, maximum_um: 160, nominal_um: 120, tolerance_um: 40 })]),
  project(3, "[위험 250 공정안전확보]", "KCC", [
    coat("top", "UTS119-A-PANTONE 428(RT) 광택도: 80%이상 (GREY)", { paint_code: "UTS119-A-RAL7005(RT)", color: "GREY" }),
    coat("bottom", "남연 EP1119-A-1105 / UU2119(RT)-L/GREY"),
  ], "160㎛ (±80)", ["손글씨: 위험 250 공정안전확보"], [thickness("160㎛ (±80)", { scope: null, minimum_um: 80, maximum_um: 240, nominal_um: 160, tolerance_um: 80 })]),
  project(4, "금정홀드 54장", "KCC", [
    coat("top", "UTS119(S)-A RAL000 150 00(RT)", { paint_code: "UTS119(S)-A RAL000 150 00(RT)" }),
    coat("other", "남연 SKY BLUE(2.5PB 5/6, 광택도 40~60)", { scope: "박스내부", color: "SKY BLUE(2.5PB 5/6)", finish: "광택도 40~60" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "80㎛ ~ 240㎛", [], [thickness("80㎛ ~ 240㎛", { scope: null, minimum_um: 80, maximum_um: 240, nominal_um: null, tolerance_um: null })]),
  project(5, "부산 1호선 200장 / 부산 1호선 72장", "FPG", [
    coat("top", "UT-721 A/U TOP N5.0 회색", { paint_code: "UT-721 A/U TOP N5.0", color: "회색" }),
    coat("bottom", "YP261(GRAY)", { paint_code: "YP261(GRAY)", color: "GRAY" }),
  ], "120㎛ ~ 240㎛ [손글씨: *60 ~ 160*]", ["손글씨 두께 메모: 60 ~ 160"], [thickness("120㎛ ~ 240㎛", { scope: null, minimum_um: 120, maximum_um: 240, nominal_um: null, tolerance_um: null }), thickness("60 ~ 160 (손글씨)", { scope: null, minimum_um: 60, maximum_um: 160, nominal_um: null, tolerance_um: null })]),
  project(6, "한자니아 80장", "KCC", [
    coat("top", "UTS119-A-RAL7021(RT)", { paint_code: "UTS119-A-RAL7021(RT)" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], ""),
  project(7, "크레일 448장 / 진기종차", "KCC", [
    coat("top", "UT2578(H)-N5.8(RT) 광택도: 80~", { paint_code: "UT2578(H)-N5.8(RT)" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "155㎛ (±25)", ["손글씨: 색상추가"], [thickness("155㎛ (±25)", { scope: null, minimum_um: 130, maximum_um: 180, nominal_um: 155, tolerance_um: 25 })]),
  project(8, "서율 4호선 210장", "KCC", [
    coat("top", "UT2578-N1.5 광택도: 85%이상", { paint_code: "UT2578-N1.5", finish: "광택도 85%이상" }),
    coat("other", "SKY BLUE(2.5PB 5/6, 광택도 35~65)", { scope: "박스내부", color: "SKY BLUE(2.5PB 5/6)", finish: "광택도 35~65" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "외장: 145㎛ (±15) / 대차: 120㎛ (±40)", [], [
    thickness("외장: 145㎛ (±15)", { scope: "외장", minimum_um: 130, maximum_um: 160, nominal_um: 145, tolerance_um: 15 }),
    thickness("대차: 120㎛ (±40)", { scope: "대차", minimum_um: 80, maximum_um: 160, nominal_um: 120, tolerance_um: 40 }),
  ]),
  project(9, "빨내선 54장", "FPG", [
    coat("top", "UT-721 A/U TOP N6.0", { paint_code: "UT-721 A/U TOP N6.0" }),
    coat("bottom", "YP261(GRAY)", { paint_code: "YP261(GRAY)", color: "GRAY" }),
  ], "120㎛ (±40)", [], [thickness("120㎛ (±40)", { scope: null, minimum_um: 80, maximum_um: 160, nominal_um: 120, tolerance_um: 40 })]),
  project(10, "서울 5.8호선 298장", "KCC", [
    coat("top", "UT2578(S)-N6.0 광택도: 반광", { paint_code: "광택도: 반광", finish: "반광" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "130㎛ ~ 180㎛", [], [thickness("130㎛ ~ 180㎛", { scope: null, minimum_um: 130, maximum_um: 180, nominal_um: null, tolerance_um: null })]),
  project(11, "코레일 490장 / 1호선 330장 (일산선 80장)", "FPG", [
    coat("top", "UT721-A/U TOP N5.8 광택도: 유광", { paint_code: "UT721-A/U TOP N5.8 광택도: 반광", finish: "유광 (원문 Color 항목에는 반광으로 기재)" }),
    coat("bottom", "YP261(GRAY)", { paint_code: "YP261(GRAY)", color: "GRAY" }),
  ], "120㎛ (±40)", ["상도 광택 표기 불일치: Top에는 유광, Color 항목에는 반광. 확인 필요."], [thickness("120㎛ (±40)", { scope: null, minimum_um: 80, maximum_um: 160, nominal_um: 120, tolerance_um: 40 })]),
  project(12, "광주 50장", "KCC", [
    coat("top", "UTS119(S)-A-SLC022(RT) 광택도: 반광", { paint_code: "UTS119(S)-A-SLC022(RT) 광택도: 반광", finish: "반광" }),
    coat("bottom", "EP1119-A-1105"),
  ], ""),
  project(13, "취로기에 듀폰로 40장 / 마츠로메이", "조광", [
    coat("top", "A/U 500 RAL 9005 #NF", { paint_code: "A/U 500 RAL 9005 #NF", color: "A/U 500 RAL 9005 #NF (70㎛ 이상)", thickness_text: "70㎛ 이상" }),
    coat("bottom", "에폭시 프라이머 - YP 261", { paint_code: "에폭시 프라이머 - YP 261", color: "에폭시 프라이머 - YP 261 (230㎛ 이상)", thickness_text: "230㎛ 이상" }),
  ], "1. 대차 300㎛ 이상 / 2. 외장 150㎛ ~ 170㎛", [], [
    thickness("1. 대차 300㎛ 이상", { scope: "대차", minimum_um: 300, maximum_um: null, nominal_um: null, tolerance_um: null }),
    thickness("2. 외장 150㎛ ~ 170㎛", { scope: "외장", minimum_um: 150, maximum_um: 170, nominal_um: null, tolerance_um: null }),
  ]),
  project(14, "EMU250 114장", "PGG", [
    coat("top", "UTS119-A-PANTONE 428(RT) 광택도: 80%이상 (GREY)", { paint_code: "UT721 RAL 7005 광택도 80%이상" }),
    coat("bottom", "남연 EP1119-A-1105", { paint_code: "YP261 (2액형 에폭시)" }),
  ], ""),
  project(15, "원강선", "-", [
    coat("top", "UT2578"),
    coat("middle", "UU271-YELLOW", { paint_code: "UU271-YELLOW", color: "YELLOW" }),
    coat("bottom", "EP1119-1105"),
  ], ""),
  project(16, "연천교통공사 / 김포공사", "-", [
    coat("top", "UT-721 A/U TOP N1.5 (G-50)", { paint_code: "UT-721 A/U TOP N1.5 (G-50)" }),
    coat("bottom", "YP261", { paint_code: "YP261" }),
  ], ""),
  project(17, "온양선", "KCC", [
    coat("top", "UT2578(S)-N6.0", { paint_code: "UT2578(S)-N6.0" }),
    coat("bottom", "YP261", { paint_code: "YP261" }),
  ], ""),
  project(18, "EMU320 (CM)", "KCC", [
    coat("top", "UTS119-A-PANTONE 428C(RT)", { paint_code: "UTS119-A-RAL7005(RT)" }),
    coat("middle", "UU2119(RT)-A-GREY", { paint_code: "UU2119(RT)-A-GREY", color: "GREY" }),
    coat("bottom", "EP1119-A-1105", { paint_code: "EP1119-A-1105" }),
  ], "외장: 170㎛~250㎛ / 대차: 80㎛~240㎛", [], [
    thickness("외장: 170㎛~250㎛", { scope: "외장", minimum_um: 170, maximum_um: 250, nominal_um: null, tolerance_um: null }),
    thickness("대차: 80㎛~240㎛", { scope: "대차", minimum_um: 80, maximum_um: 240, nominal_um: null, tolerance_um: null }),
  ]),
  project(19, "터키 에너크로", "-", [
    coat("top", "UT2578(H)(S)-N1.5(RT)", { paint_code: "UT2578(H)(S)-N1.5(RT)" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "300㎛ 이상", [], [thickness("300㎛ 이상", { scope: null, minimum_um: 300, maximum_um: null, nominal_um: null, tolerance_um: null })]),
  project(20, "서울 5.8호선 보수품", "KCC", [
    coat("top", "UT2578(S)-N6.0", { paint_code: "UT2578(S)-N6.0" }),
    coat("bottom", "EP1119-A-1105"),
  ], "", ["손글씨: 서울 5.8호선 보수품"]),
  project(21, "양산선", "KCC", [
    coat("top", "UT-721 A/U TOP N5.0", { paint_code: "UT-721 A/U TOP N5.0" }),
    coat("other", "UT-721 A/U TOP SKY BLUE 2.5PB 5/6(RT)", { scope: "박스내부", color: "SKY BLUE 2.5PB 5/6" }),
    coat("bottom", "EP1119A-1105"),
  ], ""),
  project(22, "충청선", "KCC", [
    coat("top", "UT2578(H)-N5.8(RT)", { paint_code: "UT2578(H)-N5.8(RT)" }),
    coat("bottom", "EP1119-A-1105", { paint_code: "EP1119-A-1105" }),
  ], "130㎛ ~ 180㎛", [], [thickness("130㎛ ~ 180㎛", { scope: null, minimum_um: 130, maximum_um: 180, nominal_um: null, tolerance_um: null })]),
  project(23, "압바터", "KCC", [
    coat("top", "UT2578(S)-N6.0", { paint_code: "UT2578-A/U 500RAL 7042 G30 # RT(반광)", finish: "반광" }),
    coat("bottom", "YP261", { paint_code: "HANA 500 HOHLDING PRIMER GRAY # RT", color: "GRAY" }),
  ], "80㎛ ~ 150㎛", [], [thickness("80㎛ ~ 150㎛", { scope: null, minimum_um: 80, maximum_um: 150, nominal_um: null, tolerance_um: null })]),
  project(24, "메인트란스", "KCC", [
    coat("top", "UT2578(H)-N5.8(RT)", { paint_code: "UT2578(H)-N5.8(RT)" }),
    coat("bottom", "EP170-A-1005(RT)", { paint_code: "EP170-A-1005(RT)" }),
  ], ""),
  project(25, "크레일 순현에비품", "KCC", [
    coat("top", "UT2578(H)-N5.8(RT)", { paint_code: "UT2578(H)-N5.8(RT)" }),
    coat("bottom", "EP1119-A-1105"),
  ], ""),
  project(26, "수소연료차량", "PPG", [
    coat("top", "UT721-A/U TOP N6.0(GRAY) 광택도: 반광", { paint_code: "UT721-A/U TOP N6.0(GRAY)", color: "GRAY", finish: "반광" }),
    coat("bottom", "YP261(GRAY)", { paint_code: "YP261(GRAY)", color: "GRAY" }),
  ], "120㎛ (±40)", [], [thickness("120㎛ (±40)", { scope: null, minimum_um: 80, maximum_um: 160, nominal_um: 120, tolerance_um: 40 })]),
  project(27, "피츠버그 (연진교통공사, 고리갈상차 도로)", "PPG", [
    coat("top", "UT-721 A/U TOP N1.5(G-50)", { scope: "외부", paint_code: "UT-721 A/U TOP N1.5(G-50)" }),
    coat("middle", "UT-721N A/U TOP N5.8(G-50)", { scope: "내부", paint_code: "UT-721N A/U TOP N5.8(G-50)" }),
    coat("bottom", "DP-40LF FRIMER GRAY", { paint_code: "DP-40LF FRIMER GRAY", color: "GRAY" }),
  ], "120㎛ (±40)", [], [thickness("120㎛ (±40)", { scope: null, minimum_um: 80, maximum_um: 160, nominal_um: 120, tolerance_um: 40 })]),
  project(28, "산악열차용", "KCC", [
    coat("top", "UTS119(S)-A RAL000 150 00(RT)", { paint_code: "UTS119(S)-A RAL000 150 00(RT)" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], ""),
  project(29, "우즈백", "KCC", [
    coat("top", "UTS119-A-PANTONE 428(RT) 광택도: 80%이상 (GREY)", { paint_code: "UTS119-A-RAL7005(RT)", color: "GREY" }),
    coat("middle", "UU2119(RT)-A-GREY", { paint_code: "UU2119(RT)-A-GREY", color: "GREY" }),
    coat("bottom", "남연 EP1119-A-1105", { paint_code: "EP1119-A-1105" }),
  ], "80㎛ ~ 240㎛", [], [thickness("80㎛ ~ 240㎛", { scope: null, minimum_um: 80, maximum_um: 240, nominal_um: null, tolerance_um: null })]),
  project(30, "이집트 정식시험용", "KCC", [
    coat("top", "UTS119(S)-A-RAL 9005(RT)", { paint_code: "UTS119(S)-A-RAL 9005(RT)" }),
    coat("bottom", "남연 EP1119-A-1105", { paint_code: "EP1119-A-1105" }),
  ], "150㎛ (±30)", [], [thickness("150㎛ (±30)", { scope: null, minimum_um: 120, maximum_um: 180, nominal_um: 150, tolerance_um: 30 })]),
  project(31, "신안산선", "KCC", [
    coat("top", "UTS119-N1.5", { paint_code: "UTS119-N1.5 (Color: UTS119(S)-N.5.8)" }),
    coat("other", "SKYBLUE(2.5PB5/6)", { scope: "BOX내부", color: "SKYBLUE(2.5PB5/6)" }),
    coat("bottom", "EP1119-A-1105", { paint_code: "EP1119-A-1105 (Color: EP1119-A-1105)" }),
  ], "외장: 130㎛~190㎛ / 대차: 80㎛~160㎛", ["안산산 스카이블루 장 다름"], [
    thickness("외장: 130㎛~190㎛", { scope: "외장", minimum_um: 130, maximum_um: 190, nominal_um: null, tolerance_um: null }),
    thickness("대차: 80㎛~160㎛", { scope: "대차", minimum_um: 80, maximum_um: 160, nominal_um: null, tolerance_um: null }),
  ]),
  project(32, "광주", "KCC", [
    coat("top", "UTS119(S)-A-N.1.5", { paint_code: "UTS119(S)-A-N.1.5(반광)", finish: "반광" }),
    coat("other", "UTS119(S)-A-N.6.0", { scope: "BOX내부", paint_code: "UTS119(S)-A-N.6.0" }),
    coat("bottom", "남연 EP1119-A-1105", { paint_code: "남연 EP1119-A-1105" }),
  ], "120㎛ ~ 240㎛", ["최소 주문 7일이상"], [thickness("120㎛ ~ 240㎛", { scope: null, minimum_um: 120, maximum_um: 240, nominal_um: null, tolerance_um: null })]),
  project(33, "신평선", "-", [
    coat("top", "UT 2578(S)-I-N.6.0", { paint_code: "UT 2578(S)-I-N.6.0" }),
  ], ""),
  project(34, "인터콘시스템 (25.11월 납품건)", "-", [
    coat("top", "UT-721 A/U TOP N1.5 광택도: (유광)", { paint_code: "UT-721 A/U TOP N1.5 광택도: (유광)", finish: "유광" }),
    coat("bottom", "남연 EP1119-A-1105", { paint_code: "남연 EP1119-A-1105" }),
  ], "80㎛ ~ 160㎛", ["박건우사원 임시지정 추후 변동될수있음"], [thickness("80㎛ ~ 160㎛", { scope: null, minimum_um: 80, maximum_um: 160, nominal_um: null, tolerance_um: null })]),
  project(35, "IPX-정은", "-", [
    coat("top", "UT-721 A/U TOP N5.8(G-90 유광)", { paint_code: "UT-721 A/U TOP N5.8(G-90 유광)", finish: "유광" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], ""),
  project(36, "대전교통공사", "-", [
    coat("top", "UT-721 A/U TOP N1.5", { paint_code: "UT-721 A/U TOP N1.5" }),
    coat("other", "Gray(N7.0)", { scope: "내부", color: "Gray(N7.0)" }),
    coat("bottom", "남연 EP1119-A-1105", { paint_code: "남연 EP1119-A-1105" }),
  ], ""),
  project(37, "인도네시아", "-", [
    coat("top", "UT-721 A/U TOP N1.5 (G-50)", { paint_code: "UT-721 A/U TOP N1.5 (G-50)" }),
    coat("bottom", "YP261", { paint_code: "YP261" }),
  ], ""),
  project(38, "월드컵 54장", "-", [
    coat("top", "UTS119 - A - RAL 7043", { paint_code: "UTS119 - A - RAL 7043" }),
    coat("bottom", "EP1119 - A - 1105", { paint_code: "EP1119 - A - 1105" }),
  ], "80㎛ ~ 120㎛", [], [thickness("80㎛ ~ 120㎛", { scope: null, minimum_um: 80, maximum_um: 120, nominal_um: null, tolerance_um: null })]),
  project(39, "김포 10장", "-", [
    coat("top", "UT-721 A/U TOP N1.5 (G-50)", { paint_code: "UT-721 A/U TOP N1.5 (G-50)" }),
    coat("middle", "TOP 5.8(G-50), GRAY", { scope: "내부", color: "GRAY" }),
    coat("bottom", "YP261", { paint_code: "YP261" }),
  ], "대차: 80㎛~240㎛ / 외장: 80㎛~240㎛", [], [
    thickness("대차: 80㎛~240㎛", { scope: "대차", minimum_um: 80, maximum_um: 240, nominal_um: null, tolerance_um: null }),
    thickness("외장: 80㎛~240㎛", { scope: "외장", minimum_um: 80, maximum_um: 240, nominal_um: null, tolerance_um: null }),
  ]),
  project(40, "1,4호선", "-", [
    coat("top", "UT-721 A/U TOP N1.5(유광)", { paint_code: "UT-721 A/U TOP N1.5(유광)", finish: "유광" }),
    coat("other", "TOP SKY BLUE(N8.6 B5.6/4.5)", { scope: "내부", paint_code: "TOP SKY BLUE(N8.6 B5.6/4.5)", color: "SKY BLUE(N8.6 B5.6/4.5)" }),
    coat("bottom", "YP261", { paint_code: "YP261" }),
  ], "대차: 80㎛~160㎛ / 외장: 80㎛~160㎛", ["손글씨: UT-721 A/U TOP N5.8(반광)(G-50) (L3용)"], [
    thickness("대차: 80㎛~160㎛", { scope: "대차", minimum_um: 80, maximum_um: 160, nominal_um: null, tolerance_um: null }),
    thickness("외장: 80㎛~160㎛", { scope: "외장", minimum_um: 80, maximum_um: 160, nominal_um: null, tolerance_um: null }),
  ]),
  project(41, "8호선", "-", [
    coat("top", "UT-721 A/U TOP N6.0(반광)", { paint_code: "UT-721 A/U TOP N6.0(반광)", finish: "반광" }),
    coat("bottom", "YP261(GRAY)", { paint_code: "YP261(GRAY)", color: "GRAY" }),
  ], "대차: 80㎛~160㎛ / 외장: 80㎛~160㎛", [], [
    thickness("대차: 80㎛~160㎛", { scope: "대차", minimum_um: 80, maximum_um: 160, nominal_um: null, tolerance_um: null }),
    thickness("외장: 80㎛~160㎛", { scope: "외장", minimum_um: 80, maximum_um: 160, nominal_um: null, tolerance_um: null }),
  ]),
  project(42, "서울2호선", "-", [
    coat("top", "UT-721 A/U TOP N1.5 광택도: (유광)", { paint_code: "UT-721 A/U TOP N1.5 광택도: (유광)", finish: "유광" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "외장: 80㎛~160㎛", [], [thickness("외장: 80㎛~160㎛", { scope: "외장", minimum_um: 80, maximum_um: 160, nominal_um: null, tolerance_um: null })]),
  project(43, "네오드란트(9호선)", "-", [
    coat("top", "UT2578(H)-N5.8(RT)", { paint_code: "UT2578(H)-N5.8(RT)" }),
    coat("bottom", "EP1119-A-1105"),
  ], "외장: 80㎛~120㎛", [], [thickness("외장: 80㎛~120㎛", { scope: "외장", minimum_um: 80, maximum_um: 120, nominal_um: null, tolerance_um: null })]),
  project(44, "3MW급 수소진기기관차", "KCC", [
    coat("top", "UTS119 N.1.5 광택도: 80%이상", { paint_code: "UTS119 N.1.5", finish: "광택도 80%이상" }),
    coat("middle", "UU2119(RT) SURFACER", { paint_code: "UU2119(RT) SURFACER" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "120㎛ ~ 240㎛", [], [thickness("120㎛ ~ 240㎛", { scope: null, minimum_um: 120, maximum_um: 240, nominal_um: null, tolerance_um: null })]),
  project(45, "미널라", "KCC", [
    coat("top", "UT2578(S)-N6.0 광택도: 반광", { paint_code: "UT2578(S)-N6.0", finish: "반광" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "외장: 100㎛~140㎛", [], [thickness("외장: 100㎛~140㎛", { scope: "외장", minimum_um: 100, maximum_um: 140, nominal_um: null, tolerance_um: null })]),
  project(46, "에페드로", "KCC", [
    coat("top", "UT2578(S)-N6.0 광택도: 반광", { paint_code: "UT2578(S)-N6.0", finish: "반광" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "외장: 80㎛~240㎛", [], [thickness("외장: 80㎛~240㎛", { scope: "외장", minimum_um: 80, maximum_um: 240, nominal_um: null, tolerance_um: null })]),
  project(47, "GTX", "KCC", [
    coat("top", "UT2578(H)(S)-N1.5(RT)", { paint_code: "UT2578(H)(S)-N1.5(RT)", finish: "반광" }),
    coat("bottom", "남연 EP1119-A-1105"),
  ], "외장: 80㎛~240㎛", [
    "손글씨: 반광",
    "코레일 1호선 8량 차막이 A/U TOP N5.8(유광)",
  ], [thickness("외장: 80㎛~240㎛", { scope: "외장", minimum_um: 80, maximum_um: 240, nominal_um: null, tolerance_um: null })]),
];
