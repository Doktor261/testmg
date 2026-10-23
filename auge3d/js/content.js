// Inhalte für das 3D-Augenmodell: Gruppen, Texte, Fakten, klinische Bezüge, Muskeldaten.
// Maße und Muskeldaten nach PLAN.md (Abschnitt 3); Literaturschwankungen als gerundete Mittelwerte.
window.EYE = window.EYE || {};

EYE.GROUPS = [
  { id: 'tunica_fibrosa', la: 'Tunica fibrosa bulbi', de: 'Faserhaut des Augapfels' },
  { id: 'uvea', la: 'Tunica vasculosa bulbi (Uvea)', de: 'Gefäßhaut des Augapfels' },
  { id: 'tunica_interna', la: 'Tunica interna bulbi', de: 'Innere Augenhaut (Netzhaut)' },
  { id: 'contents', la: 'Contenta bulbi oculi', de: 'Inhalt des Augapfels' },
  { id: 'muscles', la: 'Musculi bulbi', de: 'Augenmuskeln' },
  { id: 'nerve_vessels', la: 'Nervus opticus et vasa', de: 'Sehnerv und Gefäße' }
];

EYE.CONTENT = {

  // ---- Tunica fibrosa bulbi ----

  cornea: {
    la: 'Cornea', de: 'Hornhaut', group: 'tunica_fibrosa',
    text: 'Die Hornhaut ist der vordere, glasklare Abschnitt der äußeren Augenhaut und der stärkste brechende Teil des optischen Systems. Sie besteht aus fünf Schichten (Epithel, Bowman-Membran, Stroma, Descemet-Membran, Endothel). Das Endothel hält durch aktive Pumpfunktion das Stroma entquollen. Die Kornea ist avaskulär und wird vom N. trigeminus (V1) sensibel versorgt.',
    facts: [
      'Durchmesser horizontal ≈ 11,7 mm',
      'Krümmungsradien: vorn ≈ 7,8 mm, hinten ≈ 6,5 mm',
      'Dicke zentral ≈ 0,55 mm, peripher ≈ 0,7 mm',
      'Brechkraft ≈ 43 dpt (≈ 2/3 der Gesamtbrechkraft des Auges)'
    ],
    clinic: 'Keratokonus (kegelförmige Vorwölbung mit Ausdünnung), Hornhautödem bei Endothelschaden und Keratoplastik. Der Kornealreflex (Afferenz N. V1, Efferenz N. VII) prüft die Trigeminusfunktion.'
  },

  sclera: {
    la: 'Sclera', de: 'Lederhaut', group: 'tunica_fibrosa',
    text: 'Die Sklera ist die derbe, bindegewebige Außenhülle des Bulbus aus dicht gepackten Kollagenfasern. Sie gibt dem Auge Form und Stabilität. Vorn geht sie im Limbus in die Kornea über; hinten wird sie an der Lamina cribrosa vom Sehnerv durchbrochen. An der Sklera setzen alle äußeren Augenmuskeln an.',
    facts: [
      'Außenradius ≈ 12,0 mm',
      'Dicke ≈ 0,3 mm hinter den Muskelansätzen, ≈ 1,0 mm am hinteren Pol',
      'Episklerale Gefäße liegen oberflächlich und sind an Rötungen beteiligt',
      'Die Sklera ist die Ansatzfläche aller sechs äußeren Augenmuskeln'
    ],
    clinic: 'Skleritis: tiefer, oft heftiger Schmerz, häufig mit systemischen Autoimmunerkrankungen assoziiert. Myope Bulbi zeigen eine Dehnung der hinteren Sklera (Staphylom).'
  },

  limbus: {
    la: 'Limbus corneae', de: 'Hornhautrand', group: 'tunica_fibrosa',
    text: 'Der Limbus ist die Übergangszone zwischen Kornea und Sklera. Hier liegt die Stammzellnische der Hornhaut (Palisaden von Vogt), die das Korneaepithel erneuert. Im Limbusbereich liegt außerdem der Kammerwinkel mit dem Trabekelwerk und dem Schlemm-Kanal. Die Kornea selbst besitzt keine Gefäße, die Limbusgefäße sind die einzige Gefäßquelle des Randes.',
    facts: [
      'Durchmesser horizontal ≈ 11,7 mm',
      'Lage ≈ 10,5 mm vor dem Bulbuszentrum',
      'Stammzellnische in den Palisaden von Vogt',
      'Übergang von der avaskulären Kornea zur Sklera'
    ],
    clinic: 'Limbusstammzellinsuffizienz (z. B. nach Verätzung oder durch Kontaktlinsenschäden) führt zu Einwachsen von Bindehautepithel und Gefäßen in die Hornhaut. Die Gonioskopie erfolgt am Limbus-Kammerwinkel.'
  },

  schlemm: {
    la: 'Sinus venosus sclerae', de: 'Schlemm-Kanal', group: 'tunica_fibrosa',
    text: 'Der Schlemm-Kanal ist ein ringförmiger, endothelausgekleideter Abflusskanal im Kammerwinkel. Er nimmt das Kammerwasser aus dem Trabekelwerk auf und leitet es über Sammelkanälchen in die episkleralen Venen. Er ist der wichtigste Abflussweg des Kammerwassers.',
    facts: [
      'Querschnitt ≈ 0,3 mm',
      'Liegt im Skleralsulcus nahe dem Limbus',
      'Ableitung über Sammelkanälchen in episklerale Venen',
      'Ringförmig um die Kornea-Peripherie'
    ],
    clinic: 'Erhöhter Abflusswiderstand im Trabekelwerk und Kanal führt zu einem Druckanstieg im Auge (primäres Offenwinkelglaukom). Trabekuloplastik und Mikrostent-Verfahren setzen an dieser Abflussstrecke an.'
  },

  trabecular: {
    la: 'Reticulum trabeculare', de: 'Trabekelwerk', group: 'tunica_fibrosa',
    text: 'Das Trabekelwerk ist ein schwammartiges Maschenwerk aus Kollagen und elastischen Fasern mit Endothelzellen im Kammerwinkel zwischen Kornea und Iris. Es filtert das Kammerwasser, bevor es in den Schlemm-Kanal gelangt. Man unterteilt es in einen uveoskleralen, einen korneoskleralen und einen juxtakanalikulären Anteil.',
    facts: [
      'Drei Anteile: uveoskleral, korneoskleral, juxtakanalikulär',
      'Hauptwiderstand des Kammerwasserabflusses',
      'Endothelzellen bedecken die Trabekel und regulieren den Abfluss'
    ],
    clinic: 'Verlegung des Trabekelwerks, z. B. durch Pigment oder Pseudoexfoliationsmaterial, ist eine häufige Ursache des Offenwinkelglaukoms. Die Laser-Trabekuloplastik (SLT) regt die Zellen des Trabekelwerks zum Umbau an.'
  },

  lamina_cribrosa: {
    la: 'Lamina cribrosa sclerae', de: 'Siebplatte der Sklera', group: 'tunica_fibrosa',
    text: 'Die Lamina cribrosa ist eine siebartig durchbrochene Platte aus Kollagen und Elastin im hinteren Skleradurchtritt des Sehnervs. Hier verlassen die Axone der Ganglienzellen den Bulbus. Die Platte stützt den Nervenkopf mechanisch; ihre Poren sind die Austrittsstellen der Nervenfasern.',
    facts: [
      'Lage am hinteren Pol; die Öffnung entspricht etwa dem Papillendurchmesser',
      'Unterteilt in einen prälaminären und einen laminären Abschnitt',
      'Der Druckgradient zwischen Augeninnendruck und Liquordruck wirkt auf die Platte'
    ],
    clinic: 'Beim Glaukom verlagert sich die Lamina cribrosa nach hinten und wird geschädigt; die durchtretenden Axone gehen zugrunde, und die Papille wird ausgehöhlt.'
  },

  // ---- Tunica vasculosa bulbi (Uvea) ----

  iris: {
    la: 'Iris', de: 'Regenbogenhaut', group: 'uvea',
    text: 'Die Iris ist eine pigmentierte, muskelbesetzte Blende vor der Linse, die die Pupille und damit den Lichteinfall reguliert. Das Irisstroma enthält Melanozyten, die die Augenfarbe bestimmen. Die Iris teilt den vorderen Augenabschnitt in Vorder- und Hinterkammer.',
    facts: [
      'Durchmesser ≈ 12 mm',
      'Pupille in Ruhe ≈ 3,5 mm',
      'Dicke ≈ 0,3–0,6 mm; Krause (Collarette) bei r ≈ 3 mm',
      'Die Augenfarbe wird durch den Melaningehalt des vorderen Stromas bestimmt'
    ],
    clinic: 'Iritis (Uveitis anterior) mit Schmerz, Rötung und Photophobie. Die Lichtreaktion der Pupille prüft die Funktion von N. oculomotorius und Sympathikus.'
  },

  sphincter_pupillae: {
    la: 'Musculus sphincter pupillae', de: 'Pupillenschließmuskel', group: 'uvea',
    text: 'Der M. sphincter pupillae besteht aus glatten Muskelfasern, die ringförmig am Pupillenrand verlaufen. Er verengt die Pupille (Miosis). Die parasympathische Innervation erfolgt über den N. oculomotorius und das Ganglion ciliare; er wird bei Helligkeit und bei der Konvergenz-Nahreaktion aktiv.',
    facts: [
      'Ringförmig am Pupillenrand, Radius ≈ 1,75–2,5 mm',
      'Parasympathisch: N. oculomotorius → Ganglion ciliare → Nn. ciliares breves',
      'Verengt die Pupille bei Helligkeit und Naheinstellung'
    ],
    clinic: 'Atropin lähmt den Sphincter und erweitert die Pupille (Mydriasis); Pilocarpin bewirkt Miosis. Beim Adie-Syndrom ist die Lichtreaktion träge, die Akkommodationsreaktion gestört.'
  },

  dilatator_pupillae: {
    la: 'Musculus dilatator pupillae', de: 'Pupillenerweiterer', group: 'uvea',
    text: 'Der M. dilatator pupillae ist eine dünne, radiär angeordnete myoepitheliale Schicht auf der Hinterfläche der Iris. Er erweitert die Pupille (Mydriasis). Die sympathische Innervation erfolgt über das Ganglion cervicale superius und die Nn. ciliares longi.',
    facts: [
      'Radiär angeordnete Schicht auf der Irishinterfläche',
      'Sympathisch: Ganglion cervicale superius → Nn. ciliares longi',
      'Aktiv bei Dunkelheit und Schreck'
    ],
    clinic: 'Beim Horner-Syndrom (Ausfall der sympathischen Bahn) entstehen Miosis, Ptosis und Enophthalmus auf der betroffenen Seite; die Pupillendifferenz ist messbar.'
  },

  ciliary_body: {
    la: 'Corpus ciliare', de: 'Ziliarkörper', group: 'uvea',
    text: 'Der Ziliarkörper ist ein ringförmiger Wulst der Uvea zwischen Iris und Choroidea. Er hält die Linse über die Zonulafasern und enthält den M. ciliaris zur Akkommodation. Er besteht aus der vorderen, gefalteten Pars plicata mit den Processus ciliares und der hinteren, glatten Pars plana.',
    facts: [
      'Länge ≈ 6 mm: Pars plicata ≈ 2 mm, Pars plana ≈ 4 mm',
      'Reicht vom Skleralsporn bis zur Ora serrata',
      'Produziert das Kammerwasser über das Ziliarepithel'
    ],
    clinic: 'Zyklitis (Entzündung des Ziliarkörpers). Bei therapieresistentem Glaukom kann eine Zyklodestruktion mit Laser durchgeführt werden, die die Kammerwasserbildung reduziert.'
  },

  ciliary_processes: {
    la: 'Processus ciliares', de: 'Ziliarfortsätze', group: 'uvea',
    text: 'Die Processus ciliares sind radiär gestellte Falten der Pars plicata des Ziliarkörpers. Ihr Ziliarepithel sezerniert das Kammerwasser. An ihren Spitzen entspringen die Zonulafasern, die zum Linsenäquator ziehen.',
    facts: [
      'Etwa 70–80 Fortsätze, im Modell 72',
      'Kammerwassersekretion durch das Ziliarepithel (≈ 2–3 µl/min)',
      'Ursprung der Zonulafasern'
    ],
    clinic: 'Die medikamentöse Glaukomtherapie setzt an der Kammerwasserbildung an, z. B. mit Betablockern, Carboanhydrasehemmern und Alpha-2-Agonisten.'
  },

  ciliary_muscle: {
    la: 'Musculus ciliaris', de: 'Ziliarmuskel', group: 'uvea',
    text: 'Der M. ciliaris ist ein glatter Muskel im Ziliarkörper. Bei Kontraktion entspannt er die Zonulafasern, die Linse wird dicker und stärker brechend (Nahakkommodation). Er besteht aus Meridionalfasern (Brücke), radiären und zirkulären Fasern (Müller). Die Innervation ist parasympathisch über den N. oculomotorius.',
    facts: [
      'Fasertypen: Meridionalfasern (Brücke), radiär und zirkulär (Müller)',
      'Parasympathisch: N. oculomotorius, Ganglion ciliare',
      'Kontraktion entspannt die Zonula; die Linsenelastizität nimmt mit dem Alter ab'
    ],
    clinic: 'Presbyopie: Nachlassen der Linsenelastizität ab etwa dem 40.–45. Lebensjahr. Zykloplegika (z. B. Cyclopentolat) lähmen den M. ciliaris für die Refraktionsbestimmung.'
  },

  choroid: {
    la: 'Choroidea', de: 'Aderhaut', group: 'uvea',
    text: 'Die Choroidea ist eine gefäßreiche, pigmentierte Schicht zwischen Sklera und Retina. Sie versorgt die äußeren Netzhautschichten mit Sauerstoff, besonders die Photorezeptoren, über die Lamina choriocapillaris. Ihre Blutversorgung stammt aus den Aa. ciliares posteriores.',
    facts: [
      'Dicke ≈ 0,25 mm (zur Darstellung überhöht)',
      'Blutversorgung über die Aa. ciliares posteriores',
      'Abfluss über die Vv. vorticosae'
    ],
    clinic: 'Das Aderhautmelanom ist der häufigste primäre intraokulare Tumor des Erwachsenen. Bei der altersabhängigen Makuladegeneration (AMD) wachsen choroidale Neovaskularisationen durch die Bruch-Membran.'
  },

  // ---- Tunica interna bulbi ----

  retina: {
    la: 'Retina, Pars optica', de: 'Netzhaut (Pars optica)', group: 'tunica_interna',
    text: 'Die Retina ist die lichtempfindliche innere Schicht des Auges. Sie besteht aus zehn Schichten, darunter Photorezeptoren (Stäbchen und Zapfen), Bipolar- und Ganglienzellen. Die Axone der Ganglienzellen bilden den N. opticus. Außen liegt das retinale Pigmentepithel an.',
    facts: [
      'Dicke ≈ 0,1–0,5 mm (zur Darstellung überhöht)',
      'Innere Versorgung über die A. centralis retinae, äußere über die Choroidea',
      'Endet an der Ora serrata ≈ 6,5 mm hinter dem Limbus'
    ],
    clinic: 'Netzhautablösung (Ablatio retinae): die Netzhaut löst sich vom Pigmentepithel, die Photorezeptoren verlieren ihre Versorgung. Netzhautrisse mit Glaskörperzug sind eine häufige Ursache.'
  },

  ora_serrata: {
    la: 'Ora serrata', de: 'Zackenlinie', group: 'tunica_interna',
    text: 'Die Ora serrata ist die gezackte Grenze zwischen der Pars optica und der Pars caeca retinae. Hier endet die lichtempfindliche Netzhaut. Der Glaskörper ist an dieser Stelle mit der Netzhaut fest verbunden (Glaskörperbasis).',
    facts: [
      'Abstand vom Limbus ≈ 6,5 mm',
      'Glaskörperbasis ist hier fest verankert',
      'Übergang von der Pars optica zur Pars caeca'
    ],
    clinic: 'Lattendegeneration und Netzhautrisse an der Ora serrata sind Risikofaktoren für eine Netzhautablösung. Die Kontrolle erfolgt mit indirekter Ophthalmoskopie unter Eindellung.'
  },

  pars_caeca: {
    la: 'Pars caeca retinae', de: 'Blinder Teil der Netzhaut', group: 'tunica_interna',
    text: 'Die Pars caeca retinae ist der nicht lichtempfindliche vordere Anteil der Netzhaut. Sie bedeckt den Ziliarkörper und die Hinterfläche der Iris bis zum Pupillenrand. Sie enthält keine Photorezeptoren, nur Pigmentepithel und eine rudimentäre Nervenschicht.',
    facts: [
      'Bedeckt Pars plana, Pars plicata und die Irishinterfläche',
      'Keine Photorezeptoren',
      'Setzt sich bis zum Pupillenrand fort'
    ],
    clinic: 'Tumoren des Ziliarkörpers (z. B. Melanom) gehen von diesem Bereich aus. Bei der Pars-plana-Vitrektomie ist die Zone unmittelbar relevant.'
  },

  macula: {
    la: 'Macula lutea', de: 'Gelber Fleck', group: 'tunica_interna',
    text: 'Die Makula ist ein gelb pigmentierter Bereich der Netzhaut am hinteren Pol mit hoher Zapfendichte. Das gelbe Pigment (Lutein und Zeaxanthin) filtert kurzwelliges Licht. Die Makula vermittelt das zentrale, scharfe Sehen und das Farbsehen.',
    facts: [
      'Durchmesser ≈ 5,5 mm (≈ 29° Gesichtsfeld)',
      'Gelbpigment: Lutein und Zeaxanthin',
      'Zentrum ≈ 1,2 mm temporal und 0,4 mm inferior des hinteren Pols'
    ],
    clinic: 'Die altersabhängige Makuladegeneration (AMD) und das diabetische Makulaödem sind die häufigsten Ursachen für Sehverlust im Zentrum. Makulaforamen und epiretinale Membranen führen ebenfalls zu Verzerrtsehen.'
  },

  fovea: {
    la: 'Fovea centralis', de: 'Zentralgrube', group: 'tunica_interna',
    text: 'Die Fovea centralis ist die zentrale Grube der Makula. Sie enthält fast nur Zapfen. In der Foveola fehlen Gefäße und innere Netzhautschichten, so dass das Licht direkt auf die Zapfen trifft. Hier wird die höchste Sehschärfe erreicht.',
    facts: [
      'Durchmesser ≈ 1,5 mm, Foveola ≈ 0,35 mm',
      'Lage ≈ 1,2 mm temporal und 0,4 mm inferior des hinteren Pols',
      'Ausschließlich Zapfen in der Foveola'
    ],
    clinic: 'Ein Makulaforamen (Loch in der Fovea) führt zu einem zentralen Skotom und Metamorphopsien. Bei der AMD kann die Foveola zugrunde gehen. Die Dicke der Fovea wird in der OCT-Diagnostik vermessen.'
  },

  optic_disc: {
    la: 'Discus nervi optici', de: 'Papille (Sehnervenkopf)', group: 'tunica_interna',
    text: 'Die Papille ist die Austrittsstelle des N. opticus aus dem Bulbus. Hier sammeln sich die Axone der Ganglienzellen, und es fehlt die Netzhaut: die Papille ist der physiologische blinde Fleck. Die zentrale Delle (Excavatio) entsteht durch den Durchtritt der Gefäße und Axone. Die Papille liegt nasal der Fovea.',
    facts: [
      'Maße ≈ 1,7 × 1,9 mm (hochoval)',
      'Mitte ≈ 3,0 mm nasal und ≈ 0,3 mm superior des hinteren Pols',
      'Ca. 4 mm von der Fovea entfernt'
    ],
    clinic: 'Papillenödem bei erhöhtem Hirndruck (Stauungspapille) oder Optikusneuritis. Beim Glaukom ist die Excavatio vergrößert, der Randsaum ausgedünnt (vergrößerte Cup-to-Disc-Ratio).'
  },

  // ---- Inhalt des Bulbus ----

  lens_capsule: {
    la: 'Capsula lentis', de: 'Linsenkapsel', group: 'contents',
    text: 'Die Linsenkapsel ist eine elastische, glashelle Basalmembran, die die Linse vollständig umschließt. Am Linsenäquator setzen die Zonulafasern an. Das Epithel der Kapsel liegt nur an der Vorderseite. Die Kapsel verändert bei Akkommodation ihre Krümmung.',
    facts: [
      'Vorderseite dicker als die Rückseite',
      'Verankerung der Zonulafasern am Äquator',
      'Elastisch: Krümmungsänderung bei Akkommodation'
    ],
    clinic: 'Die Kapsulorhexis (zirkuläre Eröffnung der vorderen Kapsel) ist der erste Schritt der Kataraktoperation. Nach der Implantation trübt die hintere Kapsel häufig ein (Nachstar).'
  },

  lens_cortex: {
    la: 'Cortex lentis', de: 'Linsenrinde', group: 'contents',
    text: 'Die Linsenrinde umgibt den Kern und besteht aus jüngeren, noch wachsenden Linsenfasern. Diese entstehen aus den Epithelzellen am Äquator und werden lebenslang von außen aufgelagert. Die Fasern enthalten Kristallinproteine und sind wasserreich und elastisch.',
    facts: [
      'Neubildung aus den Epithelzellen am Linsenäquator',
      'Hauptproteine: Kristalline (α, β, γ)',
      'Lebenslanger Zuwachs, die Linse wird mit dem Alter dicker'
    ],
    clinic: 'Rindenkatarakt: speichenförmige Trübungen, meist peripher beginnend. Diabetes und Steroide begünstigen die hintere subkapsuläre Trübung.'
  },

  lens_nucleus: {
    la: 'Nucleus lentis', de: 'Linsenkern', group: 'contents',
    text: 'Der Linsenkern ist der zentrale, älteste Teil der Linse mit den Fasern aus der embryonalen und fetalen Zeit. Er macht ca. 60 % der Linsenmasse aus. Mit dem Alter verdichtet sich der Kern und verfärbt sich gelblich-bräunlich (Kernsklerose). Die Linse ist avaskulär und wird über das Kammerwasser und den Glaskörper ernährt.',
    facts: [
      'Ca. 60 % der Linsenmasse',
      'Verdichtung und Gelbfärbung im Alter',
      'Keine Blutgefäße: Ernährung über Kammerwasser und Glaskörper'
    ],
    clinic: 'Kernkatarakt (Kernsklerose): Die Brechkraft nimmt zu (Myopisierung), der Kern vergilbt. Bei der Kataraktoperation wird der Kern per Phakoemulsifikation entfernt.'
  },

  zonule: {
    la: 'Fibrae zonulares', de: 'Zonulafasern (Zinn-Zonula)', group: 'contents',
    text: 'Die Zonulafasern ziehen von den Processus ciliares zur Linsenkapsel am Äquator und halten die Linse in ihrer Position. Man unterscheidet vordere und hintere Faserzüge. Bei der Akkommodation entspannt der M. ciliaris die Zonula, die Linse wird dicker.',
    facts: [
      'Ca. 2 × 144 Fasern im Modell, vordere und hintere Faserzüge',
      'Verlauf von den Processus ciliares zum Linsenäquator',
      'Spannung der Zonula durch den M. ciliaris gesteuert'
    ],
    clinic: 'Zonulolyse beim Pseudoexfoliationssyndrom oder Schwäche der Fasern beim Marfan-Syndrom (Fibrillin-1-Defekt) kann zur Linsenluxation führen. Bei der Kataraktoperation sind dann Kapselspannringe nötig.'
  },

  vitreous: {
    la: 'Corpus vitreum', de: 'Glaskörper', group: 'contents',
    text: 'Der Glaskörper ist ein glasklares, gelartiges Gewebe, das den Raum hinter der Linse füllt und dem Bulbus Form und Stütze gibt. Er besteht zu rund 99 % aus Wasser, dazu Hyaluronsäure und feinen Kollagenfibrillen (Typ II). Vorn liegt er an der Linsenrückfläche an, an der Ora serrata ist er fest verankert.',
    facts: [
      'Ca. 99 % Wasser',
      'Hyaluronsäure und Kollagenfibrillen (Typ II)',
      'Glaskörperbasis an der Ora serrata verankert'
    ],
    clinic: 'Die hintere Glaskörperabhebung (PVD) ist altersbedingt häufig und kann Netzhautrisse verursachen. Mouches volantes entstehen durch Trübungen im Glaskörper.'
  },

  hyaloid_canal: {
    la: 'Canalis hyaloideus', de: 'Glaskörperkanal (Cloquet-Kanal)', group: 'contents',
    text: 'Der Canalis hyaloideus ist ein fetaler Kanal, in dem die embryonale A. hyaloidea von der Papille zur Linsenrückfläche verläuft. Er bildet sich in der Regel vor der Geburt zurück und hinterlässt einen schmalen, glaskörpergefüllten Raum.',
    facts: [
      'Verlauf von der Papille zur hinteren Linsenkapsel',
      'Embryonaler Rest der A. hyaloidea',
      'Meist vor der Geburt zurückgebildet'
    ],
    clinic: 'Der persistierende hyaloidale Gefäßapparat (PHPV) ist eine seltene angeborene Fehlbildung mit Trübung hinter der Linse, häufig verbunden mit Netzhautfehlern.'
  },

  anterior_chamber: {
    la: 'Camera anterior bulbi', de: 'Vorderkammer', group: 'contents',
    text: 'Die Vorderkammer ist der mit Kammerwasser gefüllte Raum zwischen Kornea und Iris. Das Kammerwasser entsteht im Ziliarkörper, fließt durch die Pupille nach vorn und wird über das Trabekelwerk und den Schlemm-Kanal abgeleitet. Es ernährt Kornea und Linse und bestimmt zusammen mit dem Abfluss den Augeninnendruck.',
    facts: [
      'Tiefe ≈ 3,0 mm (Hinterfläche der Kornea bis Linsenvorderfläche)',
      'Kammerwasserbildung ca. 2–3 µl pro Minute',
      'Abfluss über Trabekelwerk und Schlemm-Kanal'
    ],
    clinic: 'Hypopyon (Eiter), Hyphäma (Blut) und Glaukom betreffen die Vorderkammer. Die Gonioskopie beurteilt den Kammerwinkel.'
  },

  posterior_chamber: {
    la: 'Camera posterior bulbi', de: 'Hinterkammer', group: 'contents',
    text: 'Die Hinterkammer ist ein schmaler, ringförmiger Spalt zwischen Irishinterfläche, Zonula und Linsenvorderfläche. Das Kammerwasser fließt aus der Hinterkammer durch die Pupille in die Vorderkammer. Ist die Pupille verlegt, staut sich das Kammerwasser und drückt die Iris nach vorn.',
    facts: [
      'Verbindung zur Vorderkammer über die Pupille',
      'Kammerwasserzirkulation: Hinterkammer → Pupille → Vorderkammer',
      'Eng bei nach vorn gedrängter Iris'
    ],
    clinic: 'Beim Pupillarblockglaukom (Winkelblock) verlegt die Linse den Pupillarspalt. Die Iris wird nach vorn gedrückt und verschließt den Kammerwinkel. Die Behandlung erfolgt mit einer Laser-Iridotomie.'
  },

  // ---- Mm. bulbi ----

  rectus_superior: {
    la: 'Musculus rectus superior', de: 'Oberer gerader Augenmuskel', group: 'muscles',
    text: 'Der M. rectus superior entspringt am Anulus tendineus communis oben und zieht schräg über den Bulbus zur oberen Sklera. Er verläuft ca. 23° zur Sehachse. Seine Hauptfunktion ist die Hebung des Auges. In Abduktionsstellung wirkt er zusätzlich inzyklorotierend und adduzierend.',
    facts: [
      'Ansatz ≈ 7,7 mm vom Limbus, Breite ≈ 10,6 mm (Tillaux-Spirale)',
      'Sehnenlänge ≈ 5,8 mm',
      'Verlauf ca. 23° zur Sehachse, Ansatz nasal weiter vorn'
    ],
    clinic: 'Lähmung führt zu eingeschränkter Hebung mit Hypotropie des betroffenen Auges und einer Torsionskomponente. Die Lähmung betrifft meist den N. oculomotorius (R. superior).',
    muscle: {
      innervation: 'N. oculomotorius (N. III, R. superior)',
      primary: 'Hebung',
      secondary: 'Inzyklorotation',
      tertiary: 'Adduktion'
    }
  },

  rectus_inferior: {
    la: 'Musculus rectus inferior', de: 'Unterer gerader Augenmuskel', group: 'muscles',
    text: 'Der M. rectus inferior entspringt am Anulus tendineus communis unten und zieht zur unteren Sklera. Er verläuft ebenfalls ca. 23° zur Sehachse. In Abduktionsstellung ist er der Hauptsenker des Auges; in der Mittelstellung wirkt er zusätzlich exzyklorotierend und adduzierend.',
    facts: [
      'Ansatz ≈ 6,5 mm vom Limbus, Breite ≈ 9,8 mm (Tillaux-Spirale)',
      'Sehnenlänge ≈ 5,5 mm',
      'Ansatzzone nasal weiter vorn als temporal'
    ],
    clinic: 'Bei endokriner Orbitopathie (Schilddrüsenerkrankung) sind M. rectus inferior und M. rectus medialis am häufigsten verdickt; Folge sind Einschränkung der Blickbewegungen und Druckgefühl.',
    muscle: {
      innervation: 'N. oculomotorius (N. III, R. inferior)',
      primary: 'Senkung',
      secondary: 'Exzyklorotation',
      tertiary: 'Adduktion'
    }
  },

  rectus_medialis: {
    la: 'Musculus rectus medialis', de: 'Innerer gerader Augenmuskel', group: 'muscles',
    text: 'Der M. rectus medialis entspringt am Anulus tendineus communis und zieht an der medialen Bulbuswand zu seinem Ansatz. Er ist der Hauptadduktor des Auges. Er hat den vorderen Ansatz der vier geraden Muskeln und bestimmt damit den Beginn der Tillaux-Spirale.',
    facts: [
      'Ansatz ≈ 5,5 mm vom Limbus, Breite ≈ 10,3 mm (Tillaux-Spirale, erster Ansatz)',
      'Sehnenlänge ≈ 3,7 mm',
      'Kürzeste Sehne der vier geraden Muskeln'
    ],
    clinic: 'Eine Lähmung des N. oculomotorius schwächt die Adduktion. Die unbalancierte Abduktion durch den M. rectus lateralis führt zu einer Exotropie.',
    muscle: {
      innervation: 'N. oculomotorius (N. III, R. inferior)',
      primary: 'Adduktion',
      secondary: '–',
      tertiary: '–'
    }
  },

  rectus_lateralis: {
    la: 'Musculus rectus lateralis', de: 'Äußerer gerader Augenmuskel', group: 'muscles',
    text: 'Der M. rectus lateralis entspringt mit zwei Köpfen am Anulus tendineus communis und zieht entlang der Orbitawand zur temporalen Sklera. Er ist der Abduktor des Auges. Seine Sehne ist die längste der vier geraden Muskeln.',
    facts: [
      'Ansatz ≈ 6,9 mm vom Limbus, Breite ≈ 9,2 mm (Tillaux-Spirale)',
      'Sehnenlänge ≈ 8,8 mm (längste Sehne der geraden Muskeln)',
      'Zwei Ursprungsköpfe am Anulus tendineus communis'
    ],
    clinic: 'Die Abduzensparese führt zu einer Esotropie, die beim Blick zur gelähmten Seite zunimmt. Typisch sind horizontale Doppelbilder bei Blickbewegung in diese Richtung.',
    muscle: {
      innervation: 'N. abducens (N. VI)',
      primary: 'Abduktion',
      secondary: '–',
      tertiary: '–'
    }
  },

  obliquus_superior: {
    la: 'Musculus obliquus superior', de: 'Oberer schiefer Augenmuskel', group: 'muscles',
    text: 'Der M. obliquus superior entspringt am Corpus des Keilbeins oberhalb des Anulus, zieht nach vorn zur Trochlea und wird dort umgelenkt. Seine Sehne verläuft posterolateral unter dem M. rectus superior und setzt hinter dem Äquator im oberen temporalen Quadranten an. Innerviert wird er vom N. trochlearis (IV), dem einzigen dorsal austretenden Hirnnerv.',
    facts: [
      'Sehne ≈ 26 mm lang, Verlauf unter dem M. rectus superior',
      'Sehnenzug in ca. 51–54° zur Sehachse',
      'Ansatz fächerförmig, ≈ 10 mm breit, hinter dem Äquator'
    ],
    clinic: 'Trochlearisparese: vertikale Doppelbilder, besonders beim Blick nach unten zur Nase, und Kopfschiefhaltung zur gesunden Seite.',
    muscle: {
      innervation: 'N. trochlearis (N. IV)',
      primary: 'Inzyklorotation',
      secondary: 'Senkung',
      tertiary: 'Abduktion'
    }
  },

  obliquus_inferior: {
    la: 'Musculus obliquus inferior', de: 'Unterer schiefer Augenmuskel', group: 'muscles',
    text: 'Der M. obliquus inferior ist der einzige Augenmuskel, der nicht vom Anulus tendineus entspringt. Er entspringt am Orbitaboden anteromedial, nahe der Fossa sacci lacrimalis, und zieht posterolateral unter dem M. rectus inferior zu seinem Ansatz im unteren temporalen Quadranten. Innerviert wird er vom N. oculomotorius (R. inferior).',
    facts: [
      'Ursprung am Orbitaboden nahe der Fossa sacci lacrimalis',
      'Ansatz ≈ 2 mm von der Makula entfernt',
      'Sehne sehr kurz (≈ 1 mm)'
    ],
    clinic: 'Überfunktion des M. obliquus inferior wird mit dem A-Syndrom in Verbindung gebracht. Operationen am Muskel finden in Makulanähe statt.',
    muscle: {
      innervation: 'N. oculomotorius (N. III, R. inferior)',
      primary: 'Exzyklorotation',
      secondary: 'Hebung',
      tertiary: 'Abduktion'
    }
  },

  trochlea: {
    la: 'Trochlea', de: 'Rolle (Trochlea)', group: 'muscles',
    text: 'Die Trochlea ist eine knorpelige Rolle in der Fovea trochlearis des Stirnbeins, oberhalb und medial der Orbita. Über sie wird die Sehne des M. obliquus superior umgelenkt und zieht nach posterolateral. Dadurch wirkt der Muskel als Inzyklorotator und Senker des Auges.',
    facts: [
      'Knorpelige Rolle in der Fovea trochlearis des Os frontale',
      'Lage im Modell ca. (−15 | 15 | 5) mm (Näherung)',
      'Umlenkung der Sehne bestimmt die Wirkrichtung des M. obliquus superior'
    ],
    clinic: 'Brown-Syndrom: Einschränkung der Hebung in Adduktion durch einen Engpass der Sehne im Trochleabereich. Es ist von der Trochlearisparese abzugrenzen.'
  },

  annulus_tendineus: {
    la: 'Anulus tendineus communis', de: 'Gemeinsamer Sehnenring (Zinn-Ring)', group: 'muscles',
    text: 'Der Anulus tendineus communis ist ein sehniger Ring an der Orbitaspitze, der den Canalis opticus und den medialen Teil der Fissura orbitalis superior umschließt. Hier entspringen die vier geraden Augenmuskeln. Durch den Ring verlaufen der Sehnerv und die A. ophthalmica.',
    facts: [
      'Zentrum im Modell ca. (−11 | 1 | −33) mm, Radius ≈ 5 mm',
      'Ursprung von vier geraden Augenmuskeln, der M. rectus lateralis mit zwei Köpfen',
      'Umschließt den Canalis opticus'
    ],
    clinic: 'Orbitaspitzensyndrom: Schädigung in der Fissura orbitalis superior betrifft N. III, IV, VI, den ersten Ast des N. trigeminus und den Sehnerv. Typisch sind Ophthalmoplegie und Sehverlust.'
  },

  // ---- N. opticus und Gefäße ----

  optic_nerve: {
    la: 'Nervus opticus', de: 'Sehnerv', group: 'nerve_vessels',
    text: 'Der N. opticus ist kein peripherer Nerv, sondern ein Ausläufer des Zentralnervensystems. Er besteht aus den Axonen von ca. 1,2 Mio. retinalen Ganglienzellen, umgeben von Gliazellen. Nach der Lamina cribrosa sind die Axone markhaltig. Der Nerv verläuft S-förmig durch die Orbita zum Canalis opticus.',
    facts: [
      'Intraorbitale Länge ≈ 25 mm, S-förmiger Verlauf (Bewegungsreserve)',
      'Durchmesser intraorbital ≈ 3 mm, mit Scheiden ≈ 4–4,5 mm',
      'Ca. 1,2 Mio. Ganglienzellaxone'
    ],
    clinic: 'Optikusneuritis: Entzündung mit Sehverlust und Schmerz bei Augenbewegung, häufig bei Multipler Sklerose. Auch Papillenödem, Optikusatrophie und das glaukomatöse Schadensbild betreffen den Nerv.'
  },

  dura_sheath: {
    la: 'Vagina externa nervi optici (Dura)', de: 'Äußere Optikusscheide (Dura)', group: 'nerve_vessels',
    text: 'Die Dura ist die äußerste Hülle des Sehnervs. Sie setzt sich als Fortsetzung der harten Hirnhaut aus dem Schädelinneren fort. Am hinteren Pol verschmilzt sie mit der Sklera. In der Orbita bildet sie eine feste bindegewebige Scheide.',
    facts: [
      'Fortsetzung der intrakraniellen Dura mater',
      'Verschmelzung mit der Sklera am hinteren Pol',
      'Gesamtdurchmesser mit den Scheiden ≈ 4–4,5 mm'
    ],
    clinic: 'Intrakranielle Prozesse können sich entlang der Scheiden in die Orbita ausbreiten. Meningeome des Sehnervs (Optikusscheidenmeningeom) führen zu Visusverlust und Atrophie.'
  },

  arachnoid_sheath: {
    la: 'Arachnoidea nervi optici', de: 'Mittlere Optikusscheide (Arachnoidea)', group: 'nerve_vessels',
    text: 'Die Arachnoidea ist die mittlere, dünne Hülle zwischen Dura und Pia. Ihr Subarachnoidalraum ist mit Liquor gefüllt und steht in Verbindung mit dem intrakraniellen Subarachnoidalraum. So wird der Liquordruck auf den Sehnervenkopf übertragen.',
    facts: [
      'Subarachnoidalraum mit Liquor, verbunden mit dem intrakraniellen Raum',
      'Liquordruck wirkt bis auf die Lamina cribrosa',
      'Zwischen Dura und Pia gelegen'
    ],
    clinic: 'Erhöhter Hirndruck wird über den Subarachnoidalraum auf die Papille übertragen und führt zum Papillenödem. Ein Liquordruckabfall kann die Papille dagegen verändern.'
  },

  pia_sheath: {
    la: 'Vagina interna nervi optici (Pia)', de: 'Innere Optikusscheide (Pia)', group: 'nerve_vessels',
    text: 'Die Pia ist die innerste, gefäßführende Hülle des Sehnervs. Sie liegt dem Nerv eng an und führt die Gefäße, die in den Nerv eintreten, insbesondere die A. und V. centralis retinae. Von der Pia ziehen Bindegewebssepten in den Nerv.',
    facts: [
      'Liegt dem Nerven eng an',
      'Begleitet die A. und V. centralis retinae',
      'Bindegewebige Septen gliedern den Nerv'
    ],
    clinic: 'Subarachnoidalblutungen und Meningitis betreffen den Subarachnoidalraum des Sehnervs und können ein Papillenödem auslösen.'
  },

  central_retinal_artery: {
    la: 'Arteria centralis retinae', de: 'Zentralarterie der Netzhaut', group: 'nerve_vessels',
    text: 'Die A. centralis retinae ist ein Ast der A. ophthalmica. Sie tritt ca. 10–12 mm hinter dem Bulbus in den Sehnerv ein und zieht im Zentrum des Nerven zur Papille. Sie versorgt die inneren Netzhautschichten. An der Papille teilt sie sich in Endarterien, die untereinander kaum anastomosieren.',
    facts: [
      'Eintritt ca. 10–12 mm hinter dem Bulbus',
      'Endarterien mit kaum relevanten Anastomosen',
      'Versorgung der inneren Netzhautschichten'
    ],
    clinic: 'Der Verschluss der A. centralis retinae führt zu plötzlichem, schmerzlosem Sehverlust. Charakteristisch ist die blasse Netzhautschwellung mit dem kirschroten Makulafleck.'
  },

  central_retinal_vein: {
    la: 'Vena centralis retinae', de: 'Zentralvene der Netzhaut', group: 'nerve_vessels',
    text: 'Die V. centralis retinae ist das venöse Gegenstück zur A. centralis. Sie verläuft im Sehnerv zentral wie die Arterie und verlässt den Bulbus mit ihr. Sie sammelt das Blut der inneren Netzhautschichten und mündet über die V. ophthalmica superior in den Sinus cavernosus.',
    facts: [
      'Mündung über die V. ophthalmica superior in den Sinus cavernosus',
      'Verläuft gemeinsam mit der Arterie',
      'Drainage der inneren Netzhautschichten'
    ],
    clinic: 'Der Zentralvenenverschluss (ZVV) führt zu Netzhautblutungen und Sehverlust. Wichtige Risikofaktoren sind arterielle Hypertonie, Glaukom und Diabetes.'
  },

  short_posterior_ciliary_arteries: {
    la: 'Arteriae ciliares posteriores breves', de: 'Kurze hintere Ziliararterien', group: 'nerve_vessels',
    text: 'Die kurzen hinteren Ziliararterien sind ca. 15–20 kleine Arterien, die den Sehnerv am Skleradurchtritt umgeben. Sie versorgen die Choroidea und den prälaminären Sehnerv. Ihre Anastomosen bilden um die Papille den Circulus arteriosus Zinnii.',
    facts: [
      'Ca. 15–20 Arterien um den N. opticus',
      'Versorgung von Choroidea und prälaminärem Sehnerv',
      'Circulus arteriosus Zinnii um die Papille'
    ],
    clinic: 'Die nicht-arteriitische anteriore ischämische Optikusneuropathie (NAION) entsteht durch Minderdurchblutung im Versorgungsgebiet dieser Arterien, meist im Bereich der Lamina.'
  },

  long_posterior_ciliary_arteries: {
    la: 'Arteriae ciliares posteriores longae', de: 'Lange hintere Ziliararterien', group: 'nerve_vessels',
    text: 'Die langen hinteren Ziliararterien sind zwei Gefäße, die horizontal, nasal und temporal, durch die Sklera zur Ziliarregion ziehen. Sie versorgen zusammen mit den Aa. ciliares anteriores den Ziliarkörper und die Iris und bilden den Circulus arteriosus iridis major.',
    facts: [
      'Zwei Stämme, nasal und temporal',
      'Horizontaler Verlauf bis zum Corpus ciliare',
      'Bilden mit den Aa. ciliares anteriores den Circulus arteriosus iridis major'
    ],
    clinic: 'Ein Verschluss führt zur Ischämie des vorderen Augenabschnitts. Gefäßneubildungen an der Iris (Rubeosis iridis) sind ein Zeichen der Ischämie und werden mit der Iris-Angiografie beurteilt.'
  },

  vortex_veins: {
    la: 'Venae vorticosae', de: 'Wirbelvenen', group: 'nerve_vessels',
    text: 'Die vier Vortexvenen (je eine pro Quadrant) leiten das Blut der Choroidea ab. Sie durchbrechen die Sklera ca. 3–4 mm hinter dem Äquator und münden in die Venen der Orbita. Damit gelangt das Blut der Aderhaut in den orbitalen Venenkreislauf.',
    facts: [
      'Vier Vortexvenen, je Quadrant',
      'Austritt ca. 3–4 mm hinter dem Äquator',
      'Abfluss in die Vv. ophthalmicae'
    ],
    clinic: 'Erweiterte Vortexvenen sind typisch für die pachychorioide Aderhaut und die Zentrale seröse Chorioretinopathie (CSC).'
  }
};
