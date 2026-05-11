// Hash router + global wiring (export/import/reset).
(function () {
  const view = document.getElementById("view");
  const nav = document.getElementById("nav");

  function setActiveNav(route) {
    nav.querySelectorAll("a[data-route]").forEach(a => {
      a.classList.toggle("active", a.dataset.route === route);
    });
  }

  function render() {
    const hash = (location.hash || "#/dashboard").replace(/^#\//, "");
    const route = hash.split("/")[0] || "dashboard";
    const handler = Views.routes[route] || Views.routes.dashboard;
    view.dataset.date = "";
    handler(view);
    setActiveNav(route);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", () => {
    if (!location.hash) location.hash = "#/dashboard";
    render();
  });

  // Footer actions
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([Store.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `psmf-tracker-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJson(reader.result);
        alert("Import complete.");
        render();
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
    importFile.value = "";
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Erase all PSMF Tracker data from this browser? This cannot be undone.")) {
      Store.reset();
      render();
    }
  });
})();
