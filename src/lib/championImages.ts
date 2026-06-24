// Players with a champion portrait in /public/champion-images.
// Auto-generated from the image filenames (<Player Name>-champion.png).
// Used to pick the highlighted "destaque" and show their image on the champion card.

export const CHAMPION_IMAGE_NAMES: ReadonlySet<string> = new Set([
  "Alessandro Nesta",
  "Alisson Becker",
  "Andrea Pirlo",
  "Arjen Robben",
  "Cristiano Ronaldo",
  "Deco",
  "Dida",
  "Erling Haaland",
  "Eusébio",
  "Franck Ribéry",
  "Gareth Bale",
  "Gianluigi Donnarumma",
  "Johan Cruyff",
  "Júlio César",
  "Kaká",
  "Karim Benzema",
  "Khvicha Kvaratskhelia",
  "Lionel Messi",
  "Luís Figo",
  "Luis Suárez",
  "Luka Modrić",
  "Manuel Neuer",
  "Mohamed Salah",
  "Neymar",
  "Oliver Kahn",
  "Ousmane Dembélé",
  "Paolo Maldini",
  "Petr Čech",
  "Robert Lewandowski",
  "Roberto Carlos",
  "Rodri",
  "Ronaldinho",
  "Sergio Ramos",
  "Thibaut Courtois",
  "Toni Kroos",
  "Vinícius Júnior",
  "Virgil van Dijk",
  "Vitinha",
  "Wesley Sneijder",
  "Xavi",
  "Zinedine Zidane",
]);

export function hasChampionImage(name: string): boolean {
  return CHAMPION_IMAGE_NAMES.has(name);
}

export function championImageSrc(name: string): string {
  return `/champion-images/${encodeURIComponent(name)}-champion.png`;
}
