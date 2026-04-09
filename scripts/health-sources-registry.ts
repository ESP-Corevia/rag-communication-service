/**
 * Registre FR-only des sources sante pour alimenter les agents IA.
 *
 * Politique actuelle:
 * - uniquement des sources francaises ou francophones utilisables pour des agents FR
 * - l anglais pourra etre reintroduit plus tard si la couverture FR est insuffisante
 *
 * Usage:
 *   ts-node scripts/health-sources-registry.ts
 */

// Ces declarations gardent le script autonome quand il est execute directement
// via ts-node en dehors du scope `src/**/*` du tsconfig principal.
declare const module: { exports: unknown } | undefined;
declare const require:
  | undefined
  | ((name: string) => unknown) & {
      main?: unknown;
    };

type Region = 'FR' | 'EU';
type Language = 'fr' | 'multi';
type AccessMode = 'html' | 'pdf' | 'xml' | 'json' | 'api' | 'download' | 'xlsx';
type IngestionMode = 'rag_html' | 'bulk_download' | 'api_sync' | 'taxonomy_only';
type SourceTier = 'foundation' | 'important' | 'specialized';

type ContentCategory =
  | 'symptoms'
  | 'conditions'
  | 'prevention'
  | 'medications'
  | 'drug_safety'
  | 'nutrition'
  | 'physical_activity'
  | 'anatomy'
  | 'body_systems'
  | 'lab_tests'
  | 'genetics'
  | 'rare_diseases'
  | 'vaccines'
  | 'mental_health'
  | 'pregnancy'
  | 'breastfeeding'
  | 'epidemiology'
  | 'public_health'
  | 'terminology';

type AgentFamily =
  | 'medecin_generaliste'
  | 'cardiologue'
  | 'dermatologue'
  | 'psychologue'
  | 'nutritionniste'
  | 'medicaments'
  | 'vaccination'
  | 'sante_mentale'
  | 'maladies_rares'
  | 'anatomie_biologie'
  | 'epidemiologie';

interface HealthSource {
  id: string;
  name: string;
  organization: string;
  region: Region;
  languages: Language[];
  url: string;
  accessModes: AccessMode[];
  ingestionMode: IngestionMode;
  tier: SourceTier;
  freshness: string;
  categories: ContentCategory[];
  recommendedFor: AgentFamily[];
  licenseOrTerms: string;
  whyUse: string[];
  guardrails: string[];
}

