const filter = document.getElementById("tipo");
filter?.addEventListener("change", () => {
  let count = 0;
  for (const card of document.querySelectorAll(".events [data-type]")) {
    card.hidden = filter.value !== "all" && card.dataset.type !== filter.value;
    if (!card.hidden) count++;
  }
  document.getElementById("filter-status").textContent = `${count} appuntamenti visibili nell'elenco. Il prossimo appuntamento resta in evidenza.`;
});
