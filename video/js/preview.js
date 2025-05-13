document.addEventListener("DOMContentLoaded", function () {
  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      window.close();
    });
  }
});
