// 易經卜卦：主程式
// 會用到 hexagrams.js 裡的 TRIGRAMS 和 HEXAGRAMS（index.html 會先載入它）

// ===== 一、基本設定 =====

// 存進瀏覽器 localStorage 時用的名字，像抽屜上的標籤
const HISTORY_KEY = "iching-history"; // 所有完成的占卜
const CURRENT_KEY = "iching-current"; // 正在進行、還沒擲完的那一卦

// 擲三枚銅錢（正面 3、反面 2）的總和只會是 6、7、8、9，各自代表一種爻
const TOSS_INFO = {
  6: { name: "老陰", yang: false, changing: true, coins: ["反", "反", "反"] },
  7: { name: "少陽", yang: true, changing: false, coins: ["正", "反", "反"] },
  8: { name: "少陰", yang: false, changing: false, coins: ["正", "正", "反"] },
  9: { name: "老陽", yang: true, changing: true, coins: ["正", "正", "正"] },
};

// ===== 二、讀寫 localStorage（重新整理後資料不會消失的關鍵） =====

function loadJSON(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch (error) {
    return fallback; // 讀不到（例如瀏覽器封鎖儲存、內容壞掉）就用預設值
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 存不進去時不讓網頁壞掉，只是重新整理後這筆資料會不見
  }
}

// 檢查擲出的結果是不是合理的數字（6～9），避免壞掉的資料讓網頁出錯
function isValidTosses(tosses) {
  return Array.isArray(tosses) && tosses.length <= 6 && tosses.every((t) => TOSS_INFO[t]);
}

function loadHistory() {
  const list = loadJSON(HISTORY_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter((record) => record && isValidTosses(record.tosses) && record.tosses.length === 6);
}

function saveHistory() {
  saveJSON(HISTORY_KEY, records);
}

function loadCurrent() {
  const saved = loadJSON(CURRENT_KEY, null);
  if (saved && typeof saved.question === "string" && isValidTosses(saved.tosses)) return saved;
  return { question: "", tosses: [] };
}

function saveCurrent() {
  saveJSON(CURRENT_KEY, current);
}

// 網頁一打開就把資料讀出來
let records = loadHistory(); // 歷史紀錄（不取名 history，因為瀏覽器已經有內建的 history）
let current = loadCurrent();

// ===== 三、起卦與算卦 =====

// 擲一次三枚銅錢，回傳總和（6、7、8 或 9）
function tossCoins() {
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    sum += Math.random() < 0.5 ? 3 : 2; // 一半機率正面（3），一半反面（2）
  }
  return sum;
}

// 用六爻字串（例如 "111111"）找出是哪一卦
function findHexagram(lines) {
  return HEXAGRAMS.find((hex) => hex.lines === lines);
}

// 把六次擲出的數字，算成本卦、變爻和變卦
function buildReading(tosses) {
  const originalLines = tosses.map((t) => (TOSS_INFO[t].yang ? "1" : "0")).join("");

  // 變卦：變爻陰陽互換，其他爻不變
  const changedLines = tosses
    .map((t) => {
      const info = TOSS_INFO[t];
      const yang = info.changing ? !info.yang : info.yang;
      return yang ? "1" : "0";
    })
    .join("");

  // 記下哪幾爻是變爻（0 = 初爻，5 = 上爻）
  const changingLines = [];
  tosses.forEach((t, i) => {
    if (TOSS_INFO[t].changing) changingLines.push(i);
  });

  return {
    original: findHexagram(originalLines),
    changed: changingLines.length > 0 ? findHexagram(changedLines) : null,
    changingLines: changingLines,
  };
}

// 爻的名稱：陽爻叫「九」、陰爻叫「六」，位置由下往上是初、二、三、四、五、上
function lineLabel(position, isYang) {
  const num = isYang ? "九" : "六";
  if (position === 0) return "初" + num;
  if (position === 5) return "上" + num;
  return num + ["", "二", "三", "四", "五"][position];
}

// 卦的全名，例如「乾為天」「水雷屯」（上卦的象 + 下卦的象 + 卦名）
function fullName(hex) {
  const lower = TRIGRAMS[hex.lines.slice(0, 3)];
  const upper = TRIGRAMS[hex.lines.slice(3)];
  if (lower === upper) return upper.name + "為" + upper.nature;
  return upper.nature + lower.nature + hex.name;
}

// 卦的符號（Unicode 裡 64 卦依卦序排好，從 ䷀ 開始）
function hexSymbol(hex) {
  return String.fromCodePoint(0x4dc0 + hex.number - 1);
}

