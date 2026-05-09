function toLocalISO(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalISO(date);
}

const todayDate = new Date();
const todayISO = toLocalISO(todayDate);
const currentMonth = todayISO.slice(0, 7);

const defaultAppearance = {
  backgroundColor: "#f3f4f6",
  panelColor: "#ffffff",
  heroBgColor: "#eff6ff",
  iconBgColor: "#e0e7ff",
  splashBgColor: "#ffffff",
  splashFontColor: "#3b82f6",
  fontColor: "#111827",
  mutedFontColor: "#6b7280",
  categoryFontColor: "#2563eb",
  backgroundImage: "",
};

const defaultPeriod = {
  mode: "natural",
  start: todayISO,
  end: todayISO,
};

const defaultCategories = {
  expense: [
    { name: "餐饮", icon: "食" },
    { name: "交通", icon: "行" },
    { name: "购物", icon: "购" },
    { name: "住房", icon: "住" },
    { name: "娱乐", icon: "乐" },
    { name: "医疗", icon: "医" },
    { name: "学习", icon: "学" },
    { name: "其他", icon: "其" },
  ],
  income: [
    { name: "工资", icon: "薪" },
    { name: "奖金", icon: "奖" },
    { name: "兼职", icon: "兼" },
    { name: "其他", icon: "其" },
  ],
};

const sampleRecords = [
  { id: 1, type: "expense", amount: 28.5, category: "餐饮", icon: "食", note: "午餐", date: todayISO },
  { id: 2, type: "expense", amount: 12, category: "交通", icon: "行", note: "地铁", date: todayISO },
  { id: 3, type: "income", amount: 8000, category: "工资", icon: "薪", note: "本月工资", date: daysAgo(2) },
  { id: 4, type: "expense", amount: 236, category: "购物", icon: "购", note: "生活用品", date: daysAgo(4) },
  { id: 5, type: "expense", amount: 98, category: "娱乐", icon: "乐", note: "电影", date: daysAgo(6) },
];