const troncCommunSources: HealthSource[] = [
  {
    id: 'ameli-health-topics',
    name: 'ameli - maladies, symptomes et prevention',
    organization: 'Assurance Maladie',
    region: 'FR',
    languages: ['fr'],
    url: 'https://www.ameli.fr/',
    accessModes: ['html', 'pdf'],
    ingestionMode: 'rag_html',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: ['symptoms', 'conditions', 'prevention', 'public_health', 'vaccines'],
    recommendedFor: [
      'medecin_generaliste',
      'cardiologue',
      'dermatologue',
      'psychologue',
      'vaccination',
      'sante_mentale',
    ],
    licenseOrTerms: 'Contenu grand public. Verifier les conditions de reutilisation avant republication massive.',
    whyUse: [
      'Socle FR grand public pour maladies frequentes, symptomes, depistage et prevention.',
      'Tres utile pour des agents qui repondent en francais a des patients en France.',
    ],
    guardrails: [
      'Preferer un RAG par pages cibles avec citation de source.',
      'Ne pas copier massivement le contenu sans verifier les droits.',
    ],
  },
  {
    id: 'has-guidelines',
    name: 'HAS - recommandations, parcours et guides',
    organization: 'Haute Autorite de Sante',
    region: 'FR',
    languages: ['fr'],
    url: 'https://www.has-sante.fr/',
    accessModes: ['html', 'pdf'],
    ingestionMode: 'rag_html',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: ['conditions', 'prevention', 'public_health', 'medications', 'vaccines'],
    recommendedFor: [
      'medecin_generaliste',
      'cardiologue',
      'dermatologue',
      'psychologue',
      'medicaments',
      'vaccination',
    ],
    licenseOrTerms: 'Contenu institutionnel. Usage conseille en RAG cible avec revue humaine.',
    whyUse: [
      'Source de reference FR pour recommandations de bonne pratique et parcours de soins.',
      'Utile pour garder un comportement prudent et aligne sur les pratiques de sante en France.',
    ],
    guardrails: [
      'Beaucoup de contenus visent les professionnels et doivent etre simplifies avant exposition patient.',
      'Ne pas confondre recommandation generale et decision clinique individuelle.',
    ],
  },
  {
    id: 'sante-publique-france',
    name: 'Sante publique France - themes sante et prevention',
    organization: 'Sante publique France',
    region: 'FR',
    languages: ['fr'],
    url: 'https://www.santepubliquefrance.fr/',
    accessModes: ['html', 'pdf'],
    ingestionMode: 'rag_html',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: [
      'conditions',
      'prevention',
      'public_health',
      'mental_health',
      'vaccines',
      'epidemiology',
      'nutrition',
    ],
    recommendedFor: [
      'medecin_generaliste',
      'cardiologue',
      'psychologue',
      'vaccination',
      'sante_mentale',
      'epidemiologie',
    ],
    licenseOrTerms: 'Contenu institutionnel public. Verifier les droits specifiques par publication.',
    whyUse: [
      'Large couverture FR pour prevention, facteurs de risque, themes de sante et communication publique.',
      'Bon point d entree pour un agent prevention ou sante publique.',
    ],
    guardrails: [
      'Distinguer les pages grand public des rapports epidemiologiques.',
      'Toujours garder les dates quand on cite des chiffres de surveillance.',
    ],
  },
  {
    id: 'odisse-open-data',
    name: 'Odisse - open data Sante publique France',
    organization: 'Sante publique France',
    region: 'FR',
    languages: ['fr', 'multi'],
    url: 'https://odisse.santepubliquefrance.fr/pages/accueil/',
    accessModes: ['html', 'api'],
    ingestionMode: 'api_sync',
    tier: 'important',
    freshness: 'selon dataset',
    categories: ['epidemiology', 'public_health', 'vaccines'],
    recommendedFor: ['epidemiologie', 'medecin_generaliste', 'vaccination'],
    licenseOrTerms: 'Verifier les conditions par jeu de donnees et par endpoint.',
    whyUse: [
      'Portail open data FR pour surveillance, indicateurs regionaux et donnees de sante publique.',
      'Tres utile pour un agent de veille epidemiologique ou indicateurs territoriaux.',
    ],
    guardrails: [
      'Toujours stocker la date d extraction et l identifiant du jeu de donnees.',
      'Ne pas melanger surveillance populationnelle et conseil patient individuel.',
    ],
  },
];

