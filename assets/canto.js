/* 粤语课程共享组件
 *
 * 1. 点读：任何带 data-say="粤语文字" 的元素，点击即用 zh-HK 语音朗读。
 *    <button class="say-btn" data-say="唔該">🔊</button> 或 <span class="term" data-say="唔該">…</span>
 *    data-rate 可调语速（默认 0.8）。
 *
 * 2. 选择题：
 *    <div class="exercise mcq" data-answer="2">       ← 正确选项的序号（从 1 开始）
 *      <p class="q">题目</p>
 *      <ol class="opts"><li>A</li><li>B</li><li>C</li></ol>
 *      <p class="explain">解析</p>
 *    </div>
 *
 * 3. 粤拼输入题（逐音节反馈：对 / 声调错 / 拼写错）：
 *    <div class="exercise type-quiz" data-answers="ngo5 jiu3|ngo5 jiu3 aa3">  ← 多个可接受答案用 | 分隔
 *      <p class="q">题目</p>
 *    </div>
 *
 * 4. 计分：页面上有 <div class="scorebar"></div> 时，统计"首次作答正确"的题数。
 */
(function () {
  "use strict";

  // ---------- 语音 ----------
  let voice = null;
  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    voice =
      voices.find((v) => /zh[-_]HK/i.test(v.lang)) ||
      voices.find((v) => /yue/i.test(v.lang)) ||
      null;
    const warn = document.querySelector(".voice-warning");
    if (warn && voices.length) warn.classList.toggle("show", !voice);
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function say(text, el, rate) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-HK";
    if (voice) u.voice = voice;
    u.rate = rate || 0.8;
    if (el) {
      el.classList.add("speaking");
      u.onend = u.onerror = () => el.classList.remove("speaking");
    }
    speechSynthesis.speak(u);
  }
  window.cantoSay = say;

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-say]");
    if (!el || el.closest(".opts")) return;
    say(el.dataset.say, el, parseFloat(el.dataset.rate) || undefined);
  });

  // ---------- 计分 ----------
  const score = { right: 0, done: 0, total: 0 };
  function renderScore() {
    const bar = document.querySelector(".scorebar");
    if (!bar) return;
    bar.textContent =
      score.done < score.total
        ? `已完成 ${score.done} / ${score.total} 题 · 首次答对 ${score.right}`
        : `全部完成！首次答对 ${score.right} / ${score.total}。` +
          (score.right === score.total ? " 很棒——明天再来做一遍，检验记忆。" : " 答错的题明天再做一遍，那才是真正记住的时候。");
  }
  function record(firstTryRight) {
    score.done++;
    if (firstTryRight) score.right++;
    renderScore();
  }

  // ---------- 选择题 ----------
  document.querySelectorAll(".mcq").forEach((box) => {
    score.total++;
    const answer = parseInt(box.dataset.answer, 10);
    let attempted = false;
    let finished = false;
    box.querySelectorAll(".opts li").forEach((li, i) => {
      li.addEventListener("click", () => {
        if (finished) return;
        if (i + 1 === answer) {
          li.classList.add("right");
          box.classList.add("answered");
          finished = true;
          record(!attempted);
          if (li.dataset.say) say(li.dataset.say, li);
        } else {
          li.classList.add("wrong");
          attempted = true;
        }
      });
    });
  });

  // ---------- 粤拼输入题 ----------
  const SYL = /[a-z]+[1-6]?/g;
  function syllables(s) {
    return (s.toLowerCase().replace(/[^a-z1-6]+/g, " ").match(SYL) || []);
  }
  function compare(input, target) {
    const a = syllables(input);
    const b = syllables(target);
    let score = 0;
    const parts = b.map((t, i) => {
      const got = a[i] || "";
      let cls = "no";
      if (got === t) { cls = "ok"; score += 2; }
      else if (got.replace(/\d/, "") === t.replace(/\d/, "")) { cls = "tone"; score += 1; }
      return { got: got || "—", want: t, cls };
    });
    const exact = a.length === b.length && parts.every((p) => p.cls === "ok");
    return { exact, parts, score };
  }

  document.querySelectorAll(".type-quiz").forEach((box) => {
    score.total++;
    const answers = box.dataset.answers.split("|");
    let attempted = false;
    let finished = false;

    const row = document.createElement("div");
    row.innerHTML = '<input type="text" autocomplete="off" spellcheck="false" placeholder="用粤拼输入，声调用数字，如 m4 goi1"><button type="button">检查</button>';
    const fb = document.createElement("div");
    fb.className = "feedback";
    box.append(row, fb);
    const input = row.querySelector("input");

    function check() {
      if (finished || !input.value.trim()) return;
      const results = answers.map((t) => compare(input.value, t));
      const best = results.reduce((x, y) => (y.score > x.score ? y : x));
      if (best.exact) {
        finished = true;
        fb.innerHTML = '<span class="ok">✓ 正确！</span> ' + best.parts.map((p) => `<span class="syl ok">${p.want}</span>`).join(" ");
        record(!attempted);
        if (box.dataset.say) say(box.dataset.say);
        box.classList.add("answered");
      } else {
        attempted = true;
        const tips = [];
        if (best.parts.some((p) => p.cls === "tone")) tips.push("波浪线 = 拼对了，声调不对");
        if (best.parts.some((p) => p.cls === "no")) tips.push("删除线 = 拼写不对");
        fb.innerHTML =
          '<span class="no">再试一次：</span> ' +
          best.parts.map((p) => `<span class="syl ${p.cls}">${p.got}</span>`).join(" ") +
          `<br><small>${tips.join("；")}。</small> <a href="#" class="giveup">看答案</a>`;
        fb.querySelector(".giveup").addEventListener("click", (e) => {
          e.preventDefault();
          finished = true;
          fb.innerHTML = `答案：<span class="syl ok">${answers[0]}</span> —— 记下它，明天再来考自己。`;
          record(false);
          box.classList.add("answered");
          if (box.dataset.say) say(box.dataset.say);
        });
      }
    }
    row.querySelector("button").addEventListener("click", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  });

  renderScore();
})();
