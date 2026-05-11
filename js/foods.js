// PSMF-friendly preset foods. Macros are per `servingSize` of `servingUnit`.
// Most are per 100 g raw weight; protein powders & eggs use natural units.
window.PRESET_FOODS = [
  // Lean proteins (per 100 g raw)
  { id: "p_chicken_breast",  name: "Chicken breast (skinless)", servingSize: 100, servingUnit: "g", kcal: 165, p: 31,  f: 3.6, c: 0,    tags: ["protein"] },
  { id: "p_turkey_99",       name: "Ground turkey 99% lean",    servingSize: 100, servingUnit: "g", kcal: 120, p: 24,  f: 2,   c: 0,    tags: ["protein"] },
  { id: "p_tuna_water",      name: "Canned tuna in water",      servingSize: 100, servingUnit: "g", kcal: 116, p: 26,  f: 1,   c: 0,    tags: ["protein"] },
  { id: "p_cod",             name: "Cod (cooked)",              servingSize: 100, servingUnit: "g", kcal: 105, p: 23,  f: 0.9, c: 0,    tags: ["protein"] },
  { id: "p_tilapia",         name: "Tilapia (cooked)",          servingSize: 100, servingUnit: "g", kcal: 129, p: 26,  f: 2.7, c: 0,    tags: ["protein"] },
  { id: "p_shrimp",          name: "Shrimp (cooked)",           servingSize: 100, servingUnit: "g", kcal: 99,  p: 24,  f: 0.3, c: 0.2,  tags: ["protein"] },
  { id: "p_pork_loin",       name: "Pork tenderloin (lean)",    servingSize: 100, servingUnit: "g", kcal: 143, p: 26,  f: 3.4, c: 0,    tags: ["protein"] },
  { id: "p_beef_96",         name: "Ground beef 96% lean",      servingSize: 100, servingUnit: "g", kcal: 139, p: 22,  f: 5,   c: 0,    tags: ["protein"] },
  { id: "p_egg_whole",       name: "Egg, whole large",          servingSize: 1,   servingUnit: "egg", kcal: 72, p: 6.3, f: 4.8, c: 0.4, tags: ["protein"] },
  { id: "p_egg_white",       name: "Egg white (large)",         servingSize: 1,   servingUnit: "white", kcal: 17, p: 3.6, f: 0.06, c: 0.2, tags: ["protein"] },
  { id: "p_cottage_1",       name: "Cottage cheese 1%",         servingSize: 100, servingUnit: "g", kcal: 72,  p: 12,  f: 1,   c: 2.7,  tags: ["protein"] },
  { id: "p_greek_0",         name: "Greek yogurt 0% (plain)",   servingSize: 100, servingUnit: "g", kcal: 59,  p: 10,  f: 0.4, c: 3.6,  tags: ["protein"] },
  { id: "p_whey",            name: "Whey protein isolate",      servingSize: 30,  servingUnit: "g scoop", kcal: 120, p: 25, f: 1, c: 2, tags: ["protein"] },
  { id: "p_jerky_lean",      name: "Beef jerky (lean)",         servingSize: 28,  servingUnit: "g (1 oz)", kcal: 80, p: 14, f: 1, c: 5, tags: ["protein"] },

  // Vegetables (low calorie, mostly free on PSMF)
  { id: "v_broccoli",   name: "Broccoli (raw)",   servingSize: 100, servingUnit: "g", kcal: 34, p: 2.8, f: 0.4, c: 7,   tags: ["veg"] },
  { id: "v_spinach",    name: "Spinach (raw)",    servingSize: 100, servingUnit: "g", kcal: 23, p: 2.9, f: 0.4, c: 3.6, tags: ["veg"] },
  { id: "v_lettuce",    name: "Romaine lettuce",  servingSize: 100, servingUnit: "g", kcal: 17, p: 1.2, f: 0.3, c: 3.3, tags: ["veg"] },
  { id: "v_cucumber",   name: "Cucumber",         servingSize: 100, servingUnit: "g", kcal: 16, p: 0.7, f: 0.1, c: 3.6, tags: ["veg"] },
  { id: "v_asparagus",  name: "Asparagus",        servingSize: 100, servingUnit: "g", kcal: 20, p: 2.2, f: 0.1, c: 3.9, tags: ["veg"] },
  { id: "v_cauliflower",name: "Cauliflower",      servingSize: 100, servingUnit: "g", kcal: 25, p: 1.9, f: 0.3, c: 5,   tags: ["veg"] },
  { id: "v_zucchini",   name: "Zucchini",         servingSize: 100, servingUnit: "g", kcal: 17, p: 1.2, f: 0.3, c: 3.1, tags: ["veg"] },
  { id: "v_mushroom",   name: "Mushrooms (white)",servingSize: 100, servingUnit: "g", kcal: 22, p: 3.1, f: 0.3, c: 3.3, tags: ["veg"] },
  { id: "v_pepper",     name: "Bell pepper",      servingSize: 100, servingUnit: "g", kcal: 31, p: 1,   f: 0.3, c: 6,   tags: ["veg"] },
  { id: "v_celery",     name: "Celery",           servingSize: 100, servingUnit: "g", kcal: 16, p: 0.7, f: 0.2, c: 3,   tags: ["veg"] },
  { id: "v_kale",       name: "Kale",             servingSize: 100, servingUnit: "g", kcal: 35, p: 2.9, f: 1.5, c: 4.4, tags: ["veg"] },
  { id: "v_cabbage",    name: "Cabbage",          servingSize: 100, servingUnit: "g", kcal: 25, p: 1.3, f: 0.1, c: 6,   tags: ["veg"] },
  { id: "v_pickle",     name: "Dill pickle",      servingSize: 100, servingUnit: "g", kcal: 12, p: 0.5, f: 0.2, c: 2.3, tags: ["veg"] },

  // Fats & condiments (use sparingly)
  { id: "f_oliveoil",   name: "Olive oil",        servingSize: 1,   servingUnit: "tsp",  kcal: 40, p: 0,   f: 4.5, c: 0, tags: ["fat"] },
  { id: "f_butter",     name: "Butter",           servingSize: 1,   servingUnit: "tsp",  kcal: 34, p: 0,   f: 3.8, c: 0, tags: ["fat"] },
  { id: "f_almonds",    name: "Almonds",          servingSize: 10,  servingUnit: "g",    kcal: 58, p: 2.1, f: 5,   c: 2.2, tags: ["fat"] },
  { id: "f_avocado",    name: "Avocado",          servingSize: 50,  servingUnit: "g",    kcal: 80, p: 1,   f: 7.3, c: 4.3, tags: ["fat"] },
  { id: "f_fishoil",    name: "Fish oil capsule", servingSize: 1,   servingUnit: "cap (1g)", kcal: 9, p: 0, f: 1, c: 0, tags: ["fat","supp"] },

  // Free / near-free items
  { id: "x_diet_soda",  name: "Diet soda",        servingSize: 355, servingUnit: "ml can", kcal: 0,  p: 0, f: 0, c: 0, tags: ["free"] },
  { id: "x_coffee",     name: "Coffee (black)",   servingSize: 240, servingUnit: "ml cup", kcal: 2,  p: 0.3, f: 0, c: 0, tags: ["free"] },
  { id: "x_tea",        name: "Tea (unsweetened)",servingSize: 240, servingUnit: "ml cup", kcal: 2,  p: 0,   f: 0, c: 0.5, tags: ["free"] },
  { id: "x_mustard",    name: "Yellow mustard",   servingSize: 1,   servingUnit: "tsp",    kcal: 3,  p: 0.2, f: 0.2, c: 0.3, tags: ["free"] },
  { id: "x_hotsauce",   name: "Hot sauce",        servingSize: 1,   servingUnit: "tsp",    kcal: 1,  p: 0,   f: 0,   c: 0.2, tags: ["free"] },
  { id: "x_broth",      name: "Bone broth",       servingSize: 240, servingUnit: "ml cup", kcal: 40, p: 9,   f: 0,   c: 1, tags: ["free"] }
];