const preventionEtParcoursSources: HealthSource[] = [
  {
    id: 'vaccination-info-service',
    name: 'Vaccination Info Service',
    organization: 'Ministere de la Sante / Sante publique France',
    region: 'FR',
    languages: ['fr'],
    url: 'https://vaccination-info-service.fr/',
    accessModes: ['html', 'pdf'],
    ingestionMode: 'rag_html',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: ['vaccines', 'prevention', 'conditions', 'pregnancy', 'public_health'],
    recommendedFor: ['vaccination', 'medecin_generaliste'],
    licenseOrTerms: 'Contenu institutionnel. Reutilisation a cadrer selon les pages.',
    whyUse: [
      'Source FR de reference pour calendrier vaccinal, maladies a prevention vaccinale et profils a risque.',
      'Tres utile pour eviter les hallucinations sur la vaccination en contexte francais.',
    ],
    guardrails: [
      'Afficher la date du contenu vaccinal utilise.',
      'Conserver une validation humaine pour tout conseil individuel complexe.',
    ],
  },
  {
    id: 'sante-mentale-info-service',
    name: 'Sante mentale info service',
    organization: 'Sante publique France',
    region: 'FR',
    languages: ['fr'],
    url: 'https://www.santementale-info-service.fr/',
    accessModes: ['html'],
    ingestionMode: 'rag_html',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: ['mental_health', 'prevention', 'conditions', 'public_health'],
    recommendedFor: ['psychologue', 'sante_mentale', 'medecin_generaliste'],
    licenseOrTerms: 'Contenu institutionnel grand public.',
    whyUse: [
      'Socle FR pour signes psychiques, orientation, auto-soin et ressources d urgence.',
      'Tres utile pour les agents psychologie et sante mentale.',
    ],
    guardrails: [
      'Ne jamais remplacer l orientation urgente par un simple conseil d auto-soin.',
      'Conserver une redirection immediate en cas d urgence suicidaire ou psychiatrique.',
    ],
  },
];

const nutritionSources: HealthSource[] = [
  {
    id: 'manger-bouger',
    name: 'Manger Bouger / PNNS',
    organization: 'Sante publique France',
    region: 'FR',
    languages: ['fr'],
    url: 'https://www.mangerbouger.fr/',
    accessModes: ['html', 'pdf'],
    ingestionMode: 'rag_html',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: ['nutrition', 'physical_activity', 'prevention', 'pregnancy'],
    recommendedFor: ['nutritionniste', 'medecin_generaliste'],
    licenseOrTerms: 'Contenu institutionnel grand public.',
    whyUse: [
      'Reference FR sur recommandations alimentaires et activite physique.',
      'Tres utile pour nutrition, prevention, grossesse et hygiene de vie.',
    ],
    guardrails: [
      'Bon pour conseils generaux, insuffisant seul pour prises en charge specialistes complexes.',
      'Toujours distinguer prevention generale et therapeutique dietetique ciblee.',
    ],
  },
  {
    id: 'ciqual',
    name: 'ANSES-CIQUAL - composition nutritionnelle des aliments',
    organization: 'ANSES',
    region: 'FR',
    languages: ['fr'],
    url: 'https://ciqual.anses.fr/',
    accessModes: ['html', 'download', 'xlsx'],
    ingestionMode: 'bulk_download',
    tier: 'foundation',
    freshness: 'publication periodique',
    categories: ['nutrition', 'prevention'],
    recommendedFor: ['nutritionniste', 'medecin_generaliste'],
    licenseOrTerms: 'Open data selon ANSES/Ciqual; verifier la version de table et la documentation associee.',
    whyUse: [
      'Base francaise de reference pour la composition nutritionnelle des aliments.',
      'Utile pour agents nutrition et calculs de nutriments.',
    ],
    guardrails: [
      'Les valeurs sont des moyennes de reference et non une mesure produit-par-produit.',
      'Toujours conserver la version de table et l unite.',
    ],
  },
];

