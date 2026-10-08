// Sve što se menja bez diranja koda: broj telefona, boje, projekti, tajming animacije.

export const CONFIG = {
  // TODO: pravi WhatsApp broj, međunarodni format bez "+" i bez početne nule (npr. 381641234567)
  whatsapp: '381600000000',

  hero: {
    // Uspravni ekrani (telefon): 9:16 animacija
    frames: 'assets/frames/scroll/',
    // Široki ekrani (računar, 16:9): druga animacija. Isti uslov (media) mora da stoji i u style.css i u <head> index.html.
    wide: { frames: 'assets/frames/wide/', media: '(min-aspect-ratio: 1/1)' },
    // Deo skrola (0 do 1) u kome slika stoji na prvom, odnosno poslednjem frejmu.
    // Dužina animacije se menja u style.css (--hero-units = broj ekrana skrolovanja).
    holdStart: 0.05,
    holdEnd: 0.06,
  },

  // Palete boja na stranicama proizvoda. Kad boja ima `image`, klik na nju menja glavnu sliku na stranici
  // (npr. image: 'assets/img/kamen-bela.webp'). Boja bez `image` ostavlja trenutnu sliku.
  products: [
    {
      id: 'kamen',
      name: { sr: 'Kamene ploče za ogradu', en: 'Stone panels for fences' },
      colors: [
        { id: 'antracit', hex: '#57534e', image: 'assets/img/kamen-antracit.webp', name: { sr: 'Antracit', en: 'Anthracite' } },
        { id: 'siva', hex: '#8f8c87', image: 'assets/img/kamen-siva.webp', name: { sr: 'Siva', en: 'Grey' } },
        { id: 'bela', hex: '#e2ded7', image: 'assets/img/kamen-bela.webp', name: { sr: 'Bela', en: 'White' } },
        { id: 'krem', hex: '#d3c8b2', image: 'assets/img/kamen-krem.webp', name: { sr: 'Krem', en: 'Cream' } },
        { id: 'terakota', hex: '#c0613f', image: 'assets/img/kamen-terakota.webp', name: { sr: 'Terakota', en: 'Terracotta' } },
      ],
    },
    {
      id: 'cigla',
      name: { sr: 'Ukrasne fasadne cigle', en: 'Decorative facade bricks' },
      colors: [
        { id: 'narandzasta', hex: '#c7804e', image: 'assets/img/cigla-narandzasta.webp', name: { sr: 'Narandžasta', en: 'Orange' } },
        { id: 'crvena', hex: '#96453a', name: { sr: 'Crvena', en: 'Red' } },
        { id: 'bela', hex: '#e9e5dc', name: { sr: 'Bela', en: 'White' } },
        { id: 'pesak', hex: '#dacda6', name: { sr: 'Pesak', en: 'Sand' } },
        { id: 'siva', hex: '#8d9092', name: { sr: 'Siva', en: 'Grey' } },
        { id: 'braon', hex: '#7a5b48', name: { sr: 'Braon', en: 'Brown' } },
      ],
    },
  ],

  // TODO: prave fotografije realizovanih projekata. Kartica bez slike se prikazuje kao "uskoro".
  projects: [
    {
      image: 'assets/img/projekat-zid.webp',
      category: 'ograda',
      title: { sr: 'Zid od dekorativnog kamena', en: 'Decorative stone wall' },
      meta: { sr: 'Kamen · Antracit', en: 'Stone · Anthracite' },
    },
    { category: 'fasada' },
    { category: 'usluge' },
  ],
};
