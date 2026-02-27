(function () {
  "use strict";

  const STORAGE_KEYS = {
    settings: "nikatsu_settings",
    bbt: "nikatsu_bbt",
    symptoms: "nikatsu_symptoms",
    ovulationTests: "nikatsu_ovulation",
    timing: "nikatsu_timing",
    discharge: "nikatsu_discharge",
    periods: "nikatsu_periods",
    ovulationMarked: "nikatsu_ovulation_marked",
    medications: "nikatsu_medications",
    visits: "nikatsu_visits",
    onboarding: "nikatsu_onboarding_done",
    aiSettings: "nikatsu_ai_settings",
    chatHistory: "nikatsu_chat_history",
  };

  const DEFAULT_AI_SETTINGS = {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  };

  const DEFAULT_SETTINGS = {
    cycleLength: 28,
    periodLength: 5,
    lutealPhaseDays: 14,
    lastPeriodStart: null,
  };

  const SYMPTOM_OPTIONS = ["腹痛", "頭痛", "むくみ", "気分", "吐き気", "腹痛_ちくちく", "腹痛_左", "腹痛_右", "腹痛_下腹部", "腹痛_重さ", "腹痛_ズキズキ"];
  const OVULATION_RESULTS = [
    { id: "negative", label: "陰性" },
    { id: "weak", label: "薄い陽性" },
    { id: "positive", label: "強陽性" },
  ];
  const DISCHARGE_AMOUNT = ["少ない", "普通", "多い"];
  const DISCHARGE_STATE = ["伸びる", "サラサラ", "ドロッと", "のびおり", "茶おり"];
  const MED_PRESET = ["レトロゾール", "フェマーラ", "メトホルミン", "クロミッド"];

  let settings = { ...DEFAULT_SETTINGS };
  let bbtRecords = [];
  let symptomsRecords = [];
  let ovulationTests = [];
  let timingRecords = [];
  let dischargeRecords = [];
  let periodRecords = [];
  let ovulationMarkedDates = [];
  let medicationRecords = [];
  let visitRecords = [];
  let visitPendingPhoto = null;
  let calendarCurrent = new Date();
  let periodCalendarCurrent = new Date();
  let aiSettings = { ...DEFAULT_AI_SETTINGS };
  let chatHistory = [];

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      if (raw) {
        const parsed = JSON.parse(raw);
        settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch (_) {}
  }

  function loadBBT() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.bbt);
      bbtRecords = raw ? JSON.parse(raw) : [];
      bbtRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (_) {
      bbtRecords = [];
    }
  }

  function saveBBT() {
    try {
      localStorage.setItem(STORAGE_KEYS.bbt, JSON.stringify(bbtRecords));
    } catch (_) {}
  }

  function loadRecords() {
    try {
      symptomsRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.symptoms) || "[]");
      ovulationTests = JSON.parse(localStorage.getItem(STORAGE_KEYS.ovulationTests) || "[]");
      timingRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.timing) || "[]");
      dischargeRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.discharge) || "[]");
    } catch (_) {
      symptomsRecords = [];
      ovulationTests = [];
      timingRecords = [];
      dischargeRecords = [];
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEYS.symptoms, JSON.stringify(symptomsRecords));
      localStorage.setItem(STORAGE_KEYS.ovulationTests, JSON.stringify(ovulationTests));
      localStorage.setItem(STORAGE_KEYS.timing, JSON.stringify(timingRecords));
      localStorage.setItem(STORAGE_KEYS.discharge, JSON.stringify(dischargeRecords));
    } catch (_) {}
  }

  function getRecordsForDate(dateStr) {
    return {
      bbt: bbtRecords.some((r) => r.date === dateStr),
      symptoms: symptomsRecords.find((r) => r.date === dateStr),
      ovulation: ovulationTests.find((r) => r.date === dateStr),
      timing: timingRecords.some((r) => r.date === dateStr),
      discharge: dischargeRecords.find((r) => r.date === dateStr),
    };
  }

  function loadPeriods() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.periods);
      periodRecords = raw ? JSON.parse(raw) : [];
      periodRecords.sort((a, b) => b.start.localeCompare(a.start));
    } catch (_) {
      periodRecords = [];
    }
  }

  function savePeriods() {
    try {
      localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify(periodRecords));
    } catch (_) {}
  }

  function loadOvulationMarked() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ovulationMarked);
      ovulationMarkedDates = raw ? JSON.parse(raw) : [];
    } catch (_) {
      ovulationMarkedDates = [];
    }
  }

  function saveOvulationMarked() {
    try {
      localStorage.setItem(STORAGE_KEYS.ovulationMarked, JSON.stringify(ovulationMarkedDates));
    } catch (_) {}
  }

  function isOvulationMarked(dateStr) {
    return ovulationMarkedDates.indexOf(dateStr) >= 0;
  }

  function loadMedications() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.medications);
      medicationRecords = raw ? JSON.parse(raw) : [];
    } catch (_) {
      medicationRecords = [];
    }
  }

  function saveMedications() {
    try {
      localStorage.setItem(STORAGE_KEYS.medications, JSON.stringify(medicationRecords));
    } catch (_) {}
  }

  function loadVisits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.visits);
      visitRecords = raw ? JSON.parse(raw) : [];
      visitRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } catch (_) {
      visitRecords = [];
    }
  }

  function saveVisits() {
    try {
      localStorage.setItem(STORAGE_KEYS.visits, JSON.stringify(visitRecords));
    } catch (_) {}
  }

  function monthHasRecorded(y, m) {
    const ymd = function (d) {
      const s = formatDate(d);
      return s.substring(0, 7) === (y + "-" + String(m + 1).padStart(2, "0"));
    };
    for (let i = 0; i < periodRecords.length; i++) {
      const p = periodRecords[i];
      const start = parseDate(p.start);
      const end = parseDate(p.end || p.start);
      if (!start) continue;
      if (start.getFullYear() === y && start.getMonth() === m) return true;
      if (end.getFullYear() === y && end.getMonth() === m) return true;
    }
    for (let i = 0; i < ovulationMarkedDates.length; i++) {
      const d = parseDate(ovulationMarkedDates[i]);
      if (d && d.getFullYear() === y && d.getMonth() === m) return true;
    }
    return false;
  }

  function toggleOvulationMarked(dateStr) {
    const i = ovulationMarkedDates.indexOf(dateStr);
    if (i >= 0) ovulationMarkedDates.splice(i, 1);
    else ovulationMarkedDates.push(dateStr);
    ovulationMarkedDates.sort();
    saveOvulationMarked();
  }

  function getEffectiveLastPeriodStart(today) {
    const todayStr = formatDate(today || new Date());
    let best = null;
    for (const p of periodRecords) {
      if (p.start <= todayStr && (!best || p.start > best)) best = p.start;
    }
    if (best) return best;
    if (settings.lastPeriodStart) return settings.lastPeriodStart;
    if (periodRecords.length) return periodRecords[0].start;
    return null;
  }

  function roundBBT(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return null;
    const r = Math.round(n * 100) / 100;
    return r >= 35 && r <= 40 ? r : null;
  }

  function loadAISettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.aiSettings);
      if (raw) aiSettings = { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
    } catch (_) {}
  }

  function saveAISettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.aiSettings, JSON.stringify(aiSettings));
    } catch (_) {}
  }

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.chatHistory);
      chatHistory = raw ? JSON.parse(raw) : [];
    } catch (_) {
      chatHistory = [];
    }
  }

  function saveChatHistory() {
    try {
      localStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(chatHistory));
    } catch (_) {}
  }

  const AI_SYSTEM_PROMPT =
    "あなたは妊活をしている人をサポートするアシスタントです。医療行為や診断は行わず、一般的な励ましや生活のヒント、心の支えとなる短いメッセージを日本語で返してください。体調不良や不安がある場合は、医療機関の受診を勧めてください。";

  async function callOpenAI(messages) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + aiSettings.apiKey.trim(),
      },
      body: JSON.stringify({
        model: aiSettings.model.trim() || "gpt-4o-mini",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 800,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || res.statusText || "APIエラー");
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("応答が空です");
    return text;
  }

  async function callGemini(messages) {
    const systemMsg = messages.find((m) => m.role === "system");
    const systemContent = systemMsg?.content || AI_SYSTEM_PROMPT;
    const rest = messages.filter((m) => m.role !== "system");

    const contents = [];
    if (systemContent) {
      contents.push({
        role: "user",
        parts: [{ text: systemContent }],
      });
    }
    rest.forEach((m) => {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    });

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
    };
    const modelId = "gemini-1.5-flash"; // ユーザー入力に関わらず固定
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/" +
        modelId +
        ":generateContent?key=" +
        encodeURIComponent(aiSettings.apiKey.trim()),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || res.statusText || "APIエラー");
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error("応答が空です");
    return text;
  }

  async function callAI(messages) {
    if (!aiSettings.apiKey || !aiSettings.apiKey.trim()) {
      throw new Error("設定でAPIキーを入力してください。");
    }
    if (aiSettings.provider === "gemini") return callGemini(messages);
    return callOpenAI(messages);
  }

  function buildTodayContext() {
    const today = new Date();
    const dateStr = formatDate(today);
    const phase = getCyclePhase(today);
    const rec = getRecordsForDate(dateStr);
    let cycleDayText = "";
    let phaseText = "周期の情報が未設定です。";
    if (phase) {
      const cycleDay = getCycleDay(today, phase);
      cycleDayText = "今日は生理から" + cycleDay + "日目。";
      const dayType = getDayType(today, phase);
      phaseText =
        "周期上の状態: " +
        ({ period: "生理期間", fertile: "妊娠しやすい時期", ovulation: "排卵予定日付近" }[dayType] || "通常期") +
        "。次回生理予定: " +
        formatDate(phase.nextPeriodStart) +
        "。";
    }
    const bbtToday = bbtRecords.find((r) => r.date === dateStr);
    const bbtVal = bbtToday != null ? (typeof bbtToday.value === "number" ? bbtToday.value.toFixed(2) : bbtToday.value) : "";
    const bbtText = bbtToday ? "今日の基礎体温: " + bbtVal + "℃。" : "今日の基礎体温: 未記録。";
    const symText = rec.symptoms?.symptoms?.length
      ? "体調: " + rec.symptoms.symptoms.join("、") + "。"
      : "体調: 特になし。";
    const ovText = rec.ovulation
      ? "排卵検査薬: " + (OVULATION_RESULTS.find((o) => o.id === rec.ovulation.result)?.label || rec.ovulation.result) + "。"
      : "排卵検査薬: 未記録。";
    const timingText = rec.timing ? "タイミング: 記録あり。" : "タイミング: 未記録。";
    const visitsText = visitRecords.length
      ? "通院記録（直近）: " + formatVisitsForAI().replace(/\n/g, " | ") + "。"
      : "通院記録: なし。";
    return (
      "【今日 " +
      dateStr +
      "】\n" +
      cycleDayText +
      "\n" +
      phaseText +
      "\n" +
      bbtText +
      "\n" +
      symText +
      "\n" +
      ovText +
      "\n" +
      timingText +
      "\n" +
      visitsText +
      "\n\n上記をもとに、1〜2文で簡潔に励ましやアドバイスを。医療助言はせず、心の支えとなる短いメッセージにしてください。"
    );
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function addDays(d, n) {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
  }

  function getCyclePhase(today) {
    const startStr = getEffectiveLastPeriodStart(today);
    const start = parseDate(startStr);
    if (!start) return null;

    const cycleLen = settings.cycleLength || 28;
    const periodLen = Math.min(settings.periodLength || 5, cycleLen - 1);
    const luteal = settings.lutealPhaseDays ?? 14;
    const ovulationOffset = cycleLen - luteal;

    let currentStart = new Date(start);
    currentStart.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    while (addDays(currentStart, cycleLen) <= today) {
      currentStart = addDays(currentStart, cycleLen);
    }

    const periodEnd = addDays(currentStart, periodLen - 1);
    const ovulationDay = addDays(currentStart, ovulationOffset - 1);
    const fertileStart = addDays(ovulationDay, -5);
    const fertileEnd = addDays(ovulationDay, 1);

    const nextPeriodStart = addDays(currentStart, cycleLen);

    return {
      periodStart: currentStart,
      periodEnd,
      fertileStart,
      fertileEnd,
      ovulationDay,
      nextPeriodStart,
      cycleLength: cycleLen,
      periodLength: periodLen,
    };
  }

  function createCalDot(kind) {
    const dot = document.createElement("span");
    dot.className = "cal-dot " + kind;
    return dot;
  }

  function getBBTDisplay(dateStr) {
    const rec = bbtRecords.find((r) => r.date === dateStr);
    if (!rec || rec.value == null) return null;
    const value = typeof rec.value === "number" ? rec.value.toFixed(2) : String(rec.value);
    const nextOv = ovulationMarkedDates.find((ov) => ov >= dateStr);
    const isAfterOv = !nextOv || dateStr >= nextOv;
    return { value: value, colorClass: isAfterOv ? "cal-day-bbt-after" : "cal-day-bbt-before" };
  }

  function appendBBTToCell(inner, dateStr) {
    const bbt = getBBTDisplay(dateStr);
    if (bbt) {
      const span = document.createElement("span");
      span.className = "cal-day-bbt " + bbt.colorClass;
      span.textContent = bbt.value;
      inner.appendChild(span);
    }
  }

  function appendCycleDayToCell(inner, dateObj) {
    if (!dateObj) return;
    const date = new Date(dateObj);
    if (isNaN(date.getTime())) return;
    const phaseForDate = getCyclePhase(new Date(date));
    if (!phaseForDate) return;
    const cycleDay = getCycleDay(date, phaseForDate);
    if (typeof cycleDay !== "number" || cycleDay < 1) return;
    const dateStr = formatDate(date);
    const hasTiming = timingRecords.some((r) => r.date === dateStr);

    const row = document.createElement("div");
    row.className = "cal-day-cycle-row";

    const spanCycle = document.createElement("span");
    spanCycle.className = "cal-day-cycle";
    spanCycle.textContent = "d" + cycleDay;
    row.appendChild(spanCycle);

    if (hasTiming) {
      const spanHeart = document.createElement("span");
      spanHeart.className = "cal-day-cycle-heart";
      spanHeart.textContent = "♥";
      row.appendChild(spanHeart);
    }

    inner.appendChild(row);
  }

  function getCycleDay(today, phase) {
    const t = new Date(today);
    const s = new Date(phase.periodStart);
    t.setHours(0, 0, 0, 0);
    s.setHours(0, 0, 0, 0);
    return Math.floor((t - s) / 86400000) + 1;
  }

  function getActualOvulationDate(phase) {
    const periodStartStr = formatDate(phase.periodStart);
    const nextStr = formatDate(phase.nextPeriodStart);
    for (const d of ovulationMarkedDates) {
      if (d >= periodStartStr && d < nextStr) return parseDate(d);
    }
    return null;
  }

  function getDayType(d, phase, actualOvulationDate) {
    if (!phase) return null;
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    const start = phase.periodStart.getTime();
    const end = phase.periodEnd.getTime();
    const ovDate = actualOvulationDate || phase.ovulationDay;
    const ov = ovDate.getTime();
    const fertileStart = ov - 5 * 86400000;
    const fertileEnd = ov + 1 * 86400000;
    const tt = t.getTime();

    if (tt >= start && tt <= end) return "period";
    if (tt === ov) return "ovulation";
    if (tt >= fertileStart && tt <= fertileEnd) return "fertile";
    return null;
  }

  function formatMonthDay(date) {
    const d = new Date(date);
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  function buildHormoneTableHTML(cycleDay) {
    const rows = [
      { phase: "月経期（1～5日目）", e2: "低い", p4: "低い", lh: "低い", dayFrom: 1, dayTo: 5 },
      { phase: "卵胞期前半（6～9日目）", e2: "上昇", p4: "低い", lh: "低い", dayFrom: 6, dayTo: 9 },
      { phase: "卵胞期後半（10～13日目）", e2: "ピーク前・上昇", p4: "低い", lh: "上昇", dayFrom: 10, dayTo: 13 },
      { phase: "排卵期（14日目前後）", e2: "ピーク後・一度下降", p4: "上昇し始め", lh: "サージ・ピーク", dayFrom: 14, dayTo: 14 },
      { phase: "黄体期前半（15～21日目）", e2: "やや上昇のち横ばい", p4: "上昇・ピーク", lh: "低い", dayFrom: 15, dayTo: 21 },
      { phase: "黄体期後半（22～28日目）", e2: "下降", p4: "ピーク後・下降", lh: "低い", dayFrom: 22, dayTo: 99 },
    ];
    let html = "<table class=\"hormone-ref-table\" aria-label=\"ホルモンの目安\"><thead><tr><th class=\"col-phase\">時期の目安</th><th class=\"col-e2\">エストロゲン</th><th class=\"col-p4\">プロゲステロン</th><th class=\"col-lh\">LHサージ</th></tr></thead><tbody>";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const isCurrent = typeof cycleDay === "number" && cycleDay >= r.dayFrom && cycleDay <= r.dayTo;
      const trClass = isCurrent ? " class=\"is-current\"" : "";
      html += "<tr" + trClass + "><td>" + r.phase + "</td><td>" + r.e2 + "</td><td>" + r.p4 + "</td><td>" + r.lh + "</td></tr>";
    }
    html += "</tbody></table>";
    return html;
  }

  function buildDayAxisHTML(phase, today) {
    const cycleLen = phase.cycleLength;
    const todayStr = formatDate(today);
    const arr = [];
    for (let d = 1; d <= cycleLen; d++) {
      const cycleDate = addDays(phase.periodStart, d - 1);
      const dateStr = formatDate(cycleDate);
      const isToday = dateStr === todayStr;
      arr.push("<span class=\"day-num" + (isToday ? " is-today" : "") + "\" title=\"" + dateStr + "\">" + formatMonthDay(cycleDate) + "</span>");
    }
    return "<div class=\"today-day-axis-inner\">" + arr.join("") + "</div>";
  }

  function buildHormoneGraphSVG(phase, cycleDay, follicular) {
    const cycleLen = phase.cycleLength;
    const periodLen = phase.periodLength || 5;
    const w = 320;
    const h = 200;
    const pad = { top: 36, right: 14, bottom: 28, left: 14 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const nowX = pad.left + (Math.min(cycleLen, Math.max(1, cycleDay)) - 0.5) / cycleLen * chartW;

    function x(day) {
      return pad.left + (day / cycleLen) * chartW;
    }
    function yNorm(v, min, max) {
      return pad.top + (1 - (v - min) / (max - min)) * chartH;
    }

    const e2Points = [], p4Points = [], lhPoints = [];
    const e2Min = 0, e2Max = 250, p4Min = 0, p4Max = 18, lhMin = 0, lhMax = 100;
    for (let d = 0; d <= cycleLen; d++) {
      let e2 = d <= follicular ? 30 + (d / follicular) * 180 : 60 + 80 * Math.exp(-(d - follicular) / 5) + 30 * Math.sin((d - follicular) * 0.2);
      if (e2 > e2Max) e2 = e2Max;
      e2Points.push(x(d) + "," + yNorm(e2, e2Min, e2Max));
      let p4 = d <= follicular ? 0 : 2 + 14 * (1 - Math.exp(-(d - follicular) / 3));
      if (d > cycleLen - 3) p4 *= 0.4;
      p4Points.push(x(d) + "," + yNorm(p4, p4Min, p4Max));
      const lh = d < follicular - 1 ? 5 : d <= follicular + 1 ? 5 + 90 * Math.exp(-Math.pow(d - follicular, 2) / 0.8) : 5;
      lhPoints.push(x(d) + "," + yNorm(lh, lhMin, lhMax));
    }

    let xPurple1 = pad.left;
    const xPurple2 = pad.left + (Math.min(periodLen + 4, follicular - 1) / cycleLen) * chartW;
    let xYellow1 = pad.left + (Math.max(follicular + 3, periodLen + 5) / cycleLen) * chartW;
    let xYellow2 = pad.left + (Math.min(cycleLen - 2, follicular + 12) / cycleLen) * chartW;
    if (xYellow1 >= xYellow2) xYellow1 = xYellow2 - 1;

    const svg =
      "<svg class=\"hormone-graph-svg\" viewBox=\"0 0 " + w + " " + h + "\" preserveAspectRatio=\"xMidYMid meet\">" +
      "<rect x=\"" + xPurple1 + "\" y=\"" + pad.top + "\" width=\"" + (xPurple2 - xPurple1) + "\" height=\"" + chartH + "\" fill=\"rgba(201,176,220,0.25)\"/>" +
      "<rect x=\"" + xYellow1 + "\" y=\"" + pad.top + "\" width=\"" + (xYellow2 - xYellow1) + "\" height=\"" + chartH + "\" fill=\"rgba(240,230,168,0.35)\"/>" +
      "<polyline fill=\"none\" stroke=\"#5a9ba8\" stroke-width=\"1.5\" points=\"" + e2Points.join(" ") + "\"/>" +
      "<polyline fill=\"none\" stroke=\"#d87890\" stroke-width=\"1.5\" points=\"" + p4Points.join(" ") + "\"/>" +
      "<polyline fill=\"none\" stroke=\"#6b9b5a\" stroke-width=\"1.5\" points=\"" + lhPoints.join(" ") + "\"/>" +
      "<line x1=\"" + nowX + "\" y1=\"" + pad.top + "\" x2=\"" + nowX + "\" y2=\"" + (h - pad.bottom) + "\" stroke=\"#2c2c2c\" stroke-width=\"1.5\" stroke-dasharray=\"4,2\"/>" +
      "</svg>";
    return svg;
  }

  function renderDashboard() {
    const today = new Date();
    const phase = getCyclePhase(today);

    const cycleDayEl = document.getElementById("today-cycle-day");
    const statusEl = document.getElementById("today-status");
    const nextEl = document.getElementById("next-period");
    const aiAdviceEl = document.getElementById("today-ai-advice");
    const aiBtnEl = document.getElementById("today-ai-btn");
    if (cycleDayEl) cycleDayEl.textContent = "";
    if (aiAdviceEl) aiAdviceEl.textContent = "";
    if (aiAdviceEl) aiAdviceEl.classList.remove("loading");
    if (aiBtnEl) aiBtnEl.style.display = "inline-block";

    if (!phase) {
      const hormoneTableEl = document.getElementById("today-hormone-table-wrap");
      if (hormoneTableEl) hormoneTableEl.innerHTML = "";
      const phaseBarEl = document.getElementById("today-phase-bar");
      if (phaseBarEl) phaseBarEl.innerHTML = "";
      statusEl.textContent = "カレンダーで日付をタップして生理日を記録するか、設定で直近の生理開始日を入力すると、今日の状態を表示できます。";
      nextEl.textContent = "";
      return;
    }

    const cycleDay = getCycleDay(today, phase);
    const luteal = settings.lutealPhaseDays ?? 14;
    const follicular = phase.cycleLength - luteal;
    const actualOv = getActualOvulationDate(phase);
    const ovulationDate = actualOv || phase.ovulationDay;
    let daysAfterOvulation = 0;
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    const o = new Date(ovulationDate);
    o.setHours(0, 0, 0, 0);
    if (t.getTime() >= o.getTime()) daysAfterOvulation = Math.floor((t.getTime() - o.getTime()) / 86400000);

    let countdownText = "";
    const todayMid = new Date(today);
    todayMid.setHours(0, 0, 0, 0);
    const nextMid = new Date(phase.nextPeriodStart);
    nextMid.setHours(0, 0, 0, 0);
    const ovMid = new Date(ovulationDate);
    ovMid.setHours(0, 0, 0, 0);
    if (todayMid.getTime() >= ovMid.getTime()) {
      const diff = Math.max(0, Math.round((nextMid.getTime() - todayMid.getTime()) / 86400000));
      countdownText = "次回生理予定まであと" + diff + "日！";
    } else {
      const diff = Math.max(0, Math.round((ovMid.getTime() - todayMid.getTime()) / 86400000));
      countdownText = "排卵まであと" + diff + "日！";
    }

    if (cycleDayEl) {
      let line1 = daysAfterOvulation >= 1
        ? "生理から" + cycleDay + "日目、排卵後" + daysAfterOvulation + "日目"
        : "生理から" + cycleDay + "日目、排卵前";
      cycleDayEl.innerHTML = "<span class=\"today-banner-line1\">" + line1 + "</span><span class=\"today-banner-line2\">" + countdownText + "</span>";
    }

    const periodLen = phase.periodLength || 5;
    const ovulationDay = follicular;
    const menstrualDays = periodLen;
    const follicularDays = Math.max(0, ovulationDay - periodLen - 2);
    const ovulatoryDays = 3;
    const cycleLen = phase.cycleLength;
    const lutealDaysCount = Math.max(0, cycleLen - ovulationDay - 1);
    const totalDays = menstrualDays + follicularDays + ovulatoryDays + lutealDaysCount;

    let phaseName = "黄体期";
    let dayInPhase = 1;
    let daysInPhase = lutealDaysCount;
    if (cycleDay <= periodLen) {
      phaseName = "月経期";
      dayInPhase = cycleDay;
      daysInPhase = menstrualDays;
    } else if (cycleDay < ovulationDay - 1) {
      phaseName = "卵胞期";
      dayInPhase = cycleDay - periodLen;
      daysInPhase = follicularDays;
    } else if (cycleDay <= ovulationDay + 1) {
      phaseName = "排卵期";
      dayInPhase = cycleDay - (ovulationDay - 1);
      daysInPhase = ovulatoryDays;
    } else {
      phaseName = "黄体期";
      dayInPhase = cycleDay - (ovulationDay + 2) + 1;
      daysInPhase = lutealDaysCount;
    }

    const phaseBarEl = document.getElementById("today-phase-bar");
    if (phaseBarEl) {
      const segs = [
        { name: "月経期", className: "phase-menstrual", days: menstrualDays },
        { name: "卵胞期", className: "phase-follicular", days: follicularDays },
        { name: "排卵期", className: "phase-ovulatory", days: ovulatoryDays },
        { name: "黄体期", className: "phase-luteal", days: lutealDaysCount },
      ];
      const sumDays = totalDays;
      phaseBarEl.innerHTML = segs.map(function (p) {
        const isCurrent = p.name === phaseName;
        const pct = sumDays > 0 ? (100 * p.days / sumDays) : 25;
        const w = "width:" + Math.max(0, pct).toFixed(1) + "%;";
        let inner = p.name;
        if (isCurrent && p.days > 0) {
          const posPct = daysInPhase > 0 ? ((dayInPhase - 0.5) / daysInPhase * 100) : 50;
          inner = p.name + "<span class=\"today-phase-marker\" style=\"left:" + posPct.toFixed(1) + "%\"></span>";
        }
        return "<span class=\"today-phase-seg " + p.className + (isCurrent ? " is-current" : "") + "\" style=\"" + w + "\">" + inner + "</span>";
      }).join("");
    }

    const dayType = getDayType(today, phase, actualOv);
    const blocks = getStatusBlocks(cycleDay, dayType, phase, daysAfterOvulation);
    statusEl.innerHTML =
      "<div class=\"today-status-block\"><h4>現在の状況</h4><p>" + (blocks.situation.join("<br/>") || "—") + "</p></div>" +
      "<div class=\"today-status-block\"><h4>プロゲステロン増加の影響</h4><p>" + (blocks.progesterone.join("<br/>") || "—") + "</p></div>" +
      "<div class=\"today-status-block\"><h4>エストロゲン低下の影響</h4><p>" + (blocks.estrogen.join("<br/>") || "—") + "</p></div>";

    const hormoneTableEl = document.getElementById("today-hormone-table-wrap");
    if (hormoneTableEl) hormoneTableEl.innerHTML = buildHormoneTableHTML(cycleDay);

    nextEl.textContent = "次回生理予定: " + formatDate(phase.nextPeriodStart);
  }

  function getStatusBlocks(cycleDay, dayType, phase, daysAfterOvulationArg) {
    const lutealDays = settings.lutealPhaseDays ?? 14;
    const follicularDays = phase.cycleLength - lutealDays;
    const periodLen = phase.periodLength || 5;
    const daysAfterOvulation = typeof daysAfterOvulationArg === "number" ? daysAfterOvulationArg : Math.max(0, cycleDay - follicularDays);

    const situation = [];
    if (dayType === "period") {
      situation.push("生理期間の目安です。");
    } else if (dayType === "fertile" || dayType === "ovulation") {
      situation.push("妊娠しやすい時期の目安です。");
    } else if (daysAfterOvulation >= 1) {
      if (daysAfterOvulation <= 2) situation.push("排卵直後。受精のチャンスはまだ続いています。");
      else if (daysAfterOvulation <= 5) {
        situation.push("受精していれば、受精卵が卵管を移動中");
        situation.push("まだ着床はしていない時期（多くは排卵後6～10日目）");
      } else if (daysAfterOvulation <= 10) situation.push("まだ着床はしていない時期（多くは排卵後6～10日目）");
      else situation.push("着床している場合は、体が妊娠を維持する準備をしています。");
    } else {
      if (cycleDay <= periodLen + 2) situation.push("卵胞期の始まり。心身のリズムを整えやすい時期です。");
      else if (cycleDay < follicularDays - 2) situation.push("卵胞期。エストロゲンが増え、心も体も調子が上がりやすいです。");
      else situation.push("排卵が近づいています。体調の変化に目を向けてみてください。");
    }

    const progesterone = [];
    if (daysAfterOvulation >= 1) {
      if (daysAfterOvulation <= 2) progesterone.push("黄体ホルモンが上昇し始め、基礎体温が高くなります。");
      else if (daysAfterOvulation <= 8) progesterone.push("眠気、だるさ、胸の張り、下腹部の重さ、便秘");
      else if (daysAfterOvulation <= lutealDays - 2) progesterone.push("黄体ホルモン分泌のピーク付近。胸の張りやイライラが出ることがあります。");
      else progesterone.push("生理が近づくと黄体ホルモンが減り、体温が下がり始めます。");
    } else {
      progesterone.push("黄体ホルモンは排卵後に増えます。");
    }

    const estrogen = [];
    if (daysAfterOvulation >= 1) {
      estrogen.push("排卵後はエストロゲンが一度下がり、気分の落ち込みやおりものの減少（粘り気アップ）が出ることがあります。");
    } else {
      if (cycleDay <= periodLen) estrogen.push("生理中はエストロゲンが低めです。");
      else estrogen.push("卵胞期はエストロゲンが増え、肌や心の調子が良くなりやすいです。");
    }

    return { situation: situation, progesterone: progesterone, estrogen: estrogen };
  }

  function getStatusText(cycleDay, dayType, phase) {
    if (dayType === "period") return "生理期間の目安です。";
    if (dayType === "fertile") return "妊娠しやすい時期の目安です。";
    if (dayType === "ovulation") return "排卵予定日付近の目安です。";
    const lutealDays = settings.lutealPhaseDays ?? 14;
    const follicularDays = phase.cycleLength - lutealDays;
    const periodLen = phase.periodLength || 5;
    if (cycleDay <= follicularDays) {
      const afterPeriod = cycleDay - periodLen;
      if (afterPeriod <= 3) return "卵胞期前半。心身のリズムを整えやすい時期です。";
      if (cycleDay < follicularDays - 2) return "卵胞期。エストロゲンが増え、心も体も調子が上がりやすいです。";
      return "排卵が近づいています。体調の変化に目を向けてみてください。";
    }
    const highDay = cycleDay - follicularDays;
    if (highDay <= 2) return "高温期に入ったばかり。黄体ホルモンの影響で体温が上がっています。";
    if (highDay <= 6) return "黄体ホルモン分泌のピーク。眠気やだるさが出やすいです。";
    if (highDay <= lutealDays - 2) return "高温期後半。生理が近づくと、胸の張りやイライラが出ることがあります。";
    return "生理直前の目安です。無理せず過ごしてください。";
  }

  function isDateInPeriod(dateStr) {
    return periodRecords.some((p) => {
      const end = p.end || p.start;
      return dateStr >= p.start && dateStr <= end;
    });
  }

  function showCalPopover(cell, dateStr) {
    const pop = document.getElementById("cal-popover");
    if (!pop) return;
    hideCalPopover();
    pop.dataset.date = dateStr;
    const rect = cell.getBoundingClientRect();
    const card = cell.closest ? cell.closest(".calendar-card") : null;
    const cardRect = card ? card.getBoundingClientRect() : rect;
    pop.style.left = (rect.left - cardRect.left + rect.width / 2) + "px";
    pop.style.top = (rect.bottom - cardRect.top + 4) + "px";
    pop.style.transform = "translate(-50%, 0)";
    pop.classList.add("is-open");
    setTimeout(function () {
      document.addEventListener("click", closePopoverOnClick);
    }, 0);
  }

  function closePopoverOnClick(e) {
    const pop = document.getElementById("cal-popover");
    if (!pop || !pop.classList.contains("is-open")) return;
    if (pop.contains(e.target)) return;
    const cell = e.target.closest && e.target.closest(".cal-day-clickable");
    if (cell) return;
    hideCalPopover();
    document.removeEventListener("click", closePopoverOnClick);
  }

  function hideCalPopover() {
    const pop = document.getElementById("cal-popover");
    if (pop) pop.classList.remove("is-open");
    document.removeEventListener("click", closePopoverOnClick);
  }

  function togglePeriodDate(dateStr) {
    const endOf = (p) => p.end || p.start;
    const inPeriod = periodRecords.find((p) => dateStr >= p.start && dateStr <= endOf(p));
    if (inPeriod) {
      const end = endOf(inPeriod);
      if (inPeriod.start === dateStr && end === dateStr) {
        periodRecords = periodRecords.filter((p) => p !== inPeriod);
      } else if (inPeriod.start === dateStr) {
        const next = formatDate(addDays(parseDate(dateStr), 1));
        inPeriod.start = next;
        if (next > end) periodRecords = periodRecords.filter((p) => p !== inPeriod);
      } else if (end === dateStr) {
        inPeriod.end = formatDate(addDays(parseDate(dateStr), -1));
        if (inPeriod.end < inPeriod.start) periodRecords = periodRecords.filter((p) => p !== inPeriod);
      } else {
        const before = { start: inPeriod.start, end: formatDate(addDays(parseDate(dateStr), -1)) };
        const after = { start: formatDate(addDays(parseDate(dateStr), 1)), end: end };
        periodRecords = periodRecords.filter((p) => p !== inPeriod);
        periodRecords.push(before, after);
      }
    } else {
      const prev = formatDate(addDays(parseDate(dateStr), -1));
      const next = formatDate(addDays(parseDate(dateStr), 1));
      const adjEnd = periodRecords.find((p) => endOf(p) === prev);
      const adjStart = periodRecords.find((p) => p.start === next);
      if (adjEnd) {
        adjEnd.end = dateStr;
      } else if (adjStart) {
        adjStart.start = dateStr;
      } else {
        periodRecords.push({ start: dateStr, end: dateStr });
      }
      periodRecords.sort((a, b) => b.start.localeCompare(a.start));
    }
    savePeriods();
    renderDashboard();
    renderCalendar();
    hideCalPopover();
  }

  function onCalPopoverAction(action, dateStr) {
    if (action === "period") togglePeriodDate(dateStr);
    else if (action === "ovulation") {
      toggleOvulationMarked(dateStr);
      saveOvulationMarked();
      renderCalendar();
      renderDashboard();
    } else if (action === "detail") {
      hideCalPopover();
      document.removeEventListener("click", closePopoverOnClick);
      openDayRecordModal(dateStr);
    }
    if (action !== "detail") hideCalPopover();
    if (action !== "detail") document.removeEventListener("click", closePopoverOnClick);
  }

  function openDayRecordModal(dateStr) {
    document.getElementById("day-record-date").value = dateStr;
    document.getElementById("day-record-title").textContent = dateStr + " の記録";
    renderDayRecordForm(dateStr);
    document.getElementById("day-record-modal").classList.add("is-open");
    document.getElementById("day-record-modal").setAttribute("aria-hidden", "false");
  }

  function closeDayRecordModal() {
    document.getElementById("day-record-modal").classList.remove("is-open");
    document.getElementById("day-record-modal").setAttribute("aria-hidden", "true");
    renderCalendar();
    renderDashboard();
  }

  function renderDayRecordForm(dateStr) {
    const bbtEl = document.getElementById("day-record-bbt");
    const bbtRec = bbtRecords.find((r) => r.date === dateStr);
    bbtEl.value = bbtRec != null ? (typeof bbtRec.value === "number" ? bbtRec.value.toFixed(2) : bbtRec.value) : "";

    const sym = symptomsRecords.find((r) => r.date === dateStr);
    const symList = sym ? sym.symptoms : [];
    const symHtml = SYMPTOM_OPTIONS.map((s) => "<button type=\"button\" class=\"btn-chip " + (symList.includes(s) ? "selected" : "") + "\" data-symptom=\"" + s + "\">" + s + "</button>").join("");
    document.getElementById("day-record-symptoms").innerHTML = symHtml;
    document.getElementById("day-record-symptoms").querySelectorAll(".btn-chip").forEach((btn) => {
      btn.addEventListener("click", function () {
        toggleSymptom(dateStr, this.dataset.symptom);
        renderDayRecordForm(dateStr);
      });
    });

    const dis = dischargeRecords.find((r) => r.date === dateStr);
    let disHtml = DISCHARGE_AMOUNT.map((a, i) => "<button type=\"button\" class=\"btn-chip " + (dis && dis.amount === i ? "selected" : "") + "\" data-da=\"" + i + "\">" + a + "</button>").join("");
    disHtml += DISCHARGE_STATE.map((s, i) => "<button type=\"button\" class=\"btn-chip " + (dis && dis.state === i ? "selected" : "") + "\" data-ds=\"" + i + "\">" + s + "</button>").join("");
    document.getElementById("day-record-discharge").innerHTML = disHtml;
    document.getElementById("day-record-discharge").querySelectorAll(".btn-chip").forEach((btn) => {
      if (btn.dataset.da !== undefined) {
        btn.addEventListener("click", function () {
          setDischarge(dateStr, parseInt(this.dataset.da, 10), dis ? dis.state : null);
          renderDayRecordForm(dateStr);
        });
      } else {
        btn.addEventListener("click", function () {
          setDischarge(dateStr, dis ? dis.amount : null, parseInt(this.dataset.ds, 10));
          renderDayRecordForm(dateStr);
        });
      }
    });

    const ov = ovulationTests.find((r) => r.date === dateStr);
    const ovHtml = OVULATION_RESULTS.map((o) => "<button type=\"button\" class=\"btn-chip " + (ov && ov.result === o.id ? "selected" : "") + "\" data-ov=\"" + o.id + "\">" + o.label + "</button>").join("");
    document.getElementById("day-record-ovulation").innerHTML = ovHtml;
    document.getElementById("day-record-ovulation").querySelectorAll(".btn-chip").forEach((btn) => {
      btn.addEventListener("click", function () {
        setOvulationTest(dateStr, this.dataset.ov);
        renderDayRecordForm(dateStr);
      });
    });

    const photoPreview = document.getElementById("day-record-ovulation-preview");
    const photoInput = document.getElementById("day-record-ovulation-photo");
    if (photoInput) photoInput.value = "";
    if (photoPreview) {
      if (ov && ov.photo) {
        photoPreview.innerHTML = "<img src=\"" + ov.photo + "\" alt=\"排卵検査薬\" class=\"day-record-photo-thumb\" /><button type=\"button\" class=\"day-record-photo-remove\">削除</button>";
        const removeBtn = photoPreview.querySelector(".day-record-photo-remove");
        if (removeBtn) removeBtn.addEventListener("click", function () {
          clearOvulationPhoto(dateStr);
          renderDayRecordForm(dateStr);
        });
      } else {
        photoPreview.innerHTML = "";
      }
    }

    const hasTiming = timingRecords.some((r) => r.date === dateStr);
    const timingBtn = document.getElementById("day-record-timing");
    timingBtn.textContent = hasTiming ? "記録済み（タップで解除）" : "記録する";
    timingBtn.className = "btn-chip" + (hasTiming ? " selected" : "");
    timingBtn.onclick = function () {
      const idx = timingRecords.findIndex((r) => r.date === dateStr);
      if (idx >= 0) timingRecords.splice(idx, 1);
      else timingRecords.push({ date: dateStr, memo: "" });
      saveRecords();
      renderDayRecordForm(dateStr);
    };

    const medsForDate = medicationRecords.filter((r) => r.date === dateStr);
    document.getElementById("day-record-meds").innerHTML = medsForDate.map((m, i) => "<div class=\"day-record-med-item\"><span>" + (m.name || "（未入力）") + "</span><button type=\"button\" data-i=\"" + i + "\">削除</button></div>").join("");
    document.getElementById("day-record-meds").querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", function () {
        const i = parseInt(btn.dataset.i, 10);
        const toRemove = medsForDate[i];
        if (toRemove) {
          const idx = medicationRecords.findIndex((r) => r.date === dateStr && r.name === toRemove.name);
          if (idx >= 0) medicationRecords.splice(idx, 1);
        }
        saveMedications();
        renderDayRecordForm(dateStr);
      });
    });

    const medPresetEl = document.getElementById("day-record-med-preset");
    if (medPresetEl) {
      const hasMed = (name) => medsForDate.some((m) => m.name === name);
      medPresetEl.innerHTML = MED_PRESET.map((name) => "<button type=\"button\" class=\"btn-chip " + (hasMed(name) ? "selected" : "") + "\" data-med=\"" + name.replace(/"/g, "&quot;") + "\">" + name + "</button>").join("");
      medPresetEl.querySelectorAll(".btn-chip").forEach((btn) => {
        btn.addEventListener("click", function () {
          const name = this.dataset.med;
          if (hasMed(name)) {
            const idx = medicationRecords.findIndex((r) => r.date === dateStr && r.name === name);
            if (idx >= 0) medicationRecords.splice(idx, 1);
          } else {
            medicationRecords.push({ date: dateStr, name: name });
          }
          saveMedications();
          renderDayRecordForm(dateStr);
        });
      });
    }
  }

  function saveDayRecordBBT() {
    const dateEl = document.getElementById("day-record-date");
    const inputEl = document.getElementById("day-record-bbt");
    if (!dateEl || !inputEl) return;
    const dateStr = dateEl.value;
    const bbtVal = roundBBT(inputEl.value);
    if (bbtVal == null) return;
    const idx = bbtRecords.findIndex((r) => r.date === dateStr);
    if (idx >= 0) bbtRecords[idx].value = bbtVal;
    else bbtRecords.push({ date: dateStr, value: bbtVal });
    saveBBT();
  }

  function saveDayRecord() {
    saveDayRecordBBT();
    closeDayRecordModal();
  }

  function renderCalendar() {
    const phase = getCyclePhase(calendarCurrent);
    const year = calendarCurrent.getFullYear();
    const month = calendarCurrent.getMonth();

    const titleEl = document.getElementById("cal-title");
    titleEl.textContent = `${year}年${month + 1}月`;

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const totalCells = startPad + daysInMonth;
    const rows = Math.ceil(totalCells / 7);

    const grid = document.getElementById("calendar-grid");
    grid.innerHTML = "";

    const weekDays = ["月", "火", "水", "木", "金", "土", "日"];
    weekDays.forEach((w) => {
      const h = document.createElement("div");
      h.className = "cal-day";
      h.style.background = "transparent";
      h.style.fontWeight = "600";
      h.style.color = "var(--text-muted)";
      h.textContent = w;
      grid.appendChild(h);
    });

    for (let i = 0; i < startPad; i++) {
      const prevMonth = new Date(year, month, -startPad + i + 1);
      const dateStrPrev = formatDate(prevMonth);
      const cell = document.createElement("div");
      cell.className = "cal-day other-month cal-day-clickable";
      cell.dataset.date = dateStrPrev;
      cell.style.cursor = "pointer";
      const inner = document.createElement("div");
      inner.className = "cal-day-inner";
      inner.innerHTML = "<span>" + prevMonth.getDate() + "</span>";
      appendCycleDayToCell(inner, prevMonth);
      appendBBTToCell(inner, dateStrPrev);
      cell.appendChild(inner);
      const hasRecorded = isDateInPeriod(dateStrPrev) || isOvulationMarked(dateStrPrev);
      const monthHasRec = monthHasRecorded(prevMonth.getFullYear(), prevMonth.getMonth());
      const type = !hasRecorded && !monthHasRec && phase ? getDayType(prevMonth, phase) : null;
      if (type) cell.classList.add(type);
      if (isDateInPeriod(dateStrPrev)) cell.classList.add("period-recorded");
      if (isOvulationMarked(dateStrPrev)) cell.classList.add("ovulation-recorded");
      cell.addEventListener("click", function (e) {
        e.stopPropagation();
        showCalPopover(this, this.dataset.date);
      });
      grid.appendChild(cell);
    }

    const todayStr = formatDate(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = formatDate(date);
      const rec = getRecordsForDate(dateStr);
      const cell = document.createElement("div");
      cell.className = "cal-day cal-day-clickable";
      cell.dataset.date = dateStr;
      cell.style.cursor = "pointer";
      const inner = document.createElement("div");
      inner.className = "cal-day-inner";
      inner.innerHTML = `<span>${d}</span>`;
      appendCycleDayToCell(inner, date);
      appendBBTToCell(inner, dateStr);
      cell.appendChild(inner);
      if (formatDate(date) === todayStr) cell.classList.add("today");
      const hasRecorded = isDateInPeriod(dateStr) || isOvulationMarked(dateStr);
      const monthHasRec = monthHasRecorded(year, month);
      if (phase && !hasRecorded && !monthHasRec) {
        const type = getDayType(date, phase);
        if (type) cell.classList.add(type);
      }
      if (isDateInPeriod(dateStr)) cell.classList.add("period-recorded");
      if (isOvulationMarked(dateStr)) cell.classList.add("ovulation-recorded");
      cell.addEventListener("click", function (e) {
        e.stopPropagation();
        showCalPopover(this, this.dataset.date);
      });
      grid.appendChild(cell);
    }

    const rest = rows * 7 - (startPad + daysInMonth);
    for (let i = 0; i < rest; i++) {
      const nextMonth = new Date(year, month + 1, i + 1);
      const dateStrNext = formatDate(nextMonth);
      const cell = document.createElement("div");
      cell.className = "cal-day other-month cal-day-clickable";
      cell.dataset.date = dateStrNext;
      cell.style.cursor = "pointer";
      const inner = document.createElement("div");
      inner.className = "cal-day-inner";
      inner.innerHTML = "<span>" + (i + 1) + "</span>";
      appendCycleDayToCell(inner, nextMonth);
      appendBBTToCell(inner, dateStrNext);
      cell.appendChild(inner);
      const hasRecordedNext = isDateInPeriod(dateStrNext) || isOvulationMarked(dateStrNext);
      const monthHasRecNext = monthHasRecorded(nextMonth.getFullYear(), nextMonth.getMonth());
      const typeNext = !hasRecordedNext && !monthHasRecNext && phase ? getDayType(nextMonth, phase) : null;
      if (typeNext) cell.classList.add(typeNext);
      if (isDateInPeriod(dateStrNext)) cell.classList.add("period-recorded");
      if (isOvulationMarked(dateStrNext)) cell.classList.add("ovulation-recorded");
      cell.addEventListener("click", function (e) {
        e.stopPropagation();
        showCalPopover(this, this.dataset.date);
      });
      grid.appendChild(cell);
    }
  }

  function getAverageCycleFromRecords() {
    const result = { cycleLength: null, follicularDays: null, lutealDays: null };
    if (periodRecords.length < 2) return result;
    const cycles = [];
    for (let i = 0; i < periodRecords.length - 1; i++) {
      const start = parseDate(periodRecords[i].start);
      const prevStart = parseDate(periodRecords[i + 1].start);
      if (!start || !prevStart) continue;
      const days = Math.round((start - prevStart) / 86400000);
      if (days >= 21 && days <= 45) cycles.push(days);
    }
    if (cycles.length) {
      result.cycleLength = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
    }
    const folliculars = [];
    const luteals = [];
    for (let i = 0; i < periodRecords.length - 1; i++) {
      const nextStart = periodRecords[i].start;
      const periodStart = periodRecords[i + 1].start;
      const ov = ovulationMarkedDates.find((d) => d > periodStart && d < nextStart);
      if (!ov) continue;
      const startMs = parseDate(periodStart).getTime();
      const ovMs = parseDate(ov).getTime();
      const nextMs = parseDate(nextStart).getTime();
      const fol = Math.round((ovMs - startMs) / 86400000);
      const lut = Math.round((nextMs - ovMs) / 86400000);
      if (fol >= 10 && fol <= 30) folliculars.push(fol);
      if (lut >= 10 && lut <= 18) luteals.push(lut);
    }
    if (folliculars.length) result.follicularDays = Math.round(folliculars.reduce((a, b) => a + b, 0) / folliculars.length);
    if (luteals.length) result.lutealDays = Math.round(luteals.reduce((a, b) => a + b, 0) / luteals.length);
    return result;
  }

  function renderCalendarPhaseForm() {
    const follicular = (settings.cycleLength || 28) - (settings.lutealPhaseDays ?? 14);
    const luteal = settings.lutealPhaseDays ?? 14;
    const cycle = settings.cycleLength || 28;
    const lowEl = document.getElementById("cal-follicular-days");
    const highEl = document.getElementById("cal-luteal-days");
    const cycleEl = document.getElementById("cal-cycle-days");
    if (lowEl) lowEl.value = follicular;
    if (highEl) highEl.value = luteal;
    if (cycleEl) cycleEl.value = cycle;
    const avg = getAverageCycleFromRecords();
    const avgFolEl = document.getElementById("cal-avg-follicular");
    const avgLutEl = document.getElementById("cal-avg-luteal");
    const avgCycEl = document.getElementById("cal-avg-cycle");
    if (avgFolEl) avgFolEl.textContent = avg.follicularDays != null ? avg.follicularDays + " 日" : "—";
    if (avgLutEl) avgLutEl.textContent = avg.lutealDays != null ? avg.lutealDays + " 日" : "—";
    if (avgCycEl) avgCycEl.textContent = avg.cycleLength != null ? avg.cycleLength + " 日" : "—";
  }

  function renderBBTChart() {
    const area = document.getElementById("bbt-chart-area");
    if (bbtRecords.length < 2) {
      area.innerHTML = "<p class=\"hint\">記録を追加するとグラフが表示されます</p>";
      return;
    }

    const height = 480;
    const dayCount = Math.max(
      1,
      new Set(bbtRecords.map((r) => r.date)).size
    );
    const baseWidth = area.offsetWidth || 320;
    const width = Math.max(baseWidth, 40 + dayCount * 30); // 日数に応じて横に長く（横スクロール）
    const pad = { top: 10, right: 10, bottom: 26, left: 34 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const minYAxis = 34.0;
    const maxYAxis = 42.0;
    const tempRange = maxYAxis - minYAxis;

    const parseBBTDate = (d) => new Date(d).getTime();
    const firstDateMs = parseBBTDate(bbtRecords[0].date);
    const lastDateMs = parseBBTDate(bbtRecords[bbtRecords.length - 1].date);
    const dateRange = Math.max(1, lastDateMs - firstDateMs);

    const xForDate = (ms) => pad.left + ((ms - firstDateMs) / dateRange) * chartW;
    const yForTemp = (t) =>
      pad.top + (1 - (Math.min(Math.max(t, minYAxis), maxYAxis) - minYAxis) / tempRange) * chartH;

    const points = bbtRecords
      .map((r) => {
        const x = xForDate(parseBBTDate(r.date));
        const y = yForTemp(typeof r.value === "number" ? r.value : parseFloat(r.value));
        return `${x},${y}`;
      })
      .join(" ");

    const yTicks = [];
    for (let t = minYAxis; t <= maxYAxis + 1e-6; t += 0.1) {
      yTicks.push(Math.round(t * 10) / 10);
    }

    const gridLines = yTicks
      .map((t) => {
        const y = yForTemp(t);
        const isInteger = Math.abs(t - Math.round(t)) < 0.001; // 34,35,...,42
        const stroke = isInteger ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.07)";
        const strokeWidth = isInteger ? 1.1 : 0.6;
        let label = "";
        if (isInteger) {
          label = Math.round(t).toString();
        } else {
          const frac = Math.round((t - Math.floor(t)) * 10); // 0〜9
          label = "." + frac;
        }
        return `
          <line x1="${pad.left}" y1="${y}" x2="${pad.left + chartW}" y2="${y}"
            stroke="${stroke}" stroke-width="${strokeWidth}" />
          <text x="${pad.left - 4}" y="${y + 3}" font-size="9" text-anchor="end" fill="var(--text-muted)">${label}</text>
        `;
      })
      .join("");

    const verticalLines = bbtRecords
      .map((r) => {
        const ms = parseBBTDate(r.date);
        const x = xForDate(ms);
        return `
          <line x1="${x}" y1="${pad.top}" x2="${x}" y2="${pad.top + chartH}"
            stroke="rgba(0,0,0,0.05)" stroke-width="0.6" />
        `;
      })
      .join("");

    const dayStep = Math.max(1, Math.ceil(bbtRecords.length / 10));
    const xLabels = bbtRecords
      .filter((_, i) => i % dayStep === 0 || i === bbtRecords.length - 1)
      .map((r) => {
        const ms = parseBBTDate(r.date);
        const x = xForDate(ms);
        const label = r.date.slice(5).replace("-", "/");
        return `<text x="${x}" y="${height - 6}" font-size="9" text-anchor="middle" fill="var(--text-muted)">${label}</text>`;
      })
      .join("");

    const polyline = `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${points}"/>`;

    const pointDots = bbtRecords
      .map((r) => {
        const x = xForDate(parseBBTDate(r.date));
        const v = typeof r.value === "number" ? r.value : parseFloat(r.value);
        const y = yForTemp(v);
        return `<circle cx="${x}" cy="${y}" r="2.3" fill="var(--surface)" stroke="var(--accent)" stroke-width="1"/>`;
      })
      .join("");

    area.innerHTML = `
      <svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        ${verticalLines}
        ${polyline}
        ${pointDots}
        ${xLabels}
      </svg>
    `;
  }

  async function recognizeBBTFromImage(file, onStatus) {
    const msg = function (text) {
      if (typeof onStatus === "function") onStatus(text);
    };
    if (!window.Tesseract || !Tesseract.recognize) {
      msg("この端末では画像からの読み取りに対応していません。");
      return null;
    }
    try {
      msg("画像を解析しています…（数十秒かかることがあります）");
      const result = await Tesseract.recognize(file, "eng", {
        logger: function (m) {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            const pct = Math.round(m.progress * 100);
            msg("画像を解析しています… " + pct + "%");
          }
        },
      });
      const text = (result && result.data && result.data.text) || "";
      const matches = text.match(/(3[5-9]\.\d{1,2}|40\.\d{1,2})/g);
      if (!matches) {
        msg("体温の数字が見つかりませんでした。画像をアップで撮るか、もう一度試してください。");
        return null;
      }
      for (let i = 0; i < matches.length; i++) {
        const v = roundBBT(matches[i]);
        if (v != null) {
          msg("体温 " + v.toFixed(2) + "℃ を読み取りました。内容を確認して「追加」を押してください。");
          return v;
        }
      }
      msg("体温の数字が見つかりませんでした。");
      return null;
    } catch (e) {
      msg("画像の解析に失敗しました。もう一度試してください。");
      return null;
    }
  }

  function renderBBTList() {
    const list = document.getElementById("bbt-list");
    if (bbtRecords.length === 0) {
      list.innerHTML = "<p class=\"hint\">まだ記録がありません</p>";
      return;
    }
    list.innerHTML = bbtRecords
      .slice()
      .reverse()
      .map(
        (r) =>
          `<div class="bbt-item" data-date="${r.date}">
            <span>${r.date} … ${(typeof r.value === "number" ? r.value.toFixed(2) : r.value)}℃</span>
            <button type="button" class="delete-bbt">削除</button>
          </div>`
      )
      .join("");

    list.querySelectorAll(".delete-bbt").forEach((btn) => {
      btn.addEventListener("click", function () {
        const item = this.closest(".bbt-item");
        const date = item.dataset.date;
        bbtRecords = bbtRecords.filter((r) => r.date !== date);
        saveBBT();
        renderBBTList();
        renderBBTChart();
      });
    });
  }

  function renderPeriodCalendar() {
    const grid = document.getElementById("period-calendar-grid");
    const titleEl = document.getElementById("period-cal-title");
    if (!grid || !titleEl) return;
    const year = periodCalendarCurrent.getFullYear();
    const month = periodCalendarCurrent.getMonth();
    titleEl.textContent = year + "年" + (month + 1) + "月";
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const rows = Math.ceil((startPad + daysInMonth) / 7);
    grid.innerHTML = "";
    ["月", "火", "水", "木", "金", "土", "日"].forEach((w) => {
      const h = document.createElement("div");
      h.className = "cal-day";
      h.style.background = "transparent";
      h.style.fontWeight = "600";
      h.style.color = "var(--text-muted)";
      h.textContent = w;
      grid.appendChild(h);
    });
    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -startPad + i + 1);
      const dateStr = formatDate(d);
      const cell = document.createElement("div");
      cell.className = "cal-day other-month cal-day-clickable";
      cell.dataset.date = dateStr;
      cell.style.cursor = "pointer";
      const inner = document.createElement("div");
      inner.className = "cal-day-inner";
      inner.innerHTML = "<span>" + d.getDate() + "</span>";
      cell.appendChild(inner);
      if (isDateInPeriod(dateStr)) cell.classList.add("period-recorded");
      cell.addEventListener("click", function () {
        togglePeriodDate(this.dataset.date);
      });
      grid.appendChild(cell);
    }
    const todayStr = formatDate(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = formatDate(date);
      const cell = document.createElement("div");
      cell.className = "cal-day cal-day-clickable";
      cell.dataset.date = dateStr;
      cell.style.cursor = "pointer";
      const inner = document.createElement("div");
      inner.className = "cal-day-inner";
      inner.innerHTML = "<span>" + d + "</span>";
      cell.appendChild(inner);
      if (dateStr === todayStr) cell.classList.add("today");
      if (isDateInPeriod(dateStr)) cell.classList.add("period-recorded");
      cell.addEventListener("click", function () {
        togglePeriodDate(this.dataset.date);
      });
      grid.appendChild(cell);
    }
    const rest = rows * 7 - (startPad + daysInMonth);
    for (let i = 0; i < rest; i++) {
      const d = new Date(year, month + 1, i + 1);
      const dateStr = formatDate(d);
      const cell = document.createElement("div");
      cell.className = "cal-day other-month cal-day-clickable";
      cell.dataset.date = dateStr;
      cell.style.cursor = "pointer";
      const inner = document.createElement("div");
      inner.className = "cal-day-inner";
      inner.innerHTML = "<span>" + (i + 1) + "</span>";
      cell.appendChild(inner);
      if (isDateInPeriod(dateStr)) cell.classList.add("period-recorded");
      cell.addEventListener("click", function () {
        togglePeriodDate(this.dataset.date);
      });
      grid.appendChild(cell);
    }
  }

  function syncCycleInputs() {
    const lowEl = document.getElementById("cal-follicular-days");
    const highEl = document.getElementById("cal-luteal-days");
    const totalEl = document.getElementById("cal-cycle-days");
    if (!lowEl || !highEl || !totalEl) return;
    const low = parseInt(lowEl.value, 10);
    const high = parseInt(highEl.value, 10);
    const total = parseInt(totalEl.value, 10);
    const lowOk = low >= 10 && low <= 30;
    const highOk = high >= 10 && high <= 18;
    const totalOk = total >= 21 && total <= 45;
    if (lowOk && highOk) totalEl.value = low + high;
    else if (lowOk && totalOk) highEl.value = total - low;
    else if (highOk && totalOk) lowEl.value = total - high;
  }

  function renderPeriodView() {
    renderPeriodCalendar();
  }

  function renderRecordView() {
    /* 記録タブは削除済み。カレンダー「その日の記録」で入力する。 */
  }

  function toggleSymptom(dateStr, symptom) {
    let rec = symptomsRecords.find((r) => r.date === dateStr);
    if (!rec) {
      rec = { date: dateStr, symptoms: [] };
      symptomsRecords.push(rec);
    }
    const i = rec.symptoms.indexOf(symptom);
    if (i >= 0) rec.symptoms.splice(i, 1);
    else rec.symptoms.push(symptom);
    if (rec.symptoms.length === 0) symptomsRecords = symptomsRecords.filter((r) => r.date !== dateStr);
    saveRecords();
  }

  function setOvulationTest(dateStr, result) {
    const idx = ovulationTests.findIndex((r) => r.date === dateStr);
    if (idx >= 0) {
      ovulationTests[idx].result = result;
    } else {
      ovulationTests.push({ date: dateStr, result: result });
    }
    saveRecords();
  }

  function setOvulationPhoto(dateStr, dataUrl) {
    let rec = ovulationTests.find((r) => r.date === dateStr);
    if (!rec) {
      rec = { date: dateStr, result: null };
      ovulationTests.push(rec);
    }
    rec.photo = dataUrl;
    saveRecords();
  }

  function clearOvulationPhoto(dateStr) {
    const rec = ovulationTests.find((r) => r.date === dateStr);
    if (rec) {
      delete rec.photo;
      if (rec.result == null && Object.keys(rec).length <= 1) ovulationTests = ovulationTests.filter((r) => r.date !== dateStr);
      saveRecords();
    }
  }

  function setDischarge(dateStr, amount, state) {
    const idx = dischargeRecords.findIndex((r) => r.date === dateStr);
    if (idx >= 0) {
      if (amount != null) dischargeRecords[idx].amount = amount;
      if (state != null) dischargeRecords[idx].state = state;
    } else {
      dischargeRecords.push({ date: dateStr, amount: amount != null ? amount : 0, state: state != null ? state : 0 });
    }
    saveRecords();
  }

  function switchView(viewId) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    const view = document.getElementById("view-" + viewId);
    const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
    if (view) view.classList.add("active");
    if (btn) btn.classList.add("active");

    if (viewId === "dashboard") renderDashboard();
    if (viewId === "calendar") {
      renderCalendar();
      renderCalendarPhaseForm();
    }
    if (viewId === "temperature") {
      renderBBTList();
      renderBBTChart();
    }
    if (viewId === "visits") renderVisitsView();
    if (viewId === "chat") renderChatView();
  }

  function formatVisitsForAI() {
    if (!visitRecords.length) return "（通院記録はまだありません）";
    return visitRecords
      .slice(0, 15)
      .map((v) => v.date + ": " + [v.content, v.results].filter(Boolean).join(" / "))
      .join("\n");
  }

  function renderVisitsView() {
    const listEl = document.getElementById("visit-list");
    if (!listEl) return;
    if (visitRecords.length === 0) {
      listEl.innerHTML = "<p class=\"hint\">通院した日付・内容・検査結果を追加すると一覧に表示されます。AIが参照してアドバイスに活かします。</p>";
      return;
    }
    listEl.innerHTML = visitRecords
      .map(
        (v, i) =>
          `<div class="visit-item" data-index="${i}">
            <div class="visit-item-header"><strong>${escapeHtml(v.date)}</strong> <button type="button" class="visit-delete" data-index="${i}" aria-label="削除">×</button></div>
            ${v.content ? "<div class=\"visit-item-content\">" + escapeHtml(v.content) + "</div>" : ""}
            ${v.results ? "<div class=\"visit-item-results\">検査結果: " + escapeHtml(v.results) + "</div>" : ""}
          </div>`
      )
      .join("");
    listEl.querySelectorAll(".visit-delete").forEach((btn) => {
      btn.addEventListener("click", function () {
        const i = parseInt(this.dataset.index, 10);
        visitRecords.splice(i, 1);
        saveVisits();
        renderVisitsView();
      });
    });
  }

  function renderChatView() {
    const container = document.getElementById("chat-messages");
    container.innerHTML = chatHistory.length
      ? chatHistory
          .map(
            (m) =>
              `<div class="chat-msg ${m.role}">${escapeHtml(m.content)}</div>`
          )
          .join("")
      : '<p class="hint">メッセージを送信すると会話が始まります。</p>';
    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  async function sendChatMessage() {
    const inputEl = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");
    const text = inputEl.value.trim();
    if (!text) return;
    chatHistory.push({ role: "user", content: text });
    inputEl.value = "";
    saveChatHistory();
    renderChatView();
    sendBtn.disabled = true;
    const maxMessages = 20;
    const recent = chatHistory.slice(-maxMessages);
    const systemContent =
      AI_SYSTEM_PROMPT +
      "\n\n【ユーザーの通院記録（参照用）】\n" +
      formatVisitsForAI() +
      "\n\n上記の通院・検査内容を把握したうえで、必要に応じて言及しつつ会話してください。";
    const messages = [{ role: "system", content: systemContent }, ...recent];
    try {
      const reply = await callAI(messages);
      chatHistory.push({ role: "assistant", content: reply });
      saveChatHistory();
      renderChatView();
    } catch (e) {
      chatHistory.push({ role: "assistant", content: "エラー: " + (e.message || "応答を取得できませんでした。APIキーを確認してください。") });
      saveChatHistory();
      renderChatView();
    }
    sendBtn.disabled = false;
  }

  function initSettingsForm() {
    document.getElementById("cycle-length").value = settings.cycleLength;
    document.getElementById("period-length").value = settings.periodLength;
    const lutealEl = document.getElementById("luteal-days");
    if (lutealEl) lutealEl.value = settings.lutealPhaseDays ?? 14;
    if (settings.lastPeriodStart) {
      document.getElementById("last-period-start").value = settings.lastPeriodStart;
    }
  }

  function exportData() {
    const data = {
      settings,
      bbt: bbtRecords,
      symptoms: symptomsRecords,
      ovulationTests,
      timing: timingRecords,
      discharge: dischargeRecords,
      periods: periodRecords,
      ovulationMarked: ovulationMarkedDates,
      medications: medicationRecords,
      visits: visitRecords,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nikatsu-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function backupData() {
    const data = {
      settings,
      bbt: bbtRecords,
      symptoms: symptomsRecords,
      ovulationTests,
      timing: timingRecords,
      discharge: dischargeRecords,
      periods: periodRecords,
      ovulationMarked: ovulationMarkedDates,
      medications: medicationRecords,
      visits: visitRecords,
      backupAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nikatsu-backup-" + formatDate(new Date()) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(jsonText) {
    const msgEl = document.getElementById("import-data-msg");
    try {
      const data = JSON.parse(jsonText);
      if (!data || typeof data !== "object") throw new Error("不正な形式です");
      if (data.settings && typeof data.settings === "object") {
        settings = { ...DEFAULT_SETTINGS, ...data.settings };
        saveSettings();
      }
      if (Array.isArray(data.bbt)) {
        bbtRecords = data.bbt;
        bbtRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveBBT();
      }
      if (Array.isArray(data.symptoms)) {
        symptomsRecords = data.symptoms;
        saveRecords();
      }
      if (Array.isArray(data.ovulationTests)) {
        ovulationTests = data.ovulationTests;
        saveRecords();
      }
      if (Array.isArray(data.timing)) {
        timingRecords = data.timing;
        saveRecords();
      }
      if (Array.isArray(data.discharge)) {
        dischargeRecords = data.discharge;
        saveRecords();
      }
      if (Array.isArray(data.periods)) {
        periodRecords = data.periods;
        periodRecords.sort((a, b) => (b.start || "").localeCompare(a.start || ""));
        savePeriods();
      }
      if (Array.isArray(data.ovulationMarked)) {
        ovulationMarkedDates = data.ovulationMarked;
        ovulationMarkedDates.sort();
        saveOvulationMarked();
      }
      if (Array.isArray(data.medications)) {
        medicationRecords = data.medications;
        saveMedications();
      }
      if (Array.isArray(data.visits)) {
        visitRecords = data.visits;
        visitRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        saveVisits();
      }
      localStorage.setItem(STORAGE_KEYS.onboarding, "1");
      document.getElementById("onboarding").classList.add("hidden");
      document.getElementById("main-app").style.display = "";
      initSettingsForm();
      initAISettingsForm();
      renderDashboard();
      renderCalendar();
      renderCalendarPhaseForm();
      renderBBTChart();
      renderBBTList();
      renderVisitsView();
      if (msgEl) {
        msgEl.textContent = "取り込みました。";
        msgEl.className = "msg success";
      }
    } catch (e) {
      if (msgEl) {
        msgEl.textContent = "取り込めませんでした: " + (e.message || "ファイルを確認してください");
        msgEl.className = "msg error";
      }
    }
  }

  function buildShareUrl() {
    const maxHashLength = 1800;
    const visitsNoPhotos = (visitRecords || []).map(function (v) {
      const c = { date: v.date, content: v.content || "", results: v.results || "", resultsPhoto: null };
      return c;
    });
    const ovNoPhotos = (ovulationTests || []).map(function (o) {
      const c = { date: o.date, result: o.result };
      return c;
    });
    const data = {
      settings,
      bbt: bbtRecords || [],
      symptoms: symptomsRecords || [],
      ovulationTests: ovNoPhotos,
      timing: timingRecords || [],
      discharge: dischargeRecords || [],
      periods: periodRecords || [],
      ovulationMarked: ovulationMarkedDates || [],
      medications: medicationRecords || [],
      visits: visitsNoPhotos,
      sharedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(data);
    let encoded = "";
    if (typeof LZString !== "undefined") {
      encoded = LZString.compressToEncodedURIComponent(jsonStr);
    } else {
      encoded = encodeURIComponent(jsonStr);
    }
    const baseUrl = (location.href || "").split("#")[0] || (location.origin + "/");
    const fullUrl = baseUrl + "#d=" + encoded;
    if (fullUrl.length > maxHashLength) {
      return { url: "", error: "データが多すぎます。バックアップファイルで取り込んでください。" };
    }
    return { url: fullUrl, error: null };
  }

  function initAISettingsForm() {
    const providerEl = document.getElementById("ai-provider");
    const keyEl = document.getElementById("ai-api-key");
    const modelEl = document.getElementById("ai-model");
    if (providerEl) providerEl.value = aiSettings.provider || "openai";
    if (keyEl) keyEl.value = aiSettings.apiKey || "";
    if (modelEl) {
      modelEl.value = aiSettings.model || (aiSettings.provider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");
    }
  }

  function init() {
    loadSettings();
    loadBBT();
    loadRecords();
    loadPeriods();
    loadOvulationMarked();
    loadMedications();
    loadVisits();
    loadAISettings();
    loadChatHistory();

    const hashMatch = location.hash && location.hash.indexOf("#d=") === 0;
    if (hashMatch && typeof LZString !== "undefined") {
      try {
        const encoded = location.hash.slice(3);
        const decoded = LZString.decompressFromEncodedURIComponent(encoded);
        if (decoded) {
          importData(decoded);
        }
      } catch (_) {}
      history.replaceState(null, "", location.pathname + location.search);
    }

    initSettingsForm();
    initAISettingsForm();

    const onboardingEl = document.getElementById("onboarding");
    const mainAppEl = document.getElementById("main-app");
    if (localStorage.getItem(STORAGE_KEYS.onboarding) !== "1") {
      mainAppEl.style.display = "none";
    } else {
      onboardingEl.classList.add("hidden");
    }

    document.getElementById("onboarding-done").addEventListener("click", function () {
      const cycle = parseInt(document.getElementById("ob-cycle-length").value, 10);
      const period = parseInt(document.getElementById("ob-period-length").value, 10);
      const last = document.getElementById("ob-last-period-start").value || null;
      if (cycle >= 21 && cycle <= 45) settings.cycleLength = cycle;
      if (period >= 3 && period <= 10) settings.periodLength = period;
      settings.lastPeriodStart = last;
      saveSettings();
      localStorage.setItem(STORAGE_KEYS.onboarding, "1");
      onboardingEl.classList.add("hidden");
      mainAppEl.style.display = "";
      initSettingsForm();
      renderDashboard();
      renderCalendar();
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        switchView(this.dataset.view);
      });
    });

    document.getElementById("cal-prev").addEventListener("click", function () {
      calendarCurrent.setMonth(calendarCurrent.getMonth() - 1);
      renderCalendar();
    });
    document.getElementById("cal-next").addEventListener("click", function () {
      calendarCurrent.setMonth(calendarCurrent.getMonth() + 1);
      renderCalendar();
    });

    ["cal-follicular-days", "cal-luteal-days", "cal-cycle-days"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", syncCycleInputs);
    });

    document.getElementById("cal-phase-save-btn").addEventListener("click", function () {
      const low = parseInt(document.getElementById("cal-follicular-days").value, 10);
      const high = parseInt(document.getElementById("cal-luteal-days").value, 10);
      const total = parseInt(document.getElementById("cal-cycle-days").value, 10);
      if (high >= 10 && high <= 18) settings.lutealPhaseDays = high;
      if (total >= 21 && total <= 45) settings.cycleLength = total;
      if (low >= 10 && low <= 30) settings.cycleLength = low + (settings.lutealPhaseDays ?? 14);
      saveSettings();
      renderCalendarPhaseForm();
      renderCalendar();
      renderDashboard();
    });

    document.querySelectorAll(".cal-popover-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const pop = document.getElementById("cal-popover");
        const dateStr = pop && pop.dataset.date;
        if (dateStr) onCalPopoverAction(btn.dataset.action, dateStr);
      });
    });

    document.getElementById("save-settings-btn").addEventListener("click", function () {
      const cycle = parseInt(document.getElementById("cycle-length").value, 10);
      const period = parseInt(document.getElementById("period-length").value, 10);
      const luteal = parseInt(document.getElementById("luteal-days").value, 10);
      const last = document.getElementById("last-period-start").value || null;
      if (cycle >= 21 && cycle <= 45) settings.cycleLength = cycle;
      if (period >= 3 && period <= 10) settings.periodLength = period;
      if (luteal >= 10 && luteal <= 18) settings.lutealPhaseDays = luteal;
      settings.lastPeriodStart = last;
      saveSettings();
      initSettingsForm();
      document.getElementById("settings-msg").textContent = "保存しました。";
      document.getElementById("settings-msg").className = "msg success";
      renderDashboard();
      renderCalendar();
    });

    document.getElementById("export-data-btn").addEventListener("click", exportData);
    document.getElementById("backup-btn").addEventListener("click", backupData);

    const importDataBtn = document.getElementById("import-data-btn");
    const importDataFile = document.getElementById("import-data-file");
    if (importDataBtn && importDataFile) {
      importDataBtn.addEventListener("click", function () {
        importDataFile.value = "";
        importDataFile.click();
      });
      importDataFile.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          importData(reader.result);
        };
        reader.onerror = function () {
          const msgEl = document.getElementById("import-data-msg");
          if (msgEl) {
            msgEl.textContent = "ファイルを読めませんでした。";
            msgEl.className = "msg error";
          }
        };
        reader.readAsText(file, "UTF-8");
        this.value = "";
      });
    }

    const shareUrlBtn = document.getElementById("share-url-btn");
    const shareUrlOutput = document.getElementById("share-url-output");
    const shareUrlMsg = document.getElementById("share-url-msg");
    if (shareUrlBtn && shareUrlOutput) {
      shareUrlBtn.addEventListener("click", function () {
        const result = buildShareUrl();
        if (result.error) {
          if (shareUrlMsg) {
            shareUrlMsg.textContent = result.error;
            shareUrlMsg.className = "msg error";
          }
          shareUrlOutput.value = "";
          return;
        }
        shareUrlOutput.value = result.url;
        if (shareUrlMsg) {
          shareUrlMsg.textContent = "";
          shareUrlMsg.className = "msg";
        }
        try {
          navigator.clipboard.writeText(result.url);
          if (shareUrlMsg) {
            shareUrlMsg.textContent = "URLをコピーしました。このURLをスマホで開いてください。";
            shareUrlMsg.className = "msg success";
          }
        } catch (_) {
          if (shareUrlMsg) {
            shareUrlMsg.textContent = "上のURLをコピーしてスマホで開いてください。";
            shareUrlMsg.className = "msg success";
          }
        }
      });
    }

    const visitPhotoBtn = document.getElementById("visit-results-photo-btn");
    if (visitPhotoBtn) visitPhotoBtn.addEventListener("click", function () {
      const input = document.getElementById("visit-results-photo");
      if (input) input.click();
    });
    const visitPhotoInput = document.getElementById("visit-results-photo");
    if (visitPhotoInput) visitPhotoInput.addEventListener("change", function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        visitPendingPhoto = reader.result;
        const preview = document.getElementById("visit-results-photo-preview");
        if (preview) {
          preview.innerHTML = "<img src=\"" + visitPendingPhoto + "\" alt=\"検査結果\" class=\"visit-photo-thumb\" /><button type=\"button\" class=\"visit-photo-remove\">削除</button>";
          const rm = preview.querySelector(".visit-photo-remove");
          if (rm) rm.addEventListener("click", function () {
            visitPendingPhoto = null;
            preview.innerHTML = "";
            if (visitPhotoInput) visitPhotoInput.value = "";
          });
        }
      };
      reader.readAsDataURL(file);
      this.value = "";
    });
    const visitAddBtn = document.getElementById("visit-add-btn");
    if (visitAddBtn) visitAddBtn.addEventListener("click", function () {
      const dateEl = document.getElementById("visit-date");
      const contentEl = document.getElementById("visit-content");
      const resultsEl = document.getElementById("visit-results");
      const date = (dateEl && dateEl.value) || formatDate(new Date());
      const content = (contentEl && contentEl.value) ? contentEl.value.trim() : "";
      const results = (resultsEl && resultsEl.value) ? resultsEl.value.trim() : "";
      if (!content && !results && !visitPendingPhoto) return;
      visitRecords.unshift({
        date: date,
        content: content || "",
        results: results || "",
        resultsPhoto: visitPendingPhoto || null,
      });
      visitPendingPhoto = null;
      const preview = document.getElementById("visit-results-photo-preview");
      if (preview) preview.innerHTML = "";
      const vpInput = document.getElementById("visit-results-photo");
      if (vpInput) vpInput.value = "";
      visitRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      saveVisits();
      if (contentEl) contentEl.value = "";
      if (resultsEl) resultsEl.value = "";
      renderVisitsView();
    });
    const visitDateEl = document.getElementById("visit-date");
    if (visitDateEl && !visitDateEl.value) visitDateEl.value = formatDate(new Date());

    document.getElementById("day-record-close").addEventListener("click", function () {
      saveDayRecordBBT();
      closeDayRecordModal();
    });
    document.getElementById("day-record-save").addEventListener("click", saveDayRecord);
    document.querySelector(".day-record-backdrop").addEventListener("click", function () {
      saveDayRecordBBT();
      closeDayRecordModal();
    });
    const ovulationPhotoBtn = document.getElementById("day-record-ovulation-photo-btn");
    if (ovulationPhotoBtn) ovulationPhotoBtn.addEventListener("click", function () {
      const input = document.getElementById("day-record-ovulation-photo");
      if (input) input.click();
    });
    const ovulationPhotoInput = document.getElementById("day-record-ovulation-photo");
    if (ovulationPhotoInput) ovulationPhotoInput.addEventListener("change", function () {
      const dateStr = document.getElementById("day-record-date").value;
      const file = this.files && this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        setOvulationPhoto(dateStr, reader.result);
        renderDayRecordForm(dateStr);
      };
      reader.readAsDataURL(file);
      this.value = "";
    });
    document.getElementById("day-record-med-add").addEventListener("click", function () {
      const dateStr = document.getElementById("day-record-date").value;
      const input = document.getElementById("day-record-med-input");
      const name = (input.value || "").trim();
      if (name) {
        medicationRecords.push({ date: dateStr, name: name });
        saveMedications();
        input.value = "";
        renderDayRecordForm(dateStr);
      }
    });

    document.getElementById("today-ai-btn").addEventListener("click", async function () {
      const contentEl = document.getElementById("today-ai-advice");
      const msgEl = document.getElementById("today-ai-msg");
      const btnEl = document.getElementById("today-ai-btn");
      contentEl.textContent = "表示中...";
      contentEl.classList.add("loading");
      msgEl.textContent = "";
      try {
        const userContent = buildTodayContext();
        const reply = await callAI([
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ]);
        contentEl.textContent = reply;
        contentEl.classList.remove("loading");
        msgEl.textContent = "";
        btnEl.textContent = "アドバイスを再表示";
      } catch (e) {
        contentEl.textContent = "";
        contentEl.classList.remove("loading");
        msgEl.textContent = e.message || "エラーが発生しました。設定でAPIキーを確認してください。";
        msgEl.className = "msg error";
      }
    });

    document.getElementById("chat-send-btn").addEventListener("click", sendChatMessage);
    document.getElementById("chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    document.getElementById("chat-clear-btn").addEventListener("click", function () {
      chatHistory = [];
      saveChatHistory();
      renderChatView();
    });

    document.getElementById("save-ai-settings-btn").addEventListener("click", function () {
      aiSettings.provider = document.getElementById("ai-provider").value || "openai";
      aiSettings.apiKey = document.getElementById("ai-api-key").value || "";
      aiSettings.model = document.getElementById("ai-model").value.trim() || (aiSettings.provider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");
      saveAISettings();
      initAISettingsForm();
      const msgEl = document.getElementById("ai-settings-msg");
      msgEl.textContent = "保存しました。";
      msgEl.className = "msg success";
    });

    const aiResetBtn = document.getElementById("ai-reset-key-btn");
    if (aiResetBtn) {
      aiResetBtn.addEventListener("click", function () {
        aiSettings.apiKey = "";
        saveAISettings();
        const keyInput = document.getElementById("ai-api-key");
        if (keyInput) keyInput.value = "";
        const msgEl = document.getElementById("ai-settings-msg");
        if (msgEl) {
          msgEl.textContent = "APIキーをリセットしました。";
          msgEl.className = "msg success";
        }
      });
    }

    const recordBbtBtn = document.getElementById("record-bbt-btn");
    if (recordBbtBtn) recordBbtBtn.addEventListener("click", function () {
      const value = roundBBT(document.getElementById("record-bbt").value);
      if (value == null) return;
      const dateStr = formatDate(new Date());
      const existing = bbtRecords.findIndex((r) => r.date === dateStr);
      if (existing >= 0) bbtRecords[existing].value = value;
      else bbtRecords.push({ date: dateStr, value });
      saveBBT();
      renderRecordView();
      renderCalendar();
    });

    const recordTimingBtn = document.getElementById("record-timing-btn");
    if (recordTimingBtn) recordTimingBtn.addEventListener("click", function () {
      const dateStr = formatDate(new Date());
      const idx = timingRecords.findIndex((r) => r.date === dateStr);
      if (idx >= 0) {
        timingRecords.splice(idx, 1);
      } else {
        timingRecords.push({ date: dateStr, memo: "" });
      }
      saveRecords();
      renderRecordView();
      renderCalendar();
    });

    document.getElementById("save-bbt-btn").addEventListener("click", function () {
      const value = roundBBT(document.getElementById("quick-bbt").value);
      if (value == null) {
        document.getElementById("quick-bbt-msg").textContent = "35.00～40.00の範囲で入力してください。";
        document.getElementById("quick-bbt-msg").className = "msg error";
        return;
      }
      const date = formatDate(new Date());
      const existing = bbtRecords.findIndex((r) => r.date === date);
      if (existing >= 0) bbtRecords[existing].value = value;
      else bbtRecords.push({ date, value });
      saveBBT();
      document.getElementById("quick-bbt").value = "";
      document.getElementById("quick-bbt-msg").textContent = "記録しました。";
      document.getElementById("quick-bbt-msg").className = "msg success";
      renderBBTList();
      renderBBTChart();
    });

    document.getElementById("add-bbt-btn").addEventListener("click", function () {
      const date = document.getElementById("bbt-date").value;
      const value = roundBBT(document.getElementById("bbt-value").value);
      if (!date || value == null) return;
      const existing = bbtRecords.findIndex((r) => r.date === date);
      if (existing >= 0) bbtRecords[existing].value = value;
      else bbtRecords.push({ date, value });
      bbtRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      saveBBT();
      document.getElementById("bbt-date").value = "";
      document.getElementById("bbt-value").value = "";
      renderBBTList();
      renderBBTChart();
    });

    const todayStr = formatDate(new Date());
    document.getElementById("bbt-date").value = todayStr;

    const bbtImageBtn = document.getElementById("bbt-from-image-btn");
    const bbtImageInput = document.getElementById("bbt-screenshot-input");
    const bbtImageMsgEl = document.getElementById("bbt-from-image-msg");
    if (bbtImageBtn && bbtImageInput) {
      bbtImageBtn.addEventListener("click", function () {
        if (!window.Tesseract) {
          if (bbtImageMsgEl) {
            bbtImageMsgEl.textContent = "画像から読み取る機能を利用できません。ネットワーク環境を確認して、もう一度開き直してください。";
            bbtImageMsgEl.className = "msg error";
          }
          return;
        }
        bbtImageInput.value = "";
        bbtImageInput.click();
      });
      bbtImageInput.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (!file) return;
        const msgFn = function (text) {
          if (bbtImageMsgEl) {
            bbtImageMsgEl.textContent = text;
            bbtImageMsgEl.className = "msg";
          }
        };
        recognizeBBTFromImage(file, msgFn).then(function (value) {
          if (value == null) return;
          const dateInput = document.getElementById("bbt-date");
          const valInput = document.getElementById("bbt-value");
          if (dateInput && !dateInput.value) dateInput.value = formatDate(new Date());
          if (valInput) valInput.value = value.toFixed(2);
        });
        this.value = "";
      });
    }

    renderDashboard();
    renderCalendar();
    renderBBTList();
    renderBBTChart();
  }

  init();
})();
