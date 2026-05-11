// View renderers. Each function takes the #view element and renders into it.
// Helpers exposed at the top, individual views below, route table at the bottom.

const Views = (() => {

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const todayKey = () => new Date().toISOString().slice(0, 10);

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  function pct(n, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((n / total) * 100)));
  }

  function macroBar(label, value, target, klass) {
    const p = pct(value, target);
    const over = value > target * 1.05;
    return `
      <div class="macro-line">
        <div class="name">${label}</div>
        <div class="bar ${klass} ${over ? "over" : ""}"><span style="width:${p}%"></span></div>
        <div class="nums">${Calc.round(value, 1)} / ${Calc.round(target, 1)} <span style="opacity:.6">${p}%</span></div>
      </div>
    `;
  }

  function metricCard(label, value, sub = "") {
    return `<div class="card metric">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ""}
    </div>`;
  }

  // -------- Dashboard --------
  function renderDashboard(root) {
    const profile = Store.profile();
    const targets = Calc.targets(profile);
    const today = todayKey();
    const todays = Store.getDayFoods(today);
    const totals = Calc.sumEntries(todays);
    const series = Store.weightSeries();
    const todaysWeight = Store.getWeight(today);
    const latestWeight = todaysWeight || (series.length ? series[series.length - 1].weight : profile.weightLb);
    const lost = profile.startWeightLb - latestWeight;
    const toGoal = latestWeight - profile.goalWeightLb;
    const pctDone = profile.startWeightLb !== profile.goalWeightLb
      ? Math.max(0, Math.min(100, Math.round((lost / (profile.startWeightLb - profile.goalWeightLb)) * 100)))
      : 0;
    const rate = Calc.lossRate(series, 14);
    const proj = Calc.projectGoal(profile.startDate, profile.startWeightLb, latestWeight, profile.goalWeightLb, rate);
    const daysIn = Math.max(0, Math.floor((Date.now() - new Date(profile.startDate).getTime()) / 86400000));

    root.innerHTML = `
      <h1>Dashboard</h1>
      <p class="subtitle">Day ${daysIn} of your PSMF. Targets are based on your profile.</p>

      <div class="grid cols-4" style="margin-bottom:18px">
        ${metricCard("Current weight", `${Calc.round(latestWeight, 1)} lb`, todaysWeight ? "Logged today" : "Last logged")}
        ${metricCard("Total lost", `${Calc.round(lost, 1)} lb`, `${pctDone}% to goal`)}
        ${metricCard("To goal", `${Calc.round(Math.max(0, toGoal), 1)} lb`, `Goal: ${profile.goalWeightLb} lb`)}
        ${metricCard("Rate (14d)", `${rate > 0 ? "-" : ""}${Math.abs(rate).toFixed(2)} lb/wk`, rate > 0 ? "On track" : "No loss trend")}
      </div>

      <div class="grid cols-2" style="margin-bottom:18px">
        <div class="card">
          <h2>Today's macros</h2>
          ${macroBar("Protein", totals.p, targets.proteinG, "protein")}
          ${macroBar("Fat",     totals.f, targets.fatG,     "fat")}
          ${macroBar("Carbs",   totals.c, targets.carbG,    "carb")}
          ${macroBar("Calories",totals.kcal, targets.kcal,  "cal")}
          <div style="margin-top:10px"><a href="#/today">Open today's log →</a></div>
        </div>

        <div class="card">
          <h2>Weight trend</h2>
          <div class="chart-wrap"><canvas id="weightChart"></canvas></div>
        </div>
      </div>

      <div class="card">
        <h2>Projection</h2>
        ${proj ? `
          <dl class="kv">
            <dt>Current loss rate</dt><dd>${rate.toFixed(2)} lb/week</dd>
            <dt>Lbs to goal</dt><dd>${Calc.round(toGoal, 1)} lb</dd>
            <dt>Estimated time</dt><dd>${proj.weeks} weeks (${proj.days} days)</dd>
            <dt>Goal date (est.)</dt><dd>${proj.eta}</dd>
          </dl>
        ` : `<p class="empty">Log at least two weights a few days apart to see a projection. PSMF beginners often see 5–10 lb of water weight in the first week.</p>`}
      </div>
    `;

    drawWeightChart("weightChart", series, profile.goalWeightLb);
  }

  function drawWeightChart(canvasId, series, goal) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    if (!series.length) {
      const ctx = el.getContext("2d");
      ctx.fillStyle = "#9aa7b4";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No weight entries yet — log one to see your trend", el.width / 2, el.height / 2);
      return;
    }
    new Chart(el, {
      type: "line",
      data: {
        labels: series.map(p => p.date),
        datasets: [
          {
            label: "Weight (lb)",
            data: series.map(p => p.weight),
            borderColor: "#ff5a3c",
            backgroundColor: "rgba(255,90,60,0.15)",
            tension: 0.25,
            fill: true,
            pointRadius: 3
          },
          {
            label: "Goal",
            data: series.map(() => goal),
            borderColor: "#4ade80",
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e6edf3" } } },
        scales: {
          x: { ticks: { color: "#9aa7b4", maxRotation: 0, autoSkip: true }, grid: { color: "#2a3340" } },
          y: { ticks: { color: "#9aa7b4" }, grid: { color: "#2a3340" } }
        }
      }
    });
  }

  // -------- Today's food log --------
  function renderToday(root) {
    const profile = Store.profile();
    const targets = Calc.targets(profile);
    const dateKey = root.dataset.date || todayKey();
    const entries = Store.getDayFoods(dateKey);
    const totals = Calc.sumEntries(entries);
    const weight = Store.getWeight(dateKey);

    root.innerHTML = `
      <h1>Daily Log</h1>
      <p class="subtitle">Log foods consumed and your morning weight.</p>

      <div class="card" style="margin-bottom:18px">
        <div class="row">
          <div style="max-width:200px">
            <label for="logDate">Date</label>
            <input type="date" id="logDate" value="${dateKey}" />
          </div>
          <div style="max-width:200px">
            <label for="logWeight">Weight (lb)</label>
            <input type="number" step="0.1" id="logWeight" value="${weight ?? ""}" placeholder="e.g. 198.4" />
          </div>
          <div>
            <button class="btn" id="saveWeightBtn">Save weight</button>
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-bottom:18px">
        <div class="card">
          <h2>Add food</h2>
          <div class="search-wrap">
            <label for="foodSearch">Search foods</label>
            <input type="text" id="foodSearch" placeholder="chicken breast, broccoli, whey..." autocomplete="off" />
            <div class="search-results" id="searchResults" hidden></div>
          </div>
          <div id="addFoodForm" style="margin-top:10px" hidden>
            <div class="row">
              <div>
                <label>Food</label>
                <input type="text" id="afName" readonly />
              </div>
            </div>
            <div class="row">
              <div>
                <label id="afQtyLabel">Quantity</label>
                <input type="number" id="afQty" step="any" min="0" />
              </div>
              <div style="max-width:160px"><label>Calories</label><input id="afKcal" readonly /></div>
              <div style="max-width:120px"><label>P (g)</label><input id="afP" readonly /></div>
              <div style="max-width:120px"><label>F (g)</label><input id="afF" readonly /></div>
              <div style="max-width:120px"><label>C (g)</label><input id="afC" readonly /></div>
            </div>
            <div style="margin-top:10px; display:flex; gap:8px">
              <button class="btn" id="afAdd">Add to log</button>
              <button class="btn ghost" id="afCancel">Cancel</button>
            </div>
          </div>

          <details style="margin-top:14px">
            <summary style="cursor:pointer; color:var(--muted)">Add a custom food</summary>
            <div style="margin-top:8px" id="customFoodForm">
              <div class="row">
                <div><label>Name</label><input id="cfName" /></div>
                <div style="max-width:120px"><label>Serving size</label><input id="cfSize" type="number" step="any" value="100" /></div>
                <div style="max-width:140px"><label>Unit</label><input id="cfUnit" value="g" /></div>
              </div>
              <div class="row" style="margin-top:6px">
                <div><label>Calories</label><input id="cfKcal" type="number" step="any" /></div>
                <div><label>Protein (g)</label><input id="cfP" type="number" step="any" /></div>
                <div><label>Fat (g)</label><input id="cfF" type="number" step="any" /></div>
                <div><label>Carbs (g)</label><input id="cfC" type="number" step="any" /></div>
              </div>
              <button class="btn secondary small" id="cfSave" style="margin-top:8px">Save custom food</button>
            </div>
          </details>
        </div>

        <div class="card">
          <h2>Targets vs today</h2>
          ${macroBar("Protein", totals.p, targets.proteinG, "protein")}
          ${macroBar("Fat",     totals.f, targets.fatG,     "fat")}
          ${macroBar("Carbs",   totals.c, targets.carbG,    "carb")}
          ${macroBar("Calories",totals.kcal, targets.kcal,  "cal")}
          <div style="margin-top:14px; color:var(--muted); font-size:13px">
            Aim to hit protein target. Fat/carbs are caps — under is fine.
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Entries for ${dateKey}</h2>
        ${entries.length === 0 ? `<div class="empty">No foods logged yet.</div>` : `
          <table>
            <thead><tr>
              <th>Food</th><th>Qty</th>
              <th class="num">Cal</th><th class="num">P</th><th class="num">F</th><th class="num">C</th><th></th>
            </tr></thead>
            <tbody>
              ${entries.map(e => `
                <tr>
                  <td>${escapeHtml(e.name)}</td>
                  <td>${e.qty} ${escapeHtml(e.unit || "")}</td>
                  <td class="num">${e.kcal}</td>
                  <td class="num">${e.p}</td>
                  <td class="num">${e.f}</td>
                  <td class="num">${e.c}</td>
                  <td class="list-actions">
                    <button class="icon-btn danger" data-del="${e.id}" title="Remove">×</button>
                  </td>
                </tr>
              `).join("")}
              <tr style="font-weight:600">
                <td colspan="2">Totals</td>
                <td class="num">${totals.kcal}</td>
                <td class="num">${Calc.round(totals.p,1)}</td>
                <td class="num">${Calc.round(totals.f,1)}</td>
                <td class="num">${Calc.round(totals.c,1)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        `}
      </div>
    `;

    // Date change
    $("#logDate").addEventListener("change", (e) => {
      root.dataset.date = e.target.value;
      renderToday(root);
    });

    // Save weight
    $("#saveWeightBtn").addEventListener("click", () => {
      const v = $("#logWeight").value;
      Store.setWeight(dateKey, v);
      renderToday(root);
    });

    // Food search
    let chosenFood = null;
    const search = $("#foodSearch");
    const results = $("#searchResults");
    const form = $("#addFoodForm");

    function showResults(q) {
      const foods = Store.allFoods();
      const matches = !q ? [] : foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
      if (matches.length === 0) { results.hidden = true; return; }
      results.hidden = false;
      results.innerHTML = matches.map(m => `
        <div class="item" data-id="${m.id}">
          <div>${escapeHtml(m.name)}</div>
          <div class="meta">${m.kcal} kcal · ${m.p}P / ${m.f}F / ${m.c}C per ${m.servingSize} ${escapeHtml(m.servingUnit)}</div>
        </div>
      `).join("");
      $$(".item", results).forEach(item => {
        item.addEventListener("click", () => {
          const id = item.dataset.id;
          chosenFood = foods.find(f => f.id === id);
          search.value = chosenFood.name;
          results.hidden = true;
          form.hidden = false;
          $("#afName").value = chosenFood.name;
          $("#afQtyLabel").textContent = `Quantity (${chosenFood.servingUnit})`;
          $("#afQty").value = chosenFood.servingSize;
          updateAddFoodCalc();
          $("#afQty").focus();
          $("#afQty").select();
        });
      });
    }
    function updateAddFoodCalc() {
      if (!chosenFood) return;
      const qty = parseFloat($("#afQty").value) || 0;
      const scaled = Calc.scaleFood(chosenFood, qty);
      $("#afKcal").value = scaled.kcal;
      $("#afP").value = scaled.p;
      $("#afF").value = scaled.f;
      $("#afC").value = scaled.c;
    }
    search.addEventListener("input", (e) => showResults(e.target.value));
    document.addEventListener("click", (e) => {
      if (!results.contains(e.target) && e.target !== search) results.hidden = true;
    });
    $("#afQty").addEventListener("input", updateAddFoodCalc);
    $("#afCancel").addEventListener("click", () => {
      form.hidden = true;
      search.value = "";
      chosenFood = null;
    });
    $("#afAdd").addEventListener("click", () => {
      if (!chosenFood) return;
      const qty = parseFloat($("#afQty").value) || 0;
      if (qty <= 0) return;
      const scaled = Calc.scaleFood(chosenFood, qty);
      Store.addFood(dateKey, {
        foodId: chosenFood.id,
        name: chosenFood.name,
        qty,
        unit: chosenFood.servingUnit,
        ...scaled
      });
      renderToday(root);
    });

    // Custom food
    $("#cfSave").addEventListener("click", () => {
      const food = {
        name: $("#cfName").value.trim(),
        servingSize: parseFloat($("#cfSize").value) || 100,
        servingUnit: $("#cfUnit").value || "g",
        kcal: parseFloat($("#cfKcal").value) || 0,
        p: parseFloat($("#cfP").value) || 0,
        f: parseFloat($("#cfF").value) || 0,
        c: parseFloat($("#cfC").value) || 0,
        tags: ["custom"]
      };
      if (!food.name) { alert("Name required"); return; }
      Store.addCustomFood(food);
      alert("Added — now searchable above.");
      $("#cfName").value = "";
    });

    // Delete entry
    $$("button[data-del]", root).forEach(b => {
      b.addEventListener("click", () => {
        Store.removeFood(dateKey, b.dataset.del);
        renderToday(root);
      });
    });
  }

  // -------- Weight tracking --------
  function renderWeight(root) {
    const profile = Store.profile();
    const series = Store.weightSeries();
    const latest = series.length ? series[series.length - 1].weight : profile.weightLb;
    const lost = profile.startWeightLb - latest;
    const rate7 = Calc.lossRate(series, 7);
    const rate14 = Calc.lossRate(series, 14);
    const rate30 = Calc.lossRate(series, 30);
    const todaysVal = Store.getWeight(todayKey()) ?? "";

    root.innerHTML = `
      <h1>Weight</h1>
      <p class="subtitle">Daily weigh-ins. Pick a consistent time (morning, post-bathroom, pre-food works best).</p>

      <div class="grid cols-4" style="margin-bottom:18px">
        ${metricCard("Latest", `${Calc.round(latest, 1)} lb`, series.length ? series[series.length-1].date : "—")}
        ${metricCard("Start", `${profile.startWeightLb} lb`, profile.startDate)}
        ${metricCard("Lost", `${Calc.round(lost, 1)} lb`, `${series.length} entries`)}
        ${metricCard("7-day rate", `${rate7.toFixed(2)} lb/wk`, `14d: ${rate14.toFixed(2)} · 30d: ${rate30.toFixed(2)}`)}
      </div>

      <div class="card" style="margin-bottom:18px">
        <h2>Log weight</h2>
        <div class="row">
          <div style="max-width:200px"><label>Date</label><input type="date" id="wDate" value="${todayKey()}" /></div>
          <div style="max-width:200px"><label>Weight (lb)</label><input type="number" step="0.1" id="wVal" value="${todaysVal}" /></div>
          <div><button class="btn" id="wSave">Save</button></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px">
        <h2>Weight chart</h2>
        <div class="chart-wrap"><canvas id="wChart"></canvas></div>
      </div>

      <div class="card">
        <h2>Entries</h2>
        ${series.length === 0 ? `<div class="empty">No entries yet.</div>` : `
          <table>
            <thead><tr><th>Date</th><th class="num">Weight (lb)</th><th class="num">Δ from start</th><th></th></tr></thead>
            <tbody>
              ${series.slice().reverse().map(p => `
                <tr>
                  <td>${p.date}</td>
                  <td class="num">${p.weight.toFixed(1)}</td>
                  <td class="num">${(p.weight - profile.startWeightLb).toFixed(1)}</td>
                  <td class="list-actions"><button class="icon-btn danger" data-wdel="${p.date}">×</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>
    `;

    $("#wSave").addEventListener("click", () => {
      Store.setWeight($("#wDate").value, $("#wVal").value);
      renderWeight(root);
    });
    $$("button[data-wdel]").forEach(b => b.addEventListener("click", () => {
      Store.setWeight(b.dataset.wdel, "");
      renderWeight(root);
    }));
    drawWeightChart("wChart", series, profile.goalWeightLb);
  }

  // -------- Calculator --------
  function renderCalculator(root) {
    const profile = Store.profile();
    root.innerHTML = `
      <h1>PSMF Calculator</h1>
      <p class="subtitle">Estimate protein, fat, carb, and calorie targets from body stats. Saving applies these to your profile.</p>

      <div class="grid cols-2" style="margin-bottom:18px">
        <div class="card">
          <h2>Inputs</h2>
          <div class="row">
            <div>
              <label>Sex</label>
              <select id="cSex"><option value="male" ${profile.sex==="male"?"selected":""}>Male</option><option value="female" ${profile.sex==="female"?"selected":""}>Female</option></select>
            </div>
            <div><label>Age</label><input type="number" id="cAge" value="${profile.age}" /></div>
          </div>
          <div class="row">
            <div><label>Height (in)</label><input type="number" id="cHeight" value="${profile.heightIn}" step="0.1" /></div>
            <div><label>Weight (lb)</label><input type="number" id="cWeight" value="${profile.weightLb}" step="0.1" /></div>
            <div><label>Body fat %</label><input type="number" id="cBF" value="${profile.bodyFatPct}" step="0.1" /></div>
          </div>
          <div class="row">
            <div>
              <label>Activity</label>
              <select id="cAct">
                <option value="sedentary" ${profile.activity==="sedentary"?"selected":""}>Sedentary</option>
                <option value="light" ${profile.activity==="light"?"selected":""}>Light</option>
                <option value="moderate" ${profile.activity==="moderate"?"selected":""}>Moderate</option>
                <option value="active" ${profile.activity==="active"?"selected":""}>Active</option>
                <option value="veryactive" ${profile.activity==="veryactive"?"selected":""}>Very active</option>
              </select>
            </div>
            <div><label>Protein g/lb LBM</label><input type="number" id="cPP" value="${profile.proteinPerLbLbm}" step="0.05" /></div>
          </div>
          <div class="row">
            <div><label>Fat target (g)</label><input type="number" id="cFat" value="${profile.fatGramsTarget}" step="1" /></div>
            <div><label>Carb target (g)</label><input type="number" id="cCarb" value="${profile.carbGramsTarget}" step="1" /></div>
          </div>
          <div style="margin-top:12px; display:flex; gap:8px">
            <button class="btn" id="cCalc">Calculate</button>
            <button class="btn secondary" id="cAuto">Auto-fill from BF%</button>
            <button class="btn ghost" id="cSave">Save to profile</button>
          </div>
          <div class="notice" style="margin-top:14px">
            Tip: If you don't know your body fat %, a rough visual estimate is fine —
            within ±5% won't dramatically change protein targets.
          </div>
        </div>

        <div class="card">
          <h2>Results</h2>
          <div id="cResults"></div>
        </div>
      </div>
    `;

    function run() {
      const p = {
        sex: $("#cSex").value,
        age: +$("#cAge").value,
        heightIn: +$("#cHeight").value,
        weightLb: +$("#cWeight").value,
        bodyFatPct: +$("#cBF").value,
        activity: $("#cAct").value,
        proteinPerLbLbm: +$("#cPP").value,
        fatGramsTarget: +$("#cFat").value,
        carbGramsTarget: +$("#cCarb").value
      };
      const t = Calc.targets(p);
      const { bmr, tdee } = Calc.bmrTdee(p);
      const deficit = tdee - t.kcal;
      const ratePerWeek = (deficit * 7) / 3500;

      $("#cResults").innerHTML = `
        <dl class="kv">
          <dt>Lean body mass</dt><dd>${t.lbm} lb</dd>
          <dt>Protein</dt><dd>${t.proteinG} g <span style="color:var(--muted)">(${Calc.round(t.proteinG*4)} kcal)</span></dd>
          <dt>Fat</dt><dd>${t.fatG} g <span style="color:var(--muted)">(${t.fatG*9} kcal)</span></dd>
          <dt>Carbs</dt><dd>${t.carbG} g <span style="color:var(--muted)">(${t.carbG*4} kcal)</span></dd>
          <dt>Total calories</dt><dd><strong>${t.kcal} kcal/day</strong></dd>
          <dt>Water</dt><dd>${t.waterOz} oz / day (≥1 gallon)</dd>
        </dl>
        <hr style="border-color:var(--line)" />
        <dl class="kv">
          <dt>BMR (Mifflin-St Jeor)</dt><dd>${bmr} kcal/day</dd>
          <dt>TDEE estimate</dt><dd>${tdee} kcal/day</dd>
          <dt>Estimated deficit</dt><dd>${Calc.round(deficit)} kcal/day</dd>
          <dt>Projected fat loss</dt><dd>~${ratePerWeek.toFixed(1)} lb/week (after first week water loss)</dd>
        </dl>
        ${t.kcal < 800 ? `<div class="notice warn">Calorie target is very low. PSMF protocols typically run 800–1200 kcal/day. Consider consulting a doctor.</div>` : ""}
      `;
    }

    $("#cCalc").addEventListener("click", run);
    $("#cAuto").addEventListener("click", () => {
      const sex = $("#cSex").value;
      const bf = +$("#cBF").value;
      $("#cPP").value = Calc.recommendedProteinPerLbLbm(sex, bf);
      $("#cFat").value = Calc.recommendedFatGrams(bf, sex);
      run();
    });
    $("#cSave").addEventListener("click", () => {
      Store.saveProfile({
        sex: $("#cSex").value,
        age: +$("#cAge").value,
        heightIn: +$("#cHeight").value,
        weightLb: +$("#cWeight").value,
        bodyFatPct: +$("#cBF").value,
        activity: $("#cAct").value,
        proteinPerLbLbm: +$("#cPP").value,
        fatGramsTarget: +$("#cFat").value,
        carbGramsTarget: +$("#cCarb").value
      });
      alert("Saved to profile.");
    });
    run();
  }

  // -------- Profile / Settings --------
  function renderProfile(root) {
    const p = Store.profile();
    root.innerHTML = `
      <h1>Profile</h1>
      <p class="subtitle">Sets defaults used everywhere in the app.</p>
      <div class="card">
        <div class="row">
          <div><label>Sex</label>
            <select id="pSex"><option value="male" ${p.sex==="male"?"selected":""}>Male</option><option value="female" ${p.sex==="female"?"selected":""}>Female</option></select>
          </div>
          <div><label>Age</label><input type="number" id="pAge" value="${p.age}" /></div>
          <div><label>Activity</label>
            <select id="pAct">
              <option value="sedentary" ${p.activity==="sedentary"?"selected":""}>Sedentary</option>
              <option value="light" ${p.activity==="light"?"selected":""}>Light</option>
              <option value="moderate" ${p.activity==="moderate"?"selected":""}>Moderate</option>
              <option value="active" ${p.activity==="active"?"selected":""}>Active</option>
              <option value="veryactive" ${p.activity==="veryactive"?"selected":""}>Very active</option>
            </select>
          </div>
        </div>
        <div class="row" style="margin-top:8px">
          <div><label>Height (in)</label><input type="number" step="0.1" id="pHeight" value="${p.heightIn}" /></div>
          <div><label>Current weight (lb)</label><input type="number" step="0.1" id="pWeight" value="${p.weightLb}" /></div>
          <div><label>Body fat %</label><input type="number" step="0.1" id="pBF" value="${p.bodyFatPct}" /></div>
        </div>
        <h3 style="margin-top:18px">Macro targets</h3>
        <div class="row">
          <div><label>Protein g per lb LBM</label><input type="number" step="0.05" id="pPP" value="${p.proteinPerLbLbm}" /></div>
          <div><label>Fat target (g)</label><input type="number" id="pFat" value="${p.fatGramsTarget}" /></div>
          <div><label>Carbs target (g)</label><input type="number" id="pCarb" value="${p.carbGramsTarget}" /></div>
        </div>
        <h3 style="margin-top:18px">Goal</h3>
        <div class="row">
          <div><label>Start date</label><input type="date" id="pStartDate" value="${p.startDate}" /></div>
          <div><label>Start weight (lb)</label><input type="number" step="0.1" id="pStartW" value="${p.startWeightLb}" /></div>
          <div><label>Goal weight (lb)</label><input type="number" step="0.1" id="pGoalW" value="${p.goalWeightLb}" /></div>
        </div>
        <div style="margin-top:14px"><button class="btn" id="pSave">Save profile</button></div>
      </div>
    `;
    $("#pSave").addEventListener("click", () => {
      Store.saveProfile({
        sex: $("#pSex").value,
        age: +$("#pAge").value,
        activity: $("#pAct").value,
        heightIn: +$("#pHeight").value,
        weightLb: +$("#pWeight").value,
        bodyFatPct: +$("#pBF").value,
        proteinPerLbLbm: +$("#pPP").value,
        fatGramsTarget: +$("#pFat").value,
        carbGramsTarget: +$("#pCarb").value,
        startDate: $("#pStartDate").value,
        startWeightLb: +$("#pStartW").value,
        goalWeightLb: +$("#pGoalW").value
      });
      alert("Profile saved.");
      renderProfile(root);
    });
  }

  // -------- Learn / Information --------
  function renderLearn(root) {
    root.innerHTML = `
      <h1>About the PSMF</h1>
      <p class="subtitle">A short reference for the Protein-Sparing Modified Fast. Not medical advice.</p>

      <div class="grid cols-2">
        <div class="card">
          <h2>What it is</h2>
          <p>The Protein-Sparing Modified Fast (PSMF) is a very low-calorie diet that combines high
          protein with minimal fat and carbohydrate to drive rapid fat loss while preserving lean
          mass. It was originally a medical intervention for severe obesity and later popularized
          for short cuts by Lyle McDonald's <em>Rapid Fat Loss Handbook</em>.</p>
          <p>Typical duration: 2–6 weeks depending on body fat. Leaner people use it for shorter
          stretches; people with more fat to lose can run it longer with refeeds.</p>
        </div>

        <div class="card">
          <h2>The basic rules</h2>
          <ul class="checklist">
            <li>Hit your protein target every day (1.2–1.5 g per lb of LBM).</li>
            <li>Keep fat low (typically 20–50 g/day from lean protein + supplements).</li>
            <li>Keep carbs low (under 30–50 g/day, mostly from non-starchy vegetables).</li>
            <li>Eat free vegetables to volume (leafy greens, broccoli, cauliflower, etc.).</li>
            <li>Drink at least 1 gallon (≈128 oz) of water per day.</li>
            <li>Supplement: multivitamin, fish oil (EPA/DHA), sodium / potassium / magnesium.</li>
            <li>Sleep, walk daily, and keep training light — heavy lifting is OK but expect strength dips.</li>
          </ul>
        </div>

        <div class="card">
          <h2>Foods to eat freely</h2>
          <ul class="checklist">
            <li>Chicken / turkey breast (skinless)</li>
            <li>White fish: cod, haddock, tilapia, pollock</li>
            <li>Tuna in water, shrimp, scallops</li>
            <li>Egg whites; whole eggs in moderation (count fat)</li>
            <li>Very lean beef (96–99%) or pork tenderloin</li>
            <li>Non-fat Greek yogurt, 1% cottage cheese (count carbs)</li>
            <li>Whey isolate / casein for convenience</li>
            <li>Leafy greens, cruciferous veg, cucumbers, peppers, mushrooms</li>
            <li>Water, black coffee, plain tea, diet soda, broth</li>
          </ul>
        </div>

        <div class="card">
          <h2>Foods to avoid</h2>
          <ul class="checklist no">
            <li>Bread, rice, pasta, potatoes, oats, grains</li>
            <li>Sugar, juice, soda, sweetened drinks</li>
            <li>Fruit (during the strict phase — re-add in maintenance)</li>
            <li>Oils except small amounts of olive / fish oil</li>
            <li>Fatty cuts of meat, bacon, sausage</li>
            <li>Full-fat dairy, cheese, cream</li>
            <li>Nuts and seeds (calorie-dense and easy to overshoot)</li>
            <li>Alcohol</li>
          </ul>
        </div>

        <div class="card">
          <h2>Refeeds</h2>
          <p>Optional structured carb refeeds help with energy, performance, and adherence:</p>
          <ul class="checklist">
            <li>Lean (&lt;15% bf men / &lt;22% women): one 5-hour refeed of clean carbs each week.</li>
            <li>Mid (15–25% / 22–32%): one refeed every 1–2 weeks.</li>
            <li>Higher body fat: refeeds usually not needed for the first 2–4 weeks.</li>
            <li>Refeed = carbs only. Keep fat very low. Don't make it a cheat day.</li>
          </ul>
        </div>

        <div class="card">
          <h2>Expected weight loss</h2>
          <ul class="checklist">
            <li>Week 1: 5–10 lb (mostly water from glycogen and lower sodium).</li>
            <li>Week 2+: 2–5 lb/week of mostly fat, depending on size.</li>
            <li>The scale will fluctuate — a 7- or 14-day moving average is more reliable than any one day.</li>
          </ul>
        </div>

        <div class="card">
          <h2>Electrolytes (important)</h2>
          <p>Low carbs + low calories = your body sheds water and sodium fast. If you feel
          dizzy, weak, or get a headache, the cause is almost always electrolytes.</p>
          <dl class="kv">
            <dt>Sodium</dt><dd>3–5 g/day (salt your food, broth, electrolyte powder)</dd>
            <dt>Potassium</dt><dd>3–4 g/day (low-sodium salt, leafy greens, supplement)</dd>
            <dt>Magnesium</dt><dd>300–500 mg/day (glycinate or citrate)</dd>
          </dl>
        </div>

        <div class="card">
          <h2>When NOT to do PSMF</h2>
          <ul class="checklist no">
            <li>Pregnant or breastfeeding</li>
            <li>Type 1 diabetes or on medications affecting blood sugar (without doctor)</li>
            <li>History of eating disorders</li>
            <li>Kidney or liver disease</li>
            <li>Under 18, very lean (men &lt;10% / women &lt;18%), or already in a deficit for weeks</li>
          </ul>
          <div class="notice warn">PSMF is aggressive. Talk to a doctor before starting if any of the above apply, and don't run it longer than your body fat justifies.</div>
        </div>

        <div class="card">
          <h2>Coming off PSMF</h2>
          <p>Don't go straight to maintenance calories overnight. Step up gradually over 1–2 weeks:</p>
          <ul class="checklist">
            <li>Add 200–300 kcal of carbs per day for the first 3–4 days.</li>
            <li>Then add fat back gradually toward maintenance.</li>
            <li>Expect 2–5 lb of glycogen + water rebound — that's not fat regain.</li>
            <li>Switch tracking to a normal cutting/maintenance approach.</li>
          </ul>
        </div>
      </div>
    `;
  }

  // -------- Route table --------
  const routes = {
    dashboard: renderDashboard,
    today: renderToday,
    weight: renderWeight,
    calculator: renderCalculator,
    profile: renderProfile,
    learn: renderLearn
  };

  return { routes };
})();
