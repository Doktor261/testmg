/* Teile-Katalog: Nomenklatur nach Terminologia Anatomica, Texte folgen in Phase 7.
   explode: vec = Verschiebung in mm (x,y,z), phase 1 (Achse) oder 2 (Schalen öffnen),
            split = obere Hälfte +vec, untere Hälfte -vec, radial = Verschiebung in mm entlang der Ansatz-Normalen,
            delay = Staffelung (0–0,12 der Regler-Strecke). */
window.EYE = window.EYE || {};
(function () {
  'use strict';

  const GROUPS = {
    fibrosa:   { name: 'Tunica fibrosa bulbi', de: 'Äußere Augenhaut' },
    vasculosa: { name: 'Tunica vasculosa bulbi (Uvea)', de: 'Mittlere Augenhaut' },
    interna:   { name: 'Tunica interna bulbi', de: 'Innere Augenhaut' },
    inhalt:    { name: 'Contenta bulbi', de: 'Inhalt des Bulbus' },
    muskeln:   { name: 'Musculi bulbi', de: 'Äußere Augenmuskeln' },
    nerv:      { name: 'N. opticus und Gefäße', de: 'Sehnerv und Gefäße' }
  };

  const Z = (z) => [0, 0, z];
  const Y = (y) => [0, y, 0];

  const PARTS = [
    // 1. Tunica fibrosa bulbi
    { id: 'cornea', la: 'Cornea', de: 'Hornhaut', group: 'fibrosa', color: 0xd9eef5, opacity: 0.25, rough: 0.05,
      explode: { vec: Z(18), phase: 1, delay: 0 }, main: true },
    { id: 'sclera', la: 'Sclera', de: 'Lederhaut', group: 'fibrosa', color: 0xf1eee6, opacity: 1, rough: 0.7,
      explode: { vec: Y(16), phase: 2, split: true, delay: 0 }, main: true },
    { id: 'limbus', la: 'Limbus corneae', de: 'Hornhautrand', group: 'fibrosa', color: 0xcfd9dc, opacity: 0.6,
      explode: { vec: Z(18), phase: 1, delay: 0 } },
    { id: 'sinus_venosus', la: 'Sinus venosus sclerae', de: 'Schlemm-Kanal', group: 'fibrosa', color: 0x4f86c6, opacity: 1,
      explode: { vec: Z(15), phase: 1, delay: 0.01 } },
    { id: 'reticulum', la: 'Reticulum trabeculare', de: 'Trabekelwerk', group: 'fibrosa', color: 0xc9a77c, opacity: 1,
      explode: { vec: Z(15), phase: 1, delay: 0.01 } },
    { id: 'lamina_cribrosa', la: 'Lamina cribrosa sclerae', de: 'Siebplatte der Lederhaut', group: 'fibrosa', color: 0xe6dcc4, opacity: 1,
      explode: { vec: Y(-16), phase: 2, delay: 0 } },

    // 2. Tunica vasculosa bulbi (Uvea)
    { id: 'iris', la: 'Iris', de: 'Regenbogenhaut', group: 'vasculosa', color: 0x8a7442, opacity: 1, rough: 0.55,
      explode: { vec: Z(12), phase: 1, delay: 0.02 }, main: true },
    { id: 'sphincter_pupillae', la: 'M. sphincter pupillae', de: 'Pupillenverengerer', group: 'vasculosa', color: 0xa8714a, opacity: 1,
      explode: { vec: Z(12), phase: 1, delay: 0.02 } },
    { id: 'dilatator_pupillae', la: 'M. dilatator pupillae', de: 'Pupillenerweiterer', group: 'vasculosa', color: 0x8d6a52, opacity: 1,
      explode: { vec: Z(12), phase: 1, delay: 0.02 } },
    { id: 'corpus_ciliare', la: 'Corpus ciliare', de: 'Ziliarkörper', group: 'vasculosa', color: 0xb8766a, opacity: 1,
      explode: { vec: Z(3), phase: 1, delay: 0.06 }, main: true },
    { id: 'processus_ciliares', la: 'Processus ciliares', de: 'Ziliarfortsätze', group: 'vasculosa', color: 0xecc9bd, opacity: 1,
      explode: { vec: Z(3), phase: 1, delay: 0.06 } },
    { id: 'm_ciliaris', la: 'M. ciliaris', de: 'Ziliarmuskel', group: 'vasculosa', color: 0xa95a50, opacity: 1,
      explode: { vec: Z(3), phase: 1, delay: 0.06 } },
    { id: 'choroidea', la: 'Choroidea', de: 'Aderhaut', group: 'vasculosa', color: 0x5d2b24, opacity: 1, rough: 0.8,
      explode: { vec: Y(10), phase: 2, split: true, delay: 0.03 }, main: true },

    // 3. Tunica interna bulbi
    { id: 'retina', la: 'Retina, Pars optica', de: 'Netzhaut (lichtempfindlicher Teil)', group: 'interna', color: 0xe9946a, opacity: 1, rough: 0.6,
      explode: { vec: Y(5), phase: 2, split: true, delay: 0.06 }, main: true },
    { id: 'ora_serrata', la: 'Ora serrata', de: 'Ora serrata', group: 'interna', color: 0xd8a878, opacity: 1,
      explode: { vec: Y(5), phase: 2, split: true, delay: 0.06 } },
    { id: 'pars_caeca', la: 'Pars caeca retinae', de: 'Blinder Netzhautteil', group: 'interna', color: 0x4a3a44, opacity: 1,
      explode: { vec: Z(3), phase: 1, delay: 0.06 } },
    { id: 'macula', la: 'Macula lutea', de: 'Gelber Fleck', group: 'interna', color: 0xd9a63f, opacity: 1,
      explode: { vec: Y(-5), phase: 2, delay: 0.06 }, main: true },
    { id: 'fovea', la: 'Fovea centralis', de: 'Sehgrube', group: 'interna', color: 0xb97a2e, opacity: 1,
      explode: { vec: Y(-5), phase: 2, delay: 0.06 } },
    { id: 'discus_nervi_optici', la: 'Discus nervi optici', de: 'Sehnervenpapille', group: 'interna', color: 0xf3cf9a, opacity: 1,
      explode: { vec: Y(-5), phase: 2, delay: 0.06 }, main: true },

    // 4. Inhalt des Bulbus
    { id: 'lens_capsula', la: 'Lens, Capsula', de: 'Linsenkapsel', group: 'inhalt', color: 0xd2e8ff, opacity: 0.2, rough: 0.05,
      explode: { vec: Z(7), phase: 1, delay: 0.04 } },
    { id: 'lens_cortex', la: 'Lens, Cortex', de: 'Linsenrinde', group: 'inhalt', color: 0xeaeccc, opacity: 0.4, rough: 0.1,
      explode: { vec: Z(7), phase: 1, delay: 0.04 }, main: true },
    { id: 'lens_nucleus', la: 'Lens, Nucleus', de: 'Linsenkern', group: 'inhalt', color: 0xf3d98a, opacity: 0.7, rough: 0.2,
      explode: { vec: Z(7), phase: 1, delay: 0.04 } },
    { id: 'fibrae_zonulares', la: 'Fibrae zonulares', de: 'Zonulafasern (Zinn)', group: 'inhalt', color: 0xf4f4f4, opacity: 0.8,
      explode: { vec: Z(7), phase: 1, delay: 0.04 } },
    { id: 'corpus_vitreum', la: 'Corpus vitreum', de: 'Glaskörper', group: 'inhalt', color: 0xbfe6f2, opacity: 0.14, rough: 0.1,
      explode: { vec: Z(0), phase: 1, delay: 0 }, main: true },
    { id: 'canalis_hyaloideus', la: 'Canalis hyaloideus', de: 'Cloquet-Kanal', group: 'inhalt', color: 0x9fd0e0, opacity: 0.5,
      explode: { vec: Z(0), phase: 1, delay: 0 } },
    { id: 'camera_anterior', la: 'Camera anterior bulbi', de: 'Vordere Augenkammer', group: 'inhalt', color: 0x8cc8ff, opacity: 0.35, hidden: true,
      explode: { vec: Z(12), phase: 1, delay: 0.02 } },
    { id: 'camera_posterior', la: 'Camera posterior bulbi', de: 'Hintere Augenkammer', group: 'inhalt', color: 0x8cffd0, opacity: 0.45, hidden: true,
      explode: { vec: Z(9.5), phase: 1, delay: 0.03 } },

    // 5. Mm. bulbi
    { id: 'rectus_medialis', la: 'M. rectus medialis', de: 'Innerer gerader Augenmuskel', group: 'muskeln', color: 0xa8453a, opacity: 1, muscle: true,
      explode: { radial: 10, phase: 2, delay: 0.08 }, main: true },
    { id: 'rectus_inferior', la: 'M. rectus inferior', de: 'Unterer gerader Augenmuskel', group: 'muskeln', color: 0xa8453a, opacity: 1, muscle: true,
      explode: { radial: 10, phase: 2, delay: 0.08 }, main: true },
    { id: 'rectus_lateralis', la: 'M. rectus lateralis', de: 'Äußerer gerader Augenmuskel', group: 'muskeln', color: 0xa8453a, opacity: 1, muscle: true,
      explode: { radial: 10, phase: 2, delay: 0.08 }, main: true },
    { id: 'rectus_superior', la: 'M. rectus superior', de: 'Oberer gerader Augenmuskel', group: 'muskeln', color: 0xa8453a, opacity: 1, muscle: true,
      explode: { radial: 10, phase: 2, delay: 0.08 }, main: true },
    { id: 'obliquus_superior', la: 'M. obliquus superior', de: 'Oberer schräger Augenmuskel', group: 'muskeln', color: 0xa8453a, opacity: 1, muscle: true,
      explode: { radial: 10, phase: 2, delay: 0.08 }, main: true },
    { id: 'obliquus_inferior', la: 'M. obliquus inferior', de: 'Unterer schräger Augenmuskel', group: 'muskeln', color: 0xa8453a, opacity: 1, muscle: true,
      explode: { radial: 10, phase: 2, delay: 0.08 }, main: true },
    { id: 'trochlea', la: 'Trochlea', de: 'Rolle des oberen schrägen Augenmuskels', group: 'muskeln', color: 0xdad2c0, opacity: 1,
      explode: { radial: 10, phase: 2, delay: 0.08, follow: 'obliquus_superior' } },
    { id: 'anulus_tendineus', la: 'Anulus tendineus communis', de: 'Gemeinsamer Sehnenring (Zinn)', group: 'muskeln', color: 0xeadfca, opacity: 1,
      explode: { radial: 10, phase: 2, delay: 0.08, follow: 'rectus_medialis' } },

    // 6. N. opticus und Gefäße
    { id: 'n_opticus', la: 'N. opticus (N. II)', de: 'Sehnerv', group: 'nerv', color: 0xf1e3b6, opacity: 1, rough: 0.5,
      explode: { vec: Z(-12), phase: 1, delay: 0 }, main: true },
    { id: 'vagina_externa', la: 'Vagina externa (Dura mater)', de: 'Äußere Sehnervenscheide (Dura)', group: 'nerv', color: 0xd9c9a0, opacity: 0.45,
      explode: { vec: Z(-12), phase: 1, delay: 0, extra: [0, 0, -8], extraPhase: 2 } },
    { id: 'arachnoidea', la: 'Arachnoidea mater', de: 'Spinngewebshaut des Sehnervs', group: 'nerv', color: 0xcad6e0, opacity: 0.5,
      explode: { vec: Z(-12), phase: 1, delay: 0, extra: [0, 0, -4], extraPhase: 2 } },
    { id: 'vagina_interna', la: 'Vagina interna (Pia mater)', de: 'Innere Sehnervenscheide (Pia)', group: 'nerv', color: 0xe9d4dc, opacity: 0.6,
      explode: { vec: Z(-12), phase: 1, delay: 0 } },
    { id: 'a_centralis', la: 'A. centralis retinae', de: 'Zentralarterie der Netzhaut', group: 'nerv', color: 0xd22a2a, opacity: 1,
      explode: { vec: Z(-12), phase: 1, delay: 0 } },
    { id: 'v_centralis', la: 'V. centralis retinae', de: 'Zentralvene der Netzhaut', group: 'nerv', color: 0x2f55b8, opacity: 1,
      explode: { vec: Z(-12), phase: 1, delay: 0 } },
    { id: 'aa_ciliares_breves', la: 'Aa. ciliares posteriores breves', de: 'Kurze hintere Ziliararterien', group: 'nerv', color: 0xc83c3c, opacity: 1,
      explode: { vec: Z(-12), phase: 1, delay: 0 } },
    { id: 'aa_ciliares_longae', la: 'Aa. ciliares posteriores longae', de: 'Lange hintere Ziliararterien', group: 'nerv', color: 0xe0483a, opacity: 1,
      explode: { vec: Y(10), phase: 2, split: true, delay: 0.03 } },
    { id: 'vv_vorticosae', la: 'Vv. vorticosae', de: 'Wirbelvenen', group: 'nerv', color: 0x3a4fa8, opacity: 1,
      explode: { vec: Y(10), phase: 2, split: true, delay: 0.03 } }
  ];

  const byId = {};
  PARTS.forEach((p) => {
    p.facts = p.facts || [];
    p.text = p.text || '';
    p.clinic = p.clinic || '';
    byId[p.id] = p;
  });

  EYE.GROUPS = GROUPS;
  EYE.PARTS = PARTS;
  EYE.partById = byId;
})();