const medicamentSources: HealthSource[] = [
  {
    id: 'bdpm',
    name: 'Base de Donnees Publique des Medicaments',
    organization: 'Ministere de la Sante / ANSM / HAS / UNCAM',
    region: 'FR',
    languages: ['fr'],
    url: 'https://base-donnees-publique.medicaments.gouv.fr/',
    accessModes: ['html', 'pdf', 'download'],
    ingestionMode: 'bulk_download',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: ['medications', 'drug_safety', 'conditions'],
    recommendedFor: ['medicaments', 'vaccination', 'medecin_generaliste'],
    licenseOrTerms: 'Le site indique une licence Etalab 2.0 sauf mention contraire.',
    whyUse: [
      'Pivot FR officiel pour notices, RCP, substances actives, specialites et infos importantes ANSM.',
      'Base prioritaire pour un agent medicaments francophone.',
    ],
    guardrails: [
      'Ne pas transformer la notice en prescription autonome.',
      'Toujours conserver le lien vers le document source et sa date.',
    ],
  },
  {
    id: 'crat',
    name: 'CRAT - grossesse, allaitement, exposition paternelle',
    organization: 'Centre de Reference sur les Agents Teratogenes',
    region: 'FR',
    languages: ['fr'],
    url: 'https://www.lecrat.fr/',
    accessModes: ['html'],
    ingestionMode: 'rag_html',
    tier: 'foundation',
    freshness: 'mise a jour continue',
    categories: ['medications', 'pregnancy', 'breastfeeding', 'vaccines'],
    recommendedFor: ['medicaments', 'medecin_generaliste', 'vaccination'],
    licenseOrTerms: 'Tous droits reserves; usage en consultation/RAG cible plutot qu en republication massive.',
    whyUse: [
      'Reference FR majeure pour medicaments et vaccins pendant grossesse et allaitement.',
      'Indispensable pour reduire les erreurs sur ces contextes sensibles.',
    ],
    guardrails: [
      'Ne pas copier massivement le contenu.',
      'Toujours afficher le contexte precise: grossesse, allaitement ou exposition paternelle.',
    ],
  },
];

const biologieEtConnaissancesSources: HealthSource[] = [
  {
    id: 'ameli-anatomie-fallback',
    name: 'ameli / contenus generalistes sante',
    organization: 'Assurance Maladie',
    region: 'FR',
    languages: ['fr'],
    url: 'https://www.ameli.fr/',
    accessModes: ['html', 'pdf'],
    ingestionMode: 'rag_html',
    tier: 'important',
    freshness: 'mise a jour continue',
    categories: ['anatomy', 'body_systems', 'lab_tests', 'public_health'],
    recommendedFor: ['anatomie_biologie', 'medecin_generaliste'],
    licenseOrTerms: 'Contenu grand public; verifier les droits page par page.',
    whyUse: [
      'Fallback FR en attendant une source anatomie/biologie plus structuree et purement francaise.',
      'Permet de garder un point d entree FR plutot que de repasser a l anglais.',
    ],
    guardrails: [
      'Couverture partielle seulement.',
      'A completer plus tard par une source FR plus specialisee.',
    ],
  },
];

const specialitesEtCasComplexesSources: HealthSource[] = [
  {
    id: 'orphadata',
    name: 'Orphadata / Orphanet datasets',
    organization: 'INSERM / Orphanet',
    region: 'EU',
    languages: ['fr', 'multi'],
    url: 'https://www.orphadata.com/',
    accessModes: ['html', 'api', 'download'],
    ingestionMode: 'bulk_download',
    tier: 'important',
    freshness: 'selon packs et services',
    categories: ['rare_diseases', 'genetics', 'epidemiology', 'terminology'],
    recommendedFor: ['maladies_rares', 'anatomie_biologie', 'epidemiologie'],
    licenseOrTerms: 'Verifier les jeux et APIs exacts avant utilisation.',
    whyUse: [
      'Source tres utile pour maladies rares, phenotypes et epidemiologie.',
      'Compatible avec une strategie FR ou multilingue si besoin plus tard.',
    ],
    guardrails: [
      'Certaines APIs ou jeux peuvent exiger un acces specifique.',
      'Le contenu peut etre technique et doit etre reformule pour le patient.',
    ],
  },
];

const allSources: HealthSource[] = [
  ...troncCommunSources,
  ...preventionEtParcoursSources,
  ...nutritionSources,
  ...medicamentSources,
  ...biologieEtConnaissancesSources,
  ...specialitesEtCasComplexesSources,
];

