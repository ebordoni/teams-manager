const filter = document.getElementById("tipo");
const menu = document.querySelector("details.menu");
const installButton = document.getElementById("install-app");
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  if (installButton) installButton.hidden = false;
});
installButton?.addEventListener("click", async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  installButton.hidden = true;
  await prompt.prompt();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu?.open) {
    menu.open = false;
    menu.querySelector("summary").focus();
  }
});
document.addEventListener("click", (event) => {
  if (menu?.open && !menu.contains(event.target)) menu.open = false;
});
filter?.addEventListener("change", () => {
  let count = 0;
  for (const card of document.querySelectorAll(".events [data-type]")) {
    card.hidden = filter.value !== "all" && card.dataset.type !== filter.value;
    if (!card.hidden) count++;
  }
  document.getElementById("filter-status").textContent = `${count} appuntamenti visibili nell'elenco. Il prossimo appuntamento resta in evidenza.`;
});
