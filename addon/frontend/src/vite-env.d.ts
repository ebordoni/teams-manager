/// <reference types="vite/client" />

/**
 * Gli stili di Mantine sono import side-effect distribuiti come file CSS.
 * La dichiarazione mantiene la risoluzione coerente anche con TypeScript 5.6+
 * e con il language server dell'editor quando `noUncheckedSideEffectImports`
 * è attivo globalmente.
 */
declare module "*.css";