// TODO(corevia-health-ingestion): Support these registry-only sources in the
// generator. They are intentionally listed in recommendedAgentBundles for future
// coverage planning, but they are not active until their IDs are added to
// SUPPORTED_SOURCE_IDS in scripts/generate-health-knowledge.ts:
// has-guidelines, crat, ciqual, odisse-open-data, orphadata.
const recommendedAgentBundles: Record<AgentFamily, string[]> = {
  medecin_generaliste: [
    'ameli-health-topics',
    'has-guidelines',
    'sante-publique-france',
  ],
  cardiologue: [
    'ameli-health-topics',
    'has-guidelines',
    'sante-publique-france',
  ],
  dermatologue: [
    'ameli-health-topics',
    'has-guidelines',
  ],
  psychologue: [
    'sante-mentale-info-service',
    'has-guidelines',
    'sante-publique-france',
    'ameli-health-topics',
  ],
  nutritionniste: [
    'manger-bouger',
    'ciqual',
  ],
  medicaments: [
    'bdpm',
    'crat',
  ],
  vaccination: [
    'vaccination-info-service',
    'bdpm',
    'ameli-health-topics',
  ],
  sante_mentale: [
    'sante-mentale-info-service',
    'sante-publique-france',
    'ameli-health-topics',
  ],
  maladies_rares: [
    'orphadata',
  ],
  anatomie_biologie: [
    'ameli-anatomie-fallback',
    'has-guidelines',
  ],
  epidemiologie: [
    'sante-publique-france',
    'odisse-open-data',
    'orphadata',
  ],
};

const ingestionPrinciples: string[] = [
  'Prioriser les sources FR structurees et officielles avant tout ajout en anglais.',
  'Utiliser le HTML/PDF institutionnel en RAG cible avec citations: ameli, HAS, Vaccination Info Service, Sante publique France, CRAT.',
  'Utiliser les sources bulk FR des qu elles existent: BDPM, Ciqual, Orphadata quand le jeu FR est exploitable.',
  'Toujours stocker la source, la date de collecte, la version, la langue et le pays.',
  'L anglais n est un fallback que si un besoin de couverture reste non satisfait apres ingestion FR.',
];

function getSourceById(sourceId: string): HealthSource {
  const source = allSources.find((item) => item.id === sourceId);

  if (!source) {
    throw new Error(`Unknown source id: ${sourceId}`);
  }

  return source;
}

function countByIngestionMode(mode: IngestionMode): number {
  return allSources.filter((source) => source.ingestionMode === mode).length;
}

function printAgentBundles(): void {
  console.log('\nRecommended FR agent bundles:\n');

  (Object.keys(recommendedAgentBundles) as AgentFamily[]).forEach((agent) => {
    console.log(`- ${agent}`);

    recommendedAgentBundles[agent].forEach((sourceId) => {
      const source = getSourceById(sourceId);
      console.log(`  * ${source.name} -> ${source.url}`);
    });
  });
}

function printSourceSummary(): void {
  console.log('French health source registry ready.');
  console.log(`Total FR sources: ${allSources.length}`);
  console.log(`bulk_download: ${countByIngestionMode('bulk_download')}`);
  console.log(`api_sync: ${countByIngestionMode('api_sync')}`);
  console.log(`rag_html: ${countByIngestionMode('rag_html')}`);
  console.log(`taxonomy_only: ${countByIngestionMode('taxonomy_only')}`);

  console.log('\nFoundation sources:\n');
  allSources
    .filter((source) => source.tier === 'foundation')
    .forEach((source) => {
      console.log(`- ${source.name} (${source.id})`);
      console.log(`  ${source.url}`);
    });

  console.log('\nIngestion principles:\n');
  ingestionPrinciples.forEach((rule) => {
    console.log(`- ${rule}`);
  });
}

function main(): void {
  printSourceSummary();
  printAgentBundles();
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}

export {
  allSources,
  biologieEtConnaissancesSources,
  ingestionPrinciples,
  medicamentSources,
  nutritionSources,
  preventionEtParcoursSources,
  recommendedAgentBundles,
  specialitesEtCasComplexesSources,
  troncCommunSources,
};
