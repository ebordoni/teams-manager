const filter = document.getElementById("tipo");
const menu = document.querySelector("details.menu");
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