const state = {
  records: readJSON("haji_records", sampleRecords),
  categories: readJSON("haji_categories", defaultCategories),
  budget: Number(localStorage.getItem("haji_budget") || 5000),
  currentType: "expense",
  currentCategory: "餐饮",
  editingId: null,
  managingType: "expense",
  statsType: "expense",
  chartType: "bar",
  statsRange: "period",
  billCustomRange: { start: "", end: "" },
  statsCustomRange: { start: "", end: "" },
  appearance: readJSON("haji_appearance", defaultAppearance),
  period: readJSON("haji_period", defaultPeriod),
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (!value) return clone(fallback);
    return typeof value === "object" && !Array.isArray(value) ? { ...clone(fallback), ...value } : value;
  } catch {
    return clone(fallback);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveState() {
  localStorage.setItem("haji_records", JSON.stringify(state.records));
  localStorage.setItem("haji_categories", JSON.stringify(state.categories));
  localStorage.setItem("haji_appearance", JSON.stringify(state.appearance));
  localStorage.setItem("haji_period", JSON.stringify(state.period));
  localStorage.setItem("haji_budget", String(state.budget));
  localStorage.setItem("haji_billCustomRange", JSON.stringify(state.billCustomRange));
  localStorage.setItem("haji_statsCustomRange", JSON.stringify(state.statsCustomRange));
}

function money(value) {
  return formatter.format(Number(value) || 0);
}

function naturalPeriodRange() {
  const [year, month] = currentMonth.split("-").map(Number);
  return {
    start: `${currentMonth}-01`,
    end: toLocalISO(new Date(year, month, 0)),
  };
}

function periodRange() {
  if (state.period.mode === "custom" && state.period.start && state.period.end) {
    return {
      start: state.period.start,
      end: state.period.end,
    };
  }
  return naturalPeriodRange();
}

function inCurrentPeriod(record) {
  const range = periodRange();
  return record.date >= range.start && record.date <= range.end;
}

function getMonthRecords() {
  return state.records.filter(inCurrentPeriod);
}

function customRangeIsValid(range) {
  return Boolean(range.start && range.end && range.start <= range.end);
}

function recordsForRange(range, customRange = null) {
  if (range === "all") return state.records;
  if (range === "custom") {
    if (!customRangeIsValid(customRange || {})) return [];
    return state.records.filter((record) => record.date >= customRange.start && record.date <= customRange.end);
  }
  return getMonthRecords();
}

function daysForStatsRange(range, records) {
  if (range !== "all") return daysInCurrentPeriod();
  if (!records.length) return 1;
  const dates = records.map((record) => record.date).sort();
  const start = new Date(`${dates[0]}T00:00:00`);
  const end = new Date(`${dates[dates.length - 1]}T00:00:00`);
  return Math.max(Math.round((end - start) / 86400000) + 1, 1);
}

function totals() {
  return getMonthRecords().reduce(
    (acc, record) => {
      acc[record.type] += Number(record.amount);
      return acc;
    },
    { expense: 0, income: 0 }
  );
}

function daysInCurrentPeriod() {
  const range = periodRange();
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  return Math.max(days, 1);
}

function daysLeftInCurrentPeriod() {
  const range = periodRange();
  const today = new Date(`${todayISO}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  // 如果今天已经超过了结束日期，剩余天数为1（避免除以0）
  if (today > end) return 1;
  // 如果今天还没到开始日期，剩余天数等于总天数
  const start = new Date(`${range.start}T00:00:00`);
  if (today < start) return daysInCurrentPeriod();
  
  const daysLeft = Math.round((end - today) / 86400000) + 1;
  return Math.max(daysLeft, 1);
}

function getEffectiveBudget() {
  const expenseCategories = state.categories.expense || [];
  const categoryBudgetSum = expenseCategories.reduce((sum, cat) => sum + Number(cat.budget || 0), 0);
  return categoryBudgetSum > 0 ? categoryBudgetSum : (state.budget || 0);
}

function dailyBudget() {
  const totalB = getEffectiveBudget();
  if (!totalB) return 0;
  // 计算当前周期内的总支出
  const expenseTotal = totals().expense;
  // 计算剩余预算
  const left = Math.max(totalB - expenseTotal, 0);
  // 动态计算：剩余预算 / 剩余天数
  return left / daysLeftInCurrentPeriod();
}

function todayExpense() {
  return state.records
    .filter((record) => record.type === "expense" && record.date === todayISO && !record.excluded)
    .reduce((sum, record) => sum + Number(record.amount), 0);
}

function checkDailyBudgetReminder() {
  const limit = dailyBudget();
  const spent = todayExpense();
  if (!limit || spent <= limit) return;
  alert(`今日有效支出 ${money(spent)} 已超过今日可用余额 ${money(limit)}，建议放慢一点。`);
}

function sortedRecords(records = state.records) {
  return [...records].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
}

function getCategory(type, name) {
  return state.categories[type].find((category) => category.name === name);
}

function setType(type) {
  state.currentType = type;
  const categories = state.categories[type];
  if (!getCategory(type, state.currentCategory)) {
    state.currentCategory = categories[0]?.name || "其他";
  }
  $$(".segmented [data-type]").forEach((button) => button.classList.toggle("active", button.dataset.type === type));
  renderCategories();
}

function renderMonthLabel() {
  const range = periodRange();
  const label = state.period.mode === "natural" ? "自然月账本" : `${range.start} 至 ${range.end}`;
  $("#monthLabel").textContent = label;
  $("#settingsPeriod").textContent = state.period.mode === "natural" ? "自然月" : "自定义";
}

function renderOverview() {
  const total = totals();
  const balance = total.income - total.expense;
  const currentB = getEffectiveBudget();
  const left = Math.max(currentB - total.expense, 0);
  const percent = currentB ? Math.min((total.expense / currentB) * 100, 100) : 0;

  $("#monthExpense").textContent = money(total.expense);
  $("#monthIncome").textContent = money(total.income);
  $("#monthBalance").textContent = money(balance);
  $("#heroBudgetBalance").textContent = money(left);
  $("#budgetUsedText").textContent = `已用 ${money(total.expense)}`;
  $("#budgetLeftText").textContent = `剩余 ${money(left)} / 剩 ${daysLeftInCurrentPeriod()} 天`;
  $("#dailyBudgetText").textContent = `今日可用 ${money(dailyBudget())}`;
  $("#todayExpenseText").textContent = `今日支出 ${money(todayExpense())}`;
  $("#budgetProgress").style.width = `${percent}%`;
  $("#settingsBudget").textContent = money(currentB);
}

function recordTemplate(record) {
  const sign = record.type === "income" ? "+" : "-";
  return `
    <article class="record-item">
      <button type="button" data-edit-record="${record.id}" aria-label="编辑${record.category}">
        <div class="record-icon">${record.icon || "其"}</div>
        <div class="record-main">
          <strong>${record.category}${record.excluded ? '<span class="excluded-tag">不计入</span>' : ''}</strong>
          <span>${record.date}${record.note ? ` · ${record.note}` : ""}</span>
        </div>
        <div class="record-amount ${record.type}">${sign}${money(record.amount)}</div>
      </button>
    </article>
  `;
}

function renderRecords() {
  const recent = sortedRecords(state.records).slice(0, 5);
  $("#recentList").innerHTML = recent.length
    ? recent.map(recordTemplate).join("")
    : `<div class="empty-state">还没有账单，先记一笔吧。</div>`;

  const range = $("#billRangeFilter").value;
  $("#billCustomRange").classList.toggle("hidden", range !== "custom");
  $("#billStartDate").value = state.billCustomRange.start;
  $("#billEndDate").value = state.billCustomRange.end;
  const records = sortedRecords(recordsForRange(range, state.billCustomRange));
  const filter = $("#billFilter").value;
  const keyword = $("#billSearch").value.trim().toLowerCase();
  const filtered = records.filter((record) => {
    const matchType = filter === "all" || record.type === filter;
    const text = `${record.category} ${record.note || ""}`.toLowerCase();
    return matchType && (!keyword || text.includes(keyword));
  });
  const invalidCustomRange = range === "custom" && !customRangeIsValid(state.billCustomRange);
  $("#billList").innerHTML = invalidCustomRange
    ? `<div class="empty-state">请选择有效的开始日期和结束日期。</div>`
    : filtered.length
      ? filtered.map(recordTemplate).join("")
      : `<div class="empty-state">当前筛选下没有账单。</div>`;
}

function renderStats() {
  $("#statsRangeFilter").value = state.statsRange;
  $("#statsCustomRange").classList.toggle("hidden", state.statsRange !== "custom");
  $("#statsStartDate").value = state.statsCustomRange.start;
  $("#statsEndDate").value = state.statsCustomRange.end;
  
  $$("#statsTypeSegmented [data-stats-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.statsType === state.statsType);
  });
  
  const typeLabel = state.statsType === "expense" ? "支出" : "收入";
  $("#statsTopLabel").textContent = `最大${typeLabel}`;
  $("#statsDailyLabel").textContent = `日均${typeLabel}`;
  $("#statsChartTitle").textContent = `${typeLabel}可视化`;

  const rangeRecords = recordsForRange(state.statsRange, state.statsCustomRange);
  const filteredRecords = rangeRecords.filter((record) => record.type === state.statsType && !record.excluded);
  const categoryTotals = filteredRecords.reduce((acc, record) => {
    acc[record.category] = (acc[record.category] || 0) + Number(record.amount);
    return acc;
  }, {});
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const max = entries[0];
  const recordTotal = filteredRecords.reduce((sum, record) => sum + Number(record.amount), 0);
  const colors = ["#1f9d7a", "#f3bc45", "#ee6a70", "#4e7dd9", "#8b6ee8", "#37a7a3", "#dd8a3d", "#6d7773"];

  const invalidCustomRange = state.statsRange === "custom" && !customRangeIsValid(state.statsCustomRange);
  $("#topCategory").textContent = invalidCustomRange ? "日期无效" : max ? `${max[0]} ${money(max[1])}` : "暂无";
  $("#dailyAverage").textContent = money(recordTotal / daysForStatsRange(state.statsRange, rangeRecords));
  $("#categoryBars").innerHTML = entries.length
    ? entries
        .map(([name, value], index) => {
          const width = recordTotal ? Math.max((value / recordTotal) * 100, 4) : 0;
          return `
            <div class="bar-row">
              <div class="bar-label"><span>${name}</span><strong>${money(value)}</strong></div>
              <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${colors[index % colors.length]}"></div></div>
            </div>
          `;
        })
        .join("")
    : invalidCustomRange
      ? `<div class="empty-state">请选择有效的开始日期和结束日期。</div>`
      : `<div class="empty-state">有${typeLabel}后会显示分类占比。</div>`;
  renderPieChart(entries, recordTotal, colors, typeLabel);
  renderChartMode();
}

function renderPieChart(entries, expenseTotal, colors, typeLabel = "支出") {
  if (!entries.length || !expenseTotal) {
    $("#pieChart").style.background = "var(--line)";
    $("#pieLegend").innerHTML = `<div class="empty-state">有${typeLabel}后会显示饼图。</div>`;
    return;
  }

  let cursor = 0;
  const slices = entries.map(([name, value], index) => {
    const start = cursor;
    const angle = (value / expenseTotal) * 360;
    cursor += angle;
    return `${colors[index % colors.length]} ${start}deg ${cursor}deg`;
  });
  $("#pieChart").style.background = `conic-gradient(${slices.join(", ")})`;
  $("#pieLegend").innerHTML = entries
    .map(([name, value], index) => {
      const percent = Math.round((value / expenseTotal) * 100);
      return `
        <div class="pie-legend-item">
          <span class="pie-swatch" style="background:${colors[index % colors.length]}"></span>
          <span>${name}</span>
          <strong>${percent}% · ${money(value)}</strong>
        </div>
      `;
    })
    .join("");
}

function renderChartMode() {
  $("[data-chart='bar']").classList.toggle("active", state.chartType === "bar");
  $("[data-chart='pie']").classList.toggle("active", state.chartType === "pie");
  $("#categoryBars").classList.toggle("hidden", state.chartType !== "bar");
  $("#piePanel").classList.toggle("hidden", state.chartType !== "pie");
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((value) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(colorA, colorB) {
  const a = relativeLuminance(colorA);
  const b = relativeLuminance(colorB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function applyAppearance() {
  const root = document.documentElement;
  root.style.setProperty("--bg", state.appearance.backgroundColor);
  root.style.setProperty("--panel", state.appearance.panelColor);
  root.style.setProperty("--hero-bg", state.appearance.heroBgColor);
  root.style.setProperty("--mint", state.appearance.iconBgColor);
  root.style.setProperty("--splash-bg", state.appearance.splashBgColor);
  root.style.setProperty("--splash-text", state.appearance.splashFontColor);
  root.style.setProperty("--text", state.appearance.fontColor);
  root.style.setProperty("--muted", state.appearance.mutedFontColor);
  root.style.setProperty("--category-text", state.appearance.categoryFontColor);
  document.body.style.color = state.appearance.fontColor;
  const shell = $(".app-shell");
  if (state.appearance.backgroundImage) {
    shell.style.backgroundImage = `linear-gradient(rgba(234, 248, 254, 0.82), rgba(234, 248, 254, 0.82)), url(${state.appearance.backgroundImage})`;
    shell.style.backgroundSize = "cover";
    shell.style.backgroundPosition = "center";
  } else {
    shell.style.backgroundImage = "";
  }
}

function openAppearanceSettings() {
  $("#backgroundColorInput").value = state.appearance.backgroundColor;
  $("#panelColorInput").value = state.appearance.panelColor || "#ffffff";
  $("#heroBgColorInput").value = state.appearance.heroBgColor || "#eff6ff";
  $("#iconBgColorInput").value = state.appearance.iconBgColor || "#e0e7ff";
  $("#splashBgColorInput").value = state.appearance.splashBgColor || "#ffffff";
  $("#splashFontColorInput").value = state.appearance.splashFontColor || "#3b82f6";
  $("#fontColorInput").value = state.appearance.fontColor;
  $("#mutedFontColorInput").value = state.appearance.mutedFontColor;
  $("#categoryFontColorInput").value = state.appearance.categoryFontColor;
  $("#backgroundImageInput").value = "";
  $("#appearanceModal").showModal();
}

function saveAppearance(event) {
  event.preventDefault();
  const backgroundColor = $("#backgroundColorInput").value;
  const panelColor = $("#panelColorInput").value;
  const heroBgColor = $("#heroBgColorInput").value;
  const iconBgColor = $("#iconBgColorInput").value;
  const splashBgColor = $("#splashBgColorInput").value;
  const splashFontColor = $("#splashFontColorInput").value;
  const fontColor = $("#fontColorInput").value;
  const mutedFontColor = $("#mutedFontColorInput").value;
  const categoryFontColor = $("#categoryFontColorInput").value;
  
  state.appearance.backgroundColor = backgroundColor;
  state.appearance.panelColor = panelColor;
  state.appearance.heroBgColor = heroBgColor;
  state.appearance.iconBgColor = iconBgColor;
  state.appearance.splashBgColor = splashBgColor;
  state.appearance.splashFontColor = splashFontColor;
  state.appearance.fontColor = fontColor;
  state.appearance.mutedFontColor = mutedFontColor;
  state.appearance.categoryFontColor = categoryFontColor;
  saveState();
  applyAppearance();
  $("#appearanceModal").close();
}

function setBackgroundImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    state.appearance.backgroundImage = reader.result;
    saveState();
    applyAppearance();
  };
  reader.readAsDataURL(file);
}

function renderPeriodForm() {
  const range = periodRange();
  $("#periodStartInput").value = range.start;
  $("#periodEndInput").value = range.end;
  $$("#periodModal [data-period-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.periodMode === state.period.mode);
  });
  $("#customPeriodFields").classList.toggle("hidden", state.period.mode !== "custom");
}

function openPeriodSettings() {
  renderPeriodForm();
  $("#periodModal").showModal();
}

function setPeriodMode(mode) {
  state.period.mode = mode;
  if (mode === "custom" && (!state.period.start || !state.period.end)) {
    const range = naturalPeriodRange();
    state.period.start = range.start;
    state.period.end = range.end;
  }
  renderPeriodForm();
}

function savePeriod(event) {
  event.preventDefault();
  if (state.period.mode === "custom") {
    const start = $("#periodStartInput").value;
    const end = $("#periodEndInput").value;
    if (!start || !end || start > end) {
      alert("请设置有效的开始日期和结束日期。");
      return;
    }
    state.period.start = start;
    state.period.end = end;
  }
  saveState();
  renderAll();
  $("#periodModal").close();
  checkDailyBudgetReminder();
}

function renderCategories() {
  const categories = state.categories[state.currentType];
  $("#categoryGrid").innerHTML = categories
    .map(
      (category) => `
        <button type="button" class="${category.name === state.currentCategory ? "active" : ""}" data-category="${category.name}" data-icon="${category.icon}">
          <span>${category.icon}</span>${category.name}
        </button>
      `
    )
    .join("");
}

function renderCategoryManager() {
  $$("#categoryModal [data-category-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.categoryType === state.managingType);
  });

  $("#categoryManageList").innerHTML = state.categories[state.managingType]
    .map(
      (category) => `
        <div class="category-manage-item">
          <span>${category.icon}</span>
          <strong>${category.name}</strong>
          ${state.managingType === "expense" ? `<input type="number" class="category-budget-input" data-budget-category="${category.name}" placeholder="预算(可选)" value="${category.budget || ''}" min="0" step="1" />` : `<div></div>`}
          <button type="button" data-remove-category="${category.name}" aria-label="删除${category.name}">×</button>
        </div>
      `
    )
    .join("");
}

function renderAll() {
  renderMonthLabel();
  renderOverview();
  renderRecords();
  renderStats();
}

function switchTab(tab) {
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === tab));
  $$(".tabbar button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
}

function openEntry(record = null) {
  $("#entryForm").reset();
  state.editingId = record?.id || null;
  $("#entryTitle").textContent = record ? "编辑账单" : "记一笔";
  $("#deleteRecord").classList.toggle("hidden", !record);

  const nextType = record?.type || "expense";
  state.currentCategory = record?.category || state.categories[nextType][0]?.name || "其他";
  setType(nextType);

  $("#amountInput").value = record?.amount || "";
  $("#dateInput").value = record?.date || todayISO;
  $("#noteInput").value = record?.note || "";
  $("#excludedInput").checked = record?.excluded || false;
  $("#entryModal").showModal();
  $("#amountInput").focus();
}

function saveRecord(event) {
  event.preventDefault();
  const categoryButton = $(`#categoryGrid button[data-category="${CSS.escape(state.currentCategory)}"]`);
  const payload = {
    type: state.currentType,
    amount: Number($("#amountInput").value),
    category: state.currentCategory,
    icon: categoryButton?.dataset.icon || getCategory(state.currentType, state.currentCategory)?.icon || "其",
    note: $("#noteInput").value.trim(),
    date: $("#dateInput").value,
    excluded: $("#excludedInput").checked,
  };

  if (state.editingId) {
    state.records = state.records.map((record) => (record.id === state.editingId ? { ...record, ...payload } : record));
  } else {
    state.records.push({ id: Date.now(), ...payload });
  }

  saveState();
  renderAll();
  $("#entryModal").close();
  switchTab("home");
  
  // 延迟检查预算，让模态框先关闭，并且如果是“不计入”账单，就不检查超支
  if (payload.type === "expense" && payload.date === todayISO && !payload.excluded) {
    setTimeout(checkDailyBudgetReminder, 100);
  }
}

function deleteCurrentRecord() {
  if (!state.editingId) return;
  const record = state.records.find((item) => item.id === state.editingId);
  if (!record || !confirm(`删除这笔「${record.category}」账单？`)) return;
  state.records = state.records.filter((item) => item.id !== state.editingId);
  saveState();
  renderAll();
  $("#entryModal").close();
}

function openCategoryManager() {
  state.managingType = "expense";
  $("#categoryForm").reset();
  renderCategoryManager();
  $("#categoryModal").showModal();
}

function addCategory(event) {
  event.preventDefault();
  const name = $("#newCategoryName").value.trim();
  const icon = $("#newCategoryIcon").value.trim() || name.slice(0, 1) || "新";
  if (!name) return;
  if (state.categories[state.managingType].some((category) => category.name === name)) {
    alert("这个分类已经存在。");
    return;
  }
  state.categories[state.managingType].push({ name, icon });
  saveState();
  $("#categoryForm").reset();
  renderCategoryManager();
  renderCategories();
}

function removeCategory(name) {
  const list = state.categories[state.managingType];
  if (list.length <= 1) {
    alert("至少保留一个分类。");
    return;
  }
  const used = state.records.some((record) => record.type === state.managingType && record.category === name);
  if (used && !confirm("已有账单使用这个分类，删除后这些账单会归到「其他」。继续吗？")) return;

  state.categories[state.managingType] = list.filter((category) => category.name !== name);
  const fallback = state.categories[state.managingType].find((category) => category.name === "其他") || state.categories[state.managingType][0];
  state.records = state.records.map((record) =>
    record.type === state.managingType && record.category === name
      ? { ...record, category: fallback.name, icon: fallback.icon }
      : record
  );
  if (state.currentCategory === name) state.currentCategory = fallback.name;
  saveState();
  renderCategoryManager();
  renderAll();
}

function exportData() {
  const data = {
    app: "轻量记账",
    exportedAt: new Date().toISOString(),
    budget: state.budget,
    categories: state.categories,
    appearance: state.appearance,
    period: state.period,
    records: state.records,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `haji-book-${todayISO}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.records)) throw new Error("records missing");
      state.records = data.records;
      state.categories = data.categories || state.categories;
      state.appearance = data.appearance || state.appearance;
      state.period = data.period || state.period;
      state.budget = Number(data.budget || state.budget);
      saveState();
      applyAppearance();
      renderAll();
      alert("导入完成。");
    } catch {
      alert("导入失败，请选择正确的 JSON 文件。");
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  $$(".tabbar button, [data-tab]").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  $("#addButton").addEventListener("click", () => openEntry());
  $("#closeEntry").addEventListener("click", () => $("#entryModal").close());
  $("#closeBudget").addEventListener("click", () => $("#budgetModal").close());
  $("#closeCategory").addEventListener("click", () => $("#categoryModal").close());
  $("#closeAppearance").addEventListener("click", () => $("#appearanceModal").close());
  $("#closePeriod").addEventListener("click", () => $("#periodModal").close());
  $("#entryForm").addEventListener("submit", saveRecord);
  $("#deleteRecord").addEventListener("click", deleteCurrentRecord);
  $("#billRangeFilter").addEventListener("change", renderRecords);
  $("#billFilter").addEventListener("change", renderRecords);
  $("#billSearch").addEventListener("input", renderRecords);
  
  $("#billStartDate").addEventListener("change", (e) => {
    state.billCustomRange.start = e.target.value;
    renderRecords();
  });
  $("#billEndDate").addEventListener("change", (e) => {
    state.billCustomRange.end = e.target.value;
    renderRecords();
  });

  $("#statsRangeFilter").addEventListener("change", () => {
    state.statsRange = $("#statsRangeFilter").value;
    renderStats();
  });
  
  $$("#statsTypeSegmented [data-stats-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.statsType = button.dataset.statsType;
      renderAll(); // 这里改为 renderAll 或者是 renderStats() 均可，但为了确保所有状态更新，这里使用 renderStats()
    });
  });

  $("#statsStartDate").addEventListener("change", (e) => {
    state.statsCustomRange.start = e.target.value;
    renderStats();
  });
  $("#statsEndDate").addEventListener("change", (e) => {
    state.statsCustomRange.end = e.target.value;
    renderStats();
  });

  $$(".segmented [data-type]").forEach((button) => {
    button.addEventListener("click", () => setType(button.dataset.type));
  });

  $("#categoryGrid").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    state.currentCategory = button.dataset.category;
    renderCategories();
  });

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-record]");
    if (!editButton) return;
    const id = Number(editButton.dataset.editRecord);
    const record = state.records.find((item) => item.id === id);
    if (record) openEntry(record);
  });

  $$("[data-open-budget]").forEach((button) => {
    button.addEventListener("click", () => {
      const expenseCategories = state.categories.expense || [];
      const categoryBudgetSum = expenseCategories.reduce((sum, cat) => sum + Number(cat.budget || 0), 0);
      if (categoryBudgetSum > 0) {
        alert(`当前已开启分类预算，总预算由各分类预算相加得出（共计 ${money(categoryBudgetSum)}）。如需修改，请在“我的 -> 分类管理”中调整各分类的预算金额。`);
        return;
      }
      $("#budgetInput").value = state.budget;
      $("#budgetModal").showModal();
    });
  });

  $("#budgetForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.budget = Number($("#budgetInput").value);
    saveState();
    renderAll();
    $("#budgetModal").close();
    checkDailyBudgetReminder();
  });

  $$("[data-chart]").forEach((button) => {
    button.addEventListener("click", () => {
      state.chartType = button.dataset.chart;
      renderChartMode();
    });
  });

  $("#categoryForm").addEventListener("submit", addCategory);
  $$("#categoryModal [data-category-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.managingType = button.dataset.categoryType;
      renderCategoryManager();
    });
  });
  $("#categoryManageList").addEventListener("change", (event) => {
    if (event.target.classList.contains("category-budget-input")) {
      const name = event.target.dataset.budgetCategory;
      const val = Number(event.target.value) || 0;
      const category = state.categories.expense.find(c => c.name === name);
      if (category) {
        if (val > 0) category.budget = val;
        else delete category.budget;
        saveState();
        renderAll();
      }
    }
  });

  $("#categoryManageList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-category]");
    if (button) removeCategory(button.dataset.removeCategory);
  });

  $("#appearanceSettings").addEventListener("click", openAppearanceSettings);
  $("#appearanceForm").addEventListener("submit", saveAppearance);
  
  $("#confirmBackgroundColor").addEventListener("click", () => {
    state.appearance.backgroundColor = $("#backgroundColorInput").value;
    saveState();
    applyAppearance();
  });
  
  $("#confirmPanelColor").addEventListener("click", () => {
    state.appearance.panelColor = $("#panelColorInput").value;
    saveState();
    applyAppearance();
  });

  $("#confirmHeroBgColor").addEventListener("click", () => {
    state.appearance.heroBgColor = $("#heroBgColorInput").value;
    saveState();
    applyAppearance();
  });

  $("#confirmIconBgColor").addEventListener("click", () => {
    state.appearance.iconBgColor = $("#iconBgColorInput").value;
    saveState();
    applyAppearance();
  });

  $("#confirmSplashBgColor").addEventListener("click", () => {
    state.appearance.splashBgColor = $("#splashBgColorInput").value;
    saveState();
    applyAppearance();
  });

  $("#confirmSplashFontColor").addEventListener("click", () => {
    state.appearance.splashFontColor = $("#splashFontColorInput").value;
    saveState();
    applyAppearance();
  });
  
  $("#confirmFontColor").addEventListener("click", () => {
    state.appearance.fontColor = $("#fontColorInput").value;
    saveState();
    applyAppearance();
  });

  $("#confirmMutedFontColor").addEventListener("click", () => {
    state.appearance.mutedFontColor = $("#mutedFontColorInput").value;
    saveState();
    applyAppearance();
  });

  $("#confirmCategoryFontColor").addEventListener("click", () => {
    state.appearance.categoryFontColor = $("#categoryFontColorInput").value;
    saveState();
    applyAppearance();
  });

  $("#backgroundImageInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) setBackgroundImage(file);
    event.target.value = "";
  });
  $("#clearBackgroundImage").addEventListener("click", () => {
    state.appearance.backgroundImage = "";
    saveState();
    applyAppearance();
  });

  $("#restoreDefaultAppearance").addEventListener("click", () => {
    if (!confirm("确定要恢复默认配色吗？")) return;
    state.appearance = clone(defaultAppearance);
    saveState();
    applyAppearance();
    
    // 更新输入框显示的值
    $("#backgroundColorInput").value = state.appearance.backgroundColor;
    $("#panelColorInput").value = state.appearance.panelColor;
    $("#heroBgColorInput").value = state.appearance.heroBgColor;
    $("#iconBgColorInput").value = state.appearance.iconBgColor;
    $("#splashBgColorInput").value = state.appearance.splashBgColor;
    $("#splashFontColorInput").value = state.appearance.splashFontColor;
    $("#fontColorInput").value = state.appearance.fontColor;
    $("#mutedFontColorInput").value = state.appearance.mutedFontColor;
    $("#categoryFontColorInput").value = state.appearance.categoryFontColor;
  });

  $("#periodSettings").addEventListener("click", openPeriodSettings);
  $("#periodForm").addEventListener("submit", savePeriod);
  $$("#periodModal [data-period-mode]").forEach((button) => {
    button.addEventListener("click", () => setPeriodMode(button.dataset.periodMode));
  });

  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("haji_theme", document.body.classList.contains("dark") ? "dark" : "light");
  });

  $("#manageCategories").addEventListener("click", openCategoryManager);
  $("#exportData").addEventListener("click", exportData);
  $("#importData").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importData(file);
    event.target.value = "";
  });
  $("#privacyLock").addEventListener("click", () => {
    alert("隐私锁需要接入真实 App 容器后启用。");
  });
}

window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("haji_theme") === "dark") document.body.classList.add("dark");
  bindEvents();
  applyAppearance();
  renderCategories();
  renderAll();
  setTimeout(() => $("#splash").classList.add("hidden"), 900);
});

// 注册 Service Worker，使应用成为 PWA 且离线可用
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('SW registered: ', registration);
      
      // 监听新版本的 Service Worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          // 当新版本安装完毕，且接管控制权时，强制刷新页面
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New update available, reloading...');
            window.location.reload();
          }
        });
      });
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