// 依變爻數量，提示該看哪一段（參考朱熹的占法，簡化版）
function readingHint(reading) {
  const count = reading.changingLines.length;
  if (count === 0) return "沒有變爻：以本卦的卦辭為主。";
  if (count === 1) return "一個變爻：以這一爻的爻辭為主。";
  if (count === 2) return "兩個變爻：兩條爻辭都看，以上面那一爻為主。";
  if (count === 3) return "三個變爻：本卦和變卦的卦辭一起看，以本卦為主。";
  if (count === 6 && reading.original.allChange) {
    return "六爻全變：以「" + reading.original.allChange.label + "」為主。";
  }
  return "變爻較多：以變卦的卦辭為主。";
}

// ===== 四、產生畫面用的 HTML =====

// 把 < > & 等符號轉成安全寫法，避免使用者輸入的文字被當成 HTML 執行
function escapeHTML(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

// 畫出六條爻線。由上往下畫，因為第一爻（初爻）在最下面
// detailed = true 時，左右兩邊加上爻名和擲出的結果
function linesHTML(tosses, detailed) {
  let html = "";
  for (let i = 5; i >= 0; i--) {
    const toss = tosses[i];

    if (toss === undefined) {
      // 還沒擲到的位置，畫一個虛線框
      html += detailed
        ? `<div class="line-row"><span class="line-label"></span><div class="line empty"></div><span class="line-note"></span></div>`
        : `<div class="line-row"><div class="line empty"></div></div>`;
      continue;
    }

    const info = TOSS_INFO[toss];
    const lineClass = "line " + (info.yang ? "yang" : "yin") + (info.changing ? " changing" : "");
    const bars = info.yang ? "<span></span>" : "<span></span><span></span>";

    html += `<div class="line-row">`;
    if (detailed) html += `<span class="line-label">${lineLabel(i, info.yang)}</span>`;
    html += `<div class="${lineClass}">${bars}</div>`;
    if (detailed) {
      const noteClass = "line-note" + (info.changing ? " changing" : "");
      html += `<span class="${noteClass}">${info.name}${info.changing ? "・變" : ""}</span>`;
    }
    html += `</div>`;
  }
  return html;
}

// 變卦沒有「老/少」之分，把六爻字串轉成不變的爻（7 = 少陽、8 = 少陰）來畫
function linesToTosses(lines) {
  return lines.split("").map((bit) => (bit === "1" ? 7 : 8));
}

// 本卦或變卦的小卡片：卦圖、符號、全名、卦序
function hexCardHTML(title, hex, tosses) {
  return `
    <div class="hex-card">
      <div class="hex-card-title">${title}</div>
      <div class="lines small">${linesHTML(tosses, false)}</div>
      <div class="hex-card-name">${hexSymbol(hex)} ${fullName(hex)}</div>
      <div class="hex-card-number">第 ${hex.number} 卦</div>
    </div>`;
}

// 一卦的卦辭原文和白話說明
function hexTextHTML(title, hex) {
  return `
    <section class="text-block">
      <h3>${title}：${fullName(hex)}</h3>
      <p class="classic">${hex.name}：${hex.judgment}</p>
      <p>${hex.meaning}</p>
    </section>`;
}

// 完整的解釋：問題、卦圖、解讀重點、本卦、變爻、變卦
function readingHTML(question, tosses) {
  const reading = buildReading(tosses);
  const original = reading.original;
  const changed = reading.changed;

  let html = `<p class="asked">問：${escapeHTML(question)}</p>`;

  html += `<div class="hex-pair">`;
  html += hexCardHTML("本卦", original, tosses);
  if (changed) {
    html += `<div class="arrow">→</div>`;
    html += hexCardHTML("變卦", changed, linesToTosses(changed.lines));
  }
  html += `</div>`;

  html += `<p class="hint">解讀重點：${readingHint(reading)}</p>`;
  html += hexTextHTML("本卦", original);

  if (reading.changingLines.length > 0) {
    html += `<section class="text-block"><h3>變爻</h3>`;
    reading.changingLines.forEach((i) => {
      const isYang = TOSS_INFO[tosses[i]].yang;
      html += `<p class="classic changing">${lineLabel(i, isYang)}：${original.yao[i]}</p>`;
    });
    // 乾、坤六爻全變時，多看「用九」或「用六」
    if (reading.changingLines.length === 6 && original.allChange) {
      html += `<p class="classic changing">${original.allChange.label}：${original.allChange.text}</p>`;
    }
    html += `</section>`;
    html += hexTextHTML("變卦", changed);
  }

  return html;
}

// ===== 五、把資料畫到頁面上 =====

const questionInput = document.getElementById("question");
const coinsBox = document.getElementById("coins");
const linesBox = document.getElementById("lines");
const tossButton = document.getElementById("toss-btn");
const resetButton = document.getElementById("reset-btn");
const resultBox = document.getElementById("result");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const clearButton = document.getElementById("clear-btn");

// 畫出目前這一卦：問題、銅錢、爻線、按鈕、解釋
function render() {
  const count = current.tosses.length;
  const done = count === 6;

  questionInput.value = current.question;
  questionInput.disabled = count > 0; // 開始擲銅錢後，問題就不能再改

  // 銅錢：顯示最近一次擲出的三枚
  if (count === 0) {
    coinsBox.innerHTML = `<p class="help">準備好了就按「擲銅錢」。</p>`;
  } else {
    const last = current.tosses[count - 1];
    const info = TOSS_INFO[last];
    const coins = info.coins
      .map((face) => `<span class="coin ${face === "正" ? "heads" : "tails"}">${face}</span>`)
      .join("");
    coinsBox.innerHTML = `${coins}<span class="coin-sum">= ${last}（${info.name}）</span>`;
  }

  linesBox.innerHTML = linesHTML(current.tosses, true);

  tossButton.disabled = done;
  tossButton.textContent = done ? "六爻已完成" : `擲銅錢（第 ${count + 1} 爻）`;
  resetButton.hidden = count === 0;
  resetButton.textContent = done ? "問下一個問題" : "重新開始";

  // 六爻擲完才顯示解釋
  resultBox.hidden = !done;
  resultBox.innerHTML = done ? `<h2>三、卦象解釋</h2>` + readingHTML(current.question, current.tosses) : "";
}

// 畫出歷史紀錄：每筆可以點開看完整解釋
function renderHistory() {
  historyEmpty.hidden = records.length > 0;
  clearButton.hidden = records.length === 0;

  historyList.innerHTML = records
    .map((record) => {
      const reading = buildReading(record.tosses);
      const names = reading.changed
        ? `${reading.original.name} → ${reading.changed.name}`
        : reading.original.name;
      const date = new Date(record.time).toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
        <details class="history-item">
          <summary>
            <span class="history-hex">${names}</span>${escapeHTML(record.question)}
            <span class="history-date">${date}</span>
          </summary>
          <div class="history-body">
            ${readingHTML(record.question, record.tosses)}
            <button class="link delete" data-id="${record.id}">刪除這筆紀錄</button>
          </div>
        </details>`;
    })
    .join("");
}

// ===== 六、按鈕和輸入框的動作 =====

// 每打一個字就存起來，重新整理也不會不見
questionInput.addEventListener("input", () => {
  current.question = questionInput.value;
  saveCurrent();
});

tossButton.addEventListener("click", () => {
  if (current.question.trim() === "") {
    alert("請先寫下你的問題，再開始擲銅錢。");
    questionInput.focus();
    return;
  }

  current.tosses.push(tossCoins());

  // 第六次擲完：存進歷史紀錄（新的放最前面）
  if (current.tosses.length === 6) {
    records.unshift({
      id: Date.now(),
      time: new Date().toISOString(),
      question: current.question.trim(),
      tosses: current.tosses.slice(),
    });
    saveHistory();
    renderHistory();
  }

  saveCurrent();
  render();
});

resetButton.addEventListener("click", () => {
  const done = current.tosses.length === 6;
  if (!done && !confirm("確定要放棄這一卦、重新開始嗎？")) return;

  current = { question: "", tosses: [] };
  saveCurrent();
  render();
  questionInput.focus();
});

// 歷史紀錄裡的「刪除這筆紀錄」按鈕
historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button.delete");
  if (!button) return;
  if (!confirm("確定要刪除這筆紀錄嗎？")) return;

  records = records.filter((record) => String(record.id) !== button.dataset.id);
  saveHistory();
  renderHistory();
});

clearButton.addEventListener("click", () => {
  if (!confirm("確定要刪除全部歷史紀錄嗎？刪除後無法復原。")) return;

  records = [];
  saveHistory();
  renderHistory();
});

// ===== 七、網頁打開時先畫一次 =====
render();
renderHistory();
