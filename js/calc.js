// PSMF math: lean body mass, protein/macro targets, calorie ranges, projections.
// References: Lyle McDonald's "Rapid Fat Loss Handbook" (PSMF protocol),
// Mifflin-St Jeor BMR, classic body-fat-derived LBM.

const Calc = (() => {

  const round = (n, d = 0) => {
    const m = Math.pow(10, d);
    return Math.round(n * m) / m;
  };

  // Lean Body Mass in lb. If body fat % is reasonable, use it directly.
  function leanBodyMassLb(weightLb, bodyFatPct) {
    if (bodyFatPct > 0 && bodyFatPct < 60) {
      return weightLb * (1 - bodyFatPct / 100);
    }
    // Fallback: rough estimate at 25% body fat
    return weightLb * 0.75;
  }

  // PSMF protein recommendation in grams (Lyle McDonald style).
  // Tier protein density by body fat level:
  //   lean (m<15 / w<22): 1.5 g/lb LBM
  //   mid  (m<25 / w<32): 1.4 g/lb LBM
  //   high               : 1.2 g/lb LBM
  function recommendedProteinPerLbLbm(sex, bodyFatPct) {
    const lean = sex === "female" ? 22 : 15;
    const mid  = sex === "female" ? 32 : 25;
    if (bodyFatPct <= lean) return 1.5;
    if (bodyFatPct <= mid)  return 1.4;
    return 1.2;
  }

  // Default fat target in grams (essential fats; very low on PSMF).
  function recommendedFatGrams(bodyFatPct, sex) {
    const lean = sex === "female" ? 22 : 15;
    const mid  = sex === "female" ? 32 : 25;
    if (bodyFatPct <= lean) return 50; // leaner needs slightly more for hormones
    if (bodyFatPct <= mid)  return 30;
    return 20;
  }

  function targets(profile) {
    const lbm = leanBodyMassLb(profile.weightLb, profile.bodyFatPct);
    const proteinG = lbm * profile.proteinPerLbLbm;
    const fatG = profile.fatGramsTarget;
    const carbG = profile.carbGramsTarget;
    const kcal = proteinG * 4 + fatG * 9 + carbG * 4;
    return {
      lbm: round(lbm, 1),
      proteinG: round(proteinG),
      fatG,
      carbG,
      kcal: round(kcal),
      waterOz: 128 // 1 gallon/day minimum
    };
  }

  // Mifflin-St Jeor BMR (kcal/day). Returns BMR and a TDEE estimate.
  function bmrTdee(profile) {
    const kg = profile.weightLb / 2.20462;
    const cm = profile.heightIn * 2.54;
    let bmr = 10 * kg + 6.25 * cm - 5 * profile.age;
    bmr += profile.sex === "female" ? -161 : 5;
    const factors = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryactive: 1.9
    };
    const tdee = bmr * (factors[profile.activity] || 1.2);
    return { bmr: round(bmr), tdee: round(tdee) };
  }

  // Sums entries -> totals
  function sumEntries(entries) {
    return entries.reduce((a, e) => ({
      kcal: a.kcal + (e.kcal || 0),
      p: a.p + (e.p || 0),
      f: a.f + (e.f || 0),
      c: a.c + (e.c || 0)
    }), { kcal: 0, p: 0, f: 0, c: 0 });
  }

  // Per gram macros for a chosen serving qty.
  function scaleFood(food, qty) {
    // food fields are per `food.servingSize` of `food.servingUnit`
    const factor = qty / food.servingSize;
    return {
      kcal: round(food.kcal * factor),
      p: round(food.p * factor, 1),
      f: round(food.f * factor, 1),
      c: round(food.c * factor, 1)
    };
  }

  // Project finish date for goal weight given current trend (lb/week).
  function projectGoal(startDate, startWeight, currentWeight, goalWeight, ratePerWeek) {
    if (!ratePerWeek || ratePerWeek <= 0 || currentWeight <= goalWeight) return null;
    const lbsToGo = currentWeight - goalWeight;
    const weeks = lbsToGo / ratePerWeek;
    const days = Math.round(weeks * 7);
    const eta = new Date();
    eta.setDate(eta.getDate() + days);
    return { weeks: round(weeks, 1), days, eta: eta.toISOString().slice(0, 10) };
  }

  // Compute weight loss rate (lb/week) using simple linear fit on last N days.
  function lossRate(series, days = 14) {
    if (series.length < 2) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const recent = series.filter(p => new Date(p.date) >= cutoff);
    const points = recent.length >= 2 ? recent : series.slice(-Math.max(2, days));
    if (points.length < 2) return 0;
    const x0 = new Date(points[0].date).getTime();
    const xs = points.map(p => (new Date(p.date).getTime() - x0) / (1000 * 60 * 60 * 24));
    const ys = points.map(p => p.weight);
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxy = xs.reduce((a, _x, i) => a + xs[i] * ys[i], 0);
    const sxx = xs.reduce((a, x) => a + x * x, 0);
    const denom = n * sxx - sx * sx;
    if (denom === 0) return 0;
    const slopePerDay = (n * sxy - sx * sy) / denom; // lb/day, negative when losing
    return round(-slopePerDay * 7, 2); // lb/week loss (positive = losing)
  }

  return {
    round,
    leanBodyMassLb,
    recommendedProteinPerLbLbm,
    recommendedFatGrams,
    targets,
    bmrTdee,
    sumEntries,
    scaleFood,
    projectGoal,
    lossRate
  };
})();
