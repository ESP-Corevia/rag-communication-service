import { allSources } from './health-sources-registry';

declare const require: (name: string) => any;
declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
};

const { Buffer } = require('buffer');
const { mkdir, writeFile } = require('fs/promises');
const { dirname, resolve } = require('path');

type AgentName =
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

interface KnowledgeDocument {
  id: string;
  text: string;
  category: string;
}

interface CandidateDocument {
  agent: AgentName;
  doc: KnowledgeDocument;
  priority: number;
}

interface GeneratorOptions {
  outputPath: string;
  profile: 'starter' | 'full';
  sourceIds: Set<string>;
  languagePolicy: 'fr-only' | 'allow-en-fallback';
}

type TextEncoding = 'utf8' | 'latin1';

type SantePubliqueFranceBucket =
  | 'regions'
  | 'surveillance-syndromique-sursaud-R'
  | 'maladies-et-traumatismes'
  | 'determinants-de-sante'
  | 'inegalites-sociales-et-territoriales-de-sante'
  | 'etudes-et-enquetes'
  | 'les-actualites'
  | 'la-sante-a-tout-age'
  | 'competences-psychosociales'
  | 'don-de-sang'
  | 'other';

interface ProfileConfig {
  agentCaps: Record<AgentName, number>;
  openFdaLimit: number;
  bdpmRepresentativeLimit: number;
  medlinePlusDefinitionsPerFile: number;
  maxSummaryLength: number;
  htmlConcurrency: number;
  ameliThemeLimit: number;
  ameliArticlesPerTheme: number;
  mangerBougerPageLimit: number;
  santeMentalePageLimit: number;
  vaccinationInfoServicePageLimit: number;
  santePubliqueFrancePageLimit: number;
  santePubliqueFranceBucketMinimums: Partial<Record<SantePubliqueFranceBucket, number>>;
}

interface BdpmDrugRecord {
  cis: string;
  name: string;
  form: string;
  routes: string;
  authorizationStatus: string;
  procedure: string;
  commercialStatus: string;
  authorizationDate: string;
  holder: string;
  isGeneric: string;
}

interface BdpmComposition {
  substanceName: string;
  dosage: string;
  referenceUnit: string;
  nature: string;
}

const AGENTS: AgentName[] = [
  'medecin_generaliste',
  'cardiologue',
  'dermatologue',
  'psychologue',
  'nutritionniste',
  'medicaments',
  'vaccination',
  'sante_mentale',
  'maladies_rares',
  'anatomie_biologie',
  'epidemiologie',
];

const NAMESPACE_BY_AGENT: Record<AgentName, string> = {
  medecin_generaliste: 'medecin-generaliste',
  cardiologue: 'cardiologue',
  dermatologue: 'dermatologue',
  psychologue: 'psychologue',
  nutritionniste: 'nutritionniste',
  medicaments: 'medicaments',
  vaccination: 'vaccination',
  sante_mentale: 'sante-mentale',
  maladies_rares: 'maladies-rares',
  anatomie_biologie: 'anatomie-biologie',
  epidemiologie: 'epidemiologie',
};

const PROFILE_CONFIG: Record<'starter' | 'full', ProfileConfig> = {
  starter: {
    agentCaps: {
      medecin_generaliste: 260,
      cardiologue: 120,
      dermatologue: 120,
      psychologue: 120,
      nutritionniste: 120,
      medicaments: 420,
      vaccination: 90,
      sante_mentale: 120,
      maladies_rares: 180,
      anatomie_biologie: 180,
      epidemiologie: 50,
    },
    openFdaLimit: 140,
    bdpmRepresentativeLimit: 260,
    medlinePlusDefinitionsPerFile: 80,
    maxSummaryLength: 1800,
    htmlConcurrency: 6,
    ameliThemeLimit: 84,
    ameliArticlesPerTheme: 4,
    mangerBougerPageLimit: 180,
    santeMentalePageLimit: 48,
    vaccinationInfoServicePageLimit: 120,
    santePubliqueFrancePageLimit: 260,
    santePubliqueFranceBucketMinimums: {
      regions: 90,
      'surveillance-syndromique-sursaud-R': 35,
      'maladies-et-traumatismes': 60,
      'determinants-de-sante': 35,
    },
  },
  full: {
    agentCaps: {
      medecin_generaliste: 1200,
      cardiologue: 500,
      dermatologue: 500,
      psychologue: 500,
      nutritionniste: 500,
      medicaments: 1600,
      vaccination: 300,
      sante_mentale: 500,
      maladies_rares: 800,
      anatomie_biologie: 800,
      epidemiologie: 200,
    },
    openFdaLimit: 500,
    bdpmRepresentativeLimit: 1200,
    medlinePlusDefinitionsPerFile: 250,
    maxSummaryLength: 2400,
    htmlConcurrency: 8,
    ameliThemeLimit: 220,
    ameliArticlesPerTheme: 5,
    mangerBougerPageLimit: 520,
    santeMentalePageLimit: 160,
    vaccinationInfoServicePageLimit: 280,
    santePubliqueFrancePageLimit: 700,
    santePubliqueFranceBucketMinimums: {
      regions: 220,
      'surveillance-syndromique-sursaud-R': 90,
      'maladies-et-traumatismes': 180,
      'determinants-de-sante': 110,
      'inegalites-sociales-et-territoriales-de-sante': 20,
      'etudes-et-enquetes': 20,
    },
  },
};

const SUPPORTED_SOURCE_IDS = new Set([
  'ameli-health-topics',
  'ameli-anatomie-fallback',
  'manger-bouger',
  'sante-mentale-info-service',
  'vaccination-info-service',
  'sante-publique-france',
  'bdpm',
]);

const DEFAULT_SOURCE_IDS = [
  'ameli-health-topics',
  'manger-bouger',
  'sante-mentale-info-service',
  'vaccination-info-service',
  'sante-publique-france',
  'bdpm',
];

const MEDLINEPLUS_XML_PAGE_URL = 'https://medlineplus.gov/xml.html';
const MEDLINEPLUS_DEFINITION_URLS = [
  'https://medlineplus.gov/xml/generalhealthdefinitions.xml',
  'https://medlineplus.gov/xml/fitnessdefinitions.xml',
  'https://medlineplus.gov/xml/mineralsdefinitions.xml',
  'https://medlineplus.gov/xml/nutritiondefinitions.xml',
  'https://medlineplus.gov/xml/vitaminsdefinitions.xml',
];
const MEDLINEPLUS_GENETICS_URL = 'https://medlineplus.gov/download/ghr-summaries.xml';
const BDPM_CIS_URL = 'https://base-donnees-publique.medicaments.gouv.fr/index.php/download/file/CIS_bdpm.txt';
const BDPM_COMPO_URL = 'https://base-donnees-publique.medicaments.gouv.fr/index.php/download/file/CIS_COMPO_bdpm.txt';
const BDPM_CPD_URL = 'https://base-donnees-publique.medicaments.gouv.fr/index.php/download/file/CIS_CPD_bdpm.txt';
const BDPM_IMPORTANT_INFO_URL =
  'https://base-donnees-publique.medicaments.gouv.fr/index.php/download/CIS_InfoImportantes.txt';
const OPENFDA_BASE_URL = 'https://api.fda.gov/drug/label.json';
const AMELI_THEME_INDEX_BASE_URL = 'https://www.ameli.fr/assure/sante/themes';
const AMELI_SITE_BASE_URL = 'https://www.ameli.fr';
const MANGER_BOUGER_SITE_BASE_URL = 'https://www.mangerbouger.fr';
const MANGER_BOUGER_SITEMAP_URL = 'https://www.mangerbouger.fr/sitemap.xml';
const SANTE_MENTALE_SITE_BASE_URL = 'https://www.santementale-info-service.fr';
const SANTE_MENTALE_PLAN_URL = `${SANTE_MENTALE_SITE_BASE_URL}/plan-du-site`;
const VACCINATION_INFO_SERVICE_BASE_URL = 'https://vaccination-info-service.fr';
const VACCINATION_INFO_SERVICE_SITEMAP_INDEX_URL = `${VACCINATION_INFO_SERVICE_BASE_URL}/sitemap.xml`;
const SANTE_PUBLIQUE_FRANCE_BASE_URL = 'https://www.santepubliquefrance.fr';
const SANTE_PUBLIQUE_FRANCE_SITEMAP_INDEX_URL = `${SANTE_PUBLIQUE_FRANCE_BASE_URL}/sitemap.xml`;
const REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 corevia-health-ingestion/1.0',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'fr-FR,fr;q=0.95,en;q=0.4',
};

function parseArgs(argv: string[]): GeneratorOptions {
  const args = argv.slice(2);
  let outputPath = resolve(process.cwd(), 'scripts/generated-health-knowledge.ts');
  let profile: 'starter' | 'full' = 'starter';
  let sourceIds = new Set<string>(DEFAULT_SOURCE_IDS);
  let languagePolicy: 'fr-only' | 'allow-en-fallback' = 'fr-only';

  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];

    if (arg === '--output' && args[idx + 1]) {
      outputPath = resolve(process.cwd(), args[idx + 1]);
      idx += 1;
      continue;
    }

    if (arg.startsWith('--output=')) {
      outputPath = resolve(process.cwd(), arg.split('=')[1]);
      continue;
    }

    if (arg === '--profile' && args[idx + 1]) {
      const rawProfile = args[idx + 1];
      profile = rawProfile === 'full' ? 'full' : 'starter';
      idx += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      const rawProfile = arg.split('=')[1];
      profile = rawProfile === 'full' ? 'full' : 'starter';
      continue;
    }

    if (arg === '--sources' && args[idx + 1]) {
      sourceIds = new Set(
        args[idx + 1]
          .split(',')
          .map((source) => source.trim())
          .filter(Boolean)
      );
      idx += 1;
      continue;
    }

    if (arg.startsWith('--sources=')) {
      sourceIds = new Set(
        arg
          .split('=')[1]
          .split(',')
          .map((source) => source.trim())
          .filter(Boolean)
      );
      continue;
    }

    if (arg === '--allow-english-fallback') {
      languagePolicy = 'allow-en-fallback';
      continue;
    }

    if (arg === '--language-policy' && args[idx + 1]) {
      languagePolicy = args[idx + 1] === 'allow-en-fallback' ? 'allow-en-fallback' : 'fr-only';
      idx += 1;
      continue;
    }

    if (arg.startsWith('--language-policy=')) {
      const rawPolicy = arg.split('=')[1];
      languagePolicy = rawPolicy === 'allow-en-fallback' ? 'allow-en-fallback' : 'fr-only';
    }
  }

  const unknownSourceIds = Array.from(sourceIds).filter((sourceId) => !SUPPORTED_SOURCE_IDS.has(sourceId));
  if (unknownSourceIds.length > 0) {
    throw new Error(`Unsupported source ids: ${unknownSourceIds.join(', ')}`);
  }

  return {
    outputPath,
    profile,
    sourceIds,
    languagePolicy,
  };
}

function getSourceById(sourceId: string) {
  const source = allSources.find((item) => item.id === sourceId);
  if (!source) {
    throw new Error(`Unknown source id in registry: ${sourceId}`);
  }
  return source;
}

function isFrenchCapableSource(sourceId: string): boolean {
  return getSourceById(sourceId).languages.includes('fr');
}

function stableHash(value: string): number {
  let hash = 0;

  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash * 31 + value.charCodeAt(idx)) >>> 0;
  }

  return hash;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    laquo: '"',
    raquo: '"',
    lsquo: "'",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
    hellip: '…',
    ndash: '-',
    mdash: '-',
    deg: '°',
    reg: '®',
    copy: '©',
    trade: '™',
    bull: '•',
    middot: '·',
    oelig: 'oe',
    OElig: 'OE',
    agrave: 'à',
    aacute: 'á',
    acirc: 'â',
    atilde: 'ã',
    auml: 'ä',
    aring: 'å',
    egrave: 'è',
    eacute: 'é',
    ecirc: 'ê',
    euml: 'ë',
    igrave: 'ì',
    iacute: 'í',
    icirc: 'î',
    iuml: 'ï',
    ograve: 'ò',
    oacute: 'ó',
    ocirc: 'ô',
    otild: 'õ',
    ouml: 'ö',
    ugrave: 'ù',
    uacute: 'ú',
    ucirc: 'û',
    uuml: 'ü',
    yacute: 'ý',
    yuml: 'ÿ',
    ccedil: 'ç',
    Ccedil: 'Ç',
    Agrave: 'À',
    Aacute: 'Á',
    Acirc: 'Â',
    Auml: 'Ä',
    Egrave: 'È',
    Eacute: 'É',
    Ecirc: 'Ê',
    Euml: 'Ë',
    Igrave: 'Ì',
    Iacute: 'Í',
    Icirc: 'Î',
    Iuml: 'Ï',
    Ograve: 'Ò',
    Oacute: 'Ó',
    Ocirc: 'Ô',
    Ouml: 'Ö',
    Ugrave: 'Ù',
    Uacute: 'Ú',
    Ucirc: 'Û',
    Uuml: 'Ü',
  };

  let decoded = value;

  for (let pass = 0; pass < 3; pass += 1) {
    const nextValue = decoded
      .replace(/&([a-zA-Z]+);/g, (match, entity) => namedEntities[entity] || match)
      .replace(/&#(\d+);/g, (_, decimal) => String.fromCharCode(Number(decimal)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    if (nextValue === decoded) {
      break;
    }

    decoded = nextValue;
  }

  return decoded;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function cleanRichText(value: string): string {
  return normalizeWhitespace(stripTags(decodeHtmlEntities(value)));
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function slugify(value: string): string {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean).map((value) => normalizeWhitespace(value))));
}

function getTagContents(block: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'gi');
  const matches: string[] = [];
  let match: RegExpExecArray | null = regex.exec(block);

  while (match) {
    matches.push(match[1]);
    match = regex.exec(block);
  }

  return matches;
}

function getFirstTagContent(block: string, tagName: string): string {
  const matches = getTagContents(block, tagName);
  return matches[0] || '';
}

function parseAttributes(rawAttributes: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null = regex.exec(rawAttributes);

  while (match) {
    attributes[match[1]] = decodeHtmlEntities(match[2]);
    match = regex.exec(rawAttributes);
  }

  return attributes;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isUiBoilerplateLine(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return [
    'voir le fil d ariane',
    'masquer le fil d ariane',
    'copier le lien',
    'partager sur x',
    'partager sur twitter',
    'partager sur linkedin',
    'partager sur facebook',
    'partager sur bluesky',
    'partager sur',
    'envoyer par email',
    'fermer',
    'voir plus',
    'voir moins',
    'lire la suite',
    'en voir moins',
    'en voir plus',
    'sommaire',
    'questions frequentes',
    'guide',
    'video',
  ].includes(normalized);
}

function htmlToPlainText(value: string): string {
  const withLineBreaks = decodeHtmlEntities(value)
    .replace(/\sdata-content='[^']*'/gi, '')
    .replace(/\sdata-content="[^"]*"/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|li|div|section|article|h1|h2|h3|h4|h5|h6|ul|ol|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return uniqueStrings(
    withLineBreaks
      .split('\n')
      .map((line) => normalizeWhitespace(line))
      .filter((line) => line && !isUiBoilerplateLine(line))
  ).join('\n');
}

function extractMetaContent(html: string, name: string): string {
  const escaped = escapeRegExp(name);
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return normalizeWhitespace(decodeHtmlEntities(match[1]));
    }
  }

  return '';
}

function extractCanonicalUrl(html: string): string {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  return match ? normalizeWhitespace(decodeHtmlEntities(match[1])) : '';
}

function extractFirstMatch(html: string, pattern: RegExp): string {
  const match = pattern.exec(html);
  return match ? normalizeWhitespace(htmlToPlainText(match[1])) : '';
}

function extractAllMatches(html: string, pattern: RegExp, maxMatches?: number): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null = pattern.exec(html);

  while (match) {
    const text = normalizeWhitespace(htmlToPlainText(match[1]));
    if (text) {
      results.push(text);
    }
    if (maxMatches && results.length >= maxMatches) {
      break;
    }
    match = pattern.exec(html);
  }

  return uniqueStrings(results);
}

function extractXmlLocs(xml: string): string[] {
  return uniqueStrings(
    Array.from(xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/g)).map((match) =>
      normalizeWhitespace(decodeHtmlEntities(match[1]))
    )
  );
}

function absolutizeUrl(url: string, baseUrl: string): string {
  if (!url) {
    return '';
  }

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return '';
  }
}

function selectDeterministicSubset<T>(items: T[], limit: number, keyFn: (item: T) => string): T[] {
  if (items.length <= limit) {
    return [...items];
  }

  return [...items]
    .sort((left, right) => stableHash(keyFn(left)) - stableHash(keyFn(right)))
    .slice(0, limit);
}

function extractInternalPaths(
  html: string,
  siteBaseUrl: string,
  options: {
    includePrefixes?: string[];
    excludePrefixes?: string[];
  } = {}
): string[] {
  const rawMatches = Array.from(html.matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
  const includePrefixes = options.includePrefixes || [];
  const excludePrefixes = options.excludePrefixes || [];

  return uniqueStrings(
    rawMatches
      .map((url) => absolutizeUrl(url, siteBaseUrl))
      .filter((url) => url.startsWith(siteBaseUrl))
      .map((url) => url.replace(siteBaseUrl, '') || '/')
      .filter((path) => {
        if (path === '/' || path.includes('?') || path.includes('#')) {
          return false;
        }

        if (/\.(?:pdf|png|jpg|jpeg|webp|svg|css|js|ico)$/i.test(path)) {
          return false;
        }

        if (excludePrefixes.some((prefix) => path.startsWith(prefix))) {
          return false;
        }

        if (includePrefixes.length > 0 && !includePrefixes.some((prefix) => path.startsWith(prefix))) {
          return false;
        }

        return true;
      })
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchText(url: string, encoding: TextEncoding = 'utf8'): Promise<string> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString(encoding);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      ...REQUEST_HEADERS,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function discoverLatestMedlinePlusTopicsUrl(): Promise<string> {
  const html = await fetchText(MEDLINEPLUS_XML_PAGE_URL);
  const matches = Array.from(
    html.matchAll(/https:\/\/medlineplus\.gov\/xml\/mplus_topics_\d{4}-\d{2}-\d{2}\.xml/g)
  ).map((match) => match[0]);

  if (matches.length === 0) {
    throw new Error('Unable to discover latest MedlinePlus topics XML URL');
  }

  return matches.sort().reverse()[0];
}

function hasAnyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function countKeywordMatches(haystack: string, keywords: string[]): number {
  return new Set(keywords.filter((keyword) => haystack.includes(keyword))).size;
}

function inferAgentScores(title: string, groups: string[], summary: string): Partial<Record<AgentName, number>> {
  const titleAndGroups = `${title} ${groups.join(' ')}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const summaryText = summary.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const scores: Partial<Record<AgentName, number>> = {
    medecin_generaliste: 1,
  };

  const generalisteKeywords = [
    'symptome',
    'symptomes',
    'signe',
    'signes',
    'diagnostic',
    'diagnosti',
    'consultation',
    'consulter',
    'prise en charge',
    'traitement',
    'traitements',
    'prevention',
    'depistage',
    'infection',
    'maladie',
    'maladies',
    'douleur',
    'fievre',
    'fatigue',
    'toux',
    'diarrhee',
    'vomissement',
    'nausee',
    'surveillance medicale',
    'conseils',
    'quand consulter',
    'causes',
    'evolution',
    'complications',
    'urgence',
    'urgences',
  ];
  const cardiologueKeywords = [
    'cardio',
    'cardiovasculaire',
    'cardio-vasculaire',
    'blood pressure',
    'hypertension',
    'cholesterol',
    'cholester',
    'stroke',
    'vascular',
    'arter',
    'circulation',
    'arrhythm',
    'angina',
    'heart failure',
    'heart attack',
    'heart disease',
    'cardiac',
    'blood, heart and circulation',
    'sangre, corazon y circulacion',
    'congenital heart',
    'blood, heart and circulation',
    'coeur',
    'cardiaque',
    'cardiologie',
    'infarctus',
    'angor',
    'angine de poitrine',
    'avc',
    'palpitation',
    'tachycard',
    'bradycard',
    'arythm',
    'rythme cardiaque',
    'tension arterielle',
    'pression arterielle',
    'triglycer',
    'dyslipid',
    'myocarde',
    'coronar',
    'atheroscler',
    'artere',
    'arteriel',
    'vasculaire',
    'anevris',
    'insuffisance cardiaque',
    'accident vasculaire cerebral',
  ];
  const dermatologueKeywords = [
    'skin',
    'hair',
    'nail',
    'dermat',
    'eczema',
    'psoriasis',
    'acne',
    'melanoma',
    'rash',
    'itch',
    'urticaria',
    'skin, hair and nails',
    'peau',
    'cutane',
    'cutanee',
    'dermat',
    'eczema',
    'urticaire',
    'cheveu',
    'ongle',
    'melanome',
    'grains de beaute',
    'lesion cutanee',
    'eruption',
    'eruption cutanee',
    'rash',
    'prurit',
    'demangeaison',
    'demangeaisons',
    'bouton',
    'boutons',
    'mycose cutanee',
    'mycose',
    'verrue',
    'rosacee',
    'vitiligo',
    'cicatrice',
    'coup de soleil',
    'carcinome cutane',
  ];
  const psychologueKeywords = [
    'mental',
    'depression',
    'anxiety',
    'stress',
    'suicide',
    'sleep',
    'adhd',
    'autism',
    'bipolar',
    'schiz',
    'panic',
    'psych',
    'substance use',
    'trauma',
    'eating disorder',
    'mental health and behavior',
    'mood disorder',
    'sante mentale',
    'depression',
    'anxiete',
    'troubles anxieux',
    'stress',
    'suicide',
    'insomnie',
    'sommeil',
    'psych',
    'psychi',
    'phobie',
    'autisme',
    'tdah',
    'bipolaire',
    'schiz',
    'boulim',
    'anorex',
    'hyperphag',
    'angoisse',
    'etat depressif',
    'troubles de l humeur',
    'humeur',
    'mal etre',
    'bien etre psychique',
    'bien-etre psychique',
    'burn out',
    'burn-out',
    'epuisement',
    'estime de soi',
    'solitude',
    'rumination',
    'therapie',
    'soutien psychologique',
    'stress post traumatique',
    'trouble du sommeil',
    'cauchemar',
  ];
  const mentalHealthKeywords = [
    'sante mentale',
    'troubles psychiques',
    'trouble psychique',
    'troubles psychiatriques',
    'psychiat',
    'depression',
    'etat depressif',
    'troubles anxieux',
    'anxiete',
    'angoisse',
    'suicide',
    'suicid',
    'idees suicidaires',
    'geste suicidaire',
    'conduites suicidaires',
    'schiz',
    'psychose',
    'bipolaire',
    'troubles de l humeur',
    'autisme',
    'tdah',
    'addiction',
    'dependance',
    'alcoolisation',
    'sante mentale et covid',
  ];
  const nutritionKeywords = [
    'nutrition',
    'food',
    'diet',
    'obesity',
    'vitamin',
    'mineral',
    'weight',
    'exercise',
    'child nutrition',
    'healthy eating',
    'food and nutrition',
    'aliment',
    'alimentation',
    'manger',
    'bouger',
    'activite physique',
    'surpoids',
    'obesite',
    'poids',
    'regime',
    'nutri-score',
    'vitamine',
    'mineral',
    'fibre',
    'sucre',
    'sel',
    'alimentaire',
    'repas',
    'hydratation',
    'denutrition',
    'carence',
    'proteine',
    'proteines',
    'glucide',
    'glucides',
    'lipide',
    'lipides',
    'graisse',
    'graisses',
    'fruits et legumes',
    'fruits',
    'legumes',
    'imc',
    'indice de masse corporelle',
    'allaitement',
  ];
  const medicationKeywords = [
    'medicine',
    'medicines',
    'drug',
    'prescription',
    'antibiotic',
    'vaccine',
    'vaccination',
    'blood pressure medicines',
    'pain reliever',
    'immunization',
    'medicament',
    'medicaments',
    'traitement',
    'ordonnance',
    'posologie',
    'effets indesirables',
    'contre-indication',
    'vaccin',
    'vaccination',
    'dose',
    'dosage',
    'substance active',
    'principe actif',
    'interaction medicamenteuse',
    'interactions medicamenteuses',
    'pharmacovigilance',
    'voie d administration',
    'administration',
    'comprime',
    'gelule',
    'sirop',
    'solution injectable',
    'amm',
    'delivrance',
    'molecule',
    'dci',
    'notice',
    'specialite pharmaceutique',
  ];
  const vaccinationKeywords = [
    'vaccine',
    'vaccination',
    'immunization',
    'vaccin',
    'vaccins',
    'vaccinal',
    'calendrier vaccinal',
    'rappel vaccinal',
    'dose de rappel',
    'schema vaccinal',
    'couverture vaccinale',
    'maladies a prevention vaccinale',
    'immunisation',
    'vacciner',
  ];
  const rareDiseaseKeywords = [
    'rare disease',
    'genetic disease',
    'chromosomal disorder',
    'deletion syndrome',
    'maladie rare',
    'maladies rares',
    'orphanet',
    'orphadata',
    'syndrome rare',
    'malformation congenitale',
    'anomalie genetique',
    'deficience genetique',
    'maladie genetique rare',
    'maladie hereditaire rare',
    'variant pathogene',
    'deletion chromosomique',
  ];
  const anatomyKeywords = [
    'diagnostic test',
    'blood test',
    'lab test',
    'surgery',
    'anatomy',
    'body system',
    'bone',
    'lung',
    'kidney',
    'brain',
    'muscle',
    'nerve',
    'anatomie',
    'corps',
    'organe',
    'systeme',
    'cellule',
    'sang',
    'os',
    'muscle',
    'poumon',
    'foie',
    'rein',
    'cerveau',
    'analyse',
    'biologie',
    'prise de sang',
    'test biologique',
    'organes',
    'tissu',
    'tissus',
    'physiologie',
    'systeme nerveux',
    'systeme immunitaire',
    'systeme digestif',
    'systeme respiratoire',
    'systeme cardiovasculaire',
    'lymphocyte',
    'hormone',
    'enzyme',
    'recepteur',
    'bilan sanguin',
    'analyse de sang',
    'imagerie',
    'scanner',
    'irm',
    'radiographie',
    'echographie',
    'biopsie',
    'histologie',
    'hematologie',
    'laboratoire',
    'microbiologie',
  ];
  const epidemiologyKeywords = [
    'public health',
    'outbreak',
    'epidem',
    'screening',
    'sante publique',
    'depistage',
    'surveillance',
    'incidence',
    'prevalence',
    'campagne',
    'epidemiolog',
    'bulletin epidemiologique',
    'bulletin regional',
    'point epidemiologique',
    'donnees de surveillance',
    'mortalite',
    'morbidite',
    'cohorte',
    'enquete',
    'etude',
    'taux',
    'indicateur',
    'cas confirmes',
    'hospitalisations',
    'circulation virale',
    'cluster',
    'foyer epidemique',
  ];

  const computeScore = (keywords: string[]): number => {
    const titleMatches = countKeywordMatches(titleAndGroups, keywords);
    const summaryMatches = countKeywordMatches(summaryText, keywords);

    if (titleMatches === 0 && summaryMatches === 0) {
      return 0;
    }

    if (titleMatches > 0) {
      return Math.min(10, titleMatches * 4 + Math.min(summaryMatches, 2));
    }

    if (summaryMatches >= 3) {
      return Math.min(8, summaryMatches + 3);
    }

    return 0;
  };

  const generalisteScore = computeScore(generalisteKeywords);
  if (generalisteScore >= 4) {
    scores.medecin_generaliste = Math.max(scores.medecin_generaliste || 0, generalisteScore);
  }

  const cardioScore = computeScore(cardiologueKeywords);
  if (cardioScore >= 4) {
    scores.cardiologue = cardioScore;
  }

  const dermatoScore = computeScore(dermatologueKeywords);
  if (dermatoScore >= 4) {
    scores.dermatologue = dermatoScore;
  }

  const psychoScore = computeScore(psychologueKeywords);
  if (psychoScore >= 4) {
    scores.psychologue = psychoScore;
    scores.sante_mentale = Math.max(scores.sante_mentale || 0, psychoScore);
  }

  const mentalHealthScore = computeScore(mentalHealthKeywords);
  if (mentalHealthScore >= 4) {
    scores.sante_mentale = Math.max(scores.sante_mentale || 0, mentalHealthScore);
    scores.psychologue = Math.max(scores.psychologue || 0, Math.max(mentalHealthScore - 1, 4));
  }

  const nutritionScore = computeScore(nutritionKeywords);
  if (nutritionScore >= 4) {
    scores.nutritionniste = nutritionScore;
  }

  const medicationScore = computeScore(medicationKeywords);
  if (medicationScore >= 4) {
    scores.medicaments = medicationScore;
  }

  const vaccinationScore = computeScore(vaccinationKeywords);
  if (vaccinationScore >= 4) {
    scores.vaccination = vaccinationScore;
  }

  const rareScore = computeScore(rareDiseaseKeywords);
  if (rareScore >= 4) {
    scores.maladies_rares = rareScore;
    scores.anatomie_biologie = Math.max(scores.anatomie_biologie || 0, 5);
  }

  const anatomyScore = computeScore(anatomyKeywords);
  if (anatomyScore >= 4) {
    scores.anatomie_biologie = Math.max(scores.anatomie_biologie || 0, anatomyScore);
  }

  const epidemiologyScore = computeScore(epidemiologyKeywords);
  if (epidemiologyScore >= 4) {
    scores.epidemiologie = epidemiologyScore;
  }

  return scores;
}

function inferCategory(title: string, groups: string[], summary: string): string {
  const titleAndGroups = `${title} ${groups.join(' ')}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const summaryText = summary.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const agentScores = inferAgentScores(title, groups, summary);

  const agentCategoryPriority: Array<[AgentName, string]> = [
    ['vaccination', 'vaccination'],
    ['medicaments', 'medicaments'],
    ['cardiologue', 'cardiologie'],
    ['dermatologue', 'dermatologie'],
    ['psychologue', 'sante-mentale'],
    ['sante_mentale', 'sante-mentale'],
    ['nutritionniste', 'nutrition'],
    ['maladies_rares', 'genetique'],
    ['anatomie_biologie', 'anatomie-biologie'],
    ['epidemiologie', 'epidemiologie'],
  ];

  let bestCategory = '';
  let bestScore = 0;

  agentCategoryPriority.forEach(([agent, category]) => {
    const score = agentScores[agent] || 0;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  if (bestCategory && bestScore >= 4) {
    return bestCategory;
  }

  if (
    hasAnyKeyword(titleAndGroups, ['symptom', 'symptome', 'symptomes', 'signes', 'douleur', 'fievre']) ||
    hasAnyKeyword(summaryText, ['symptom', 'symptome', 'symptomes', 'signes', 'douleur', 'fievre'])
  ) {
    return 'symptomes';
  }

  return 'sante-generale';
}

function emitCandidates(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  candidates: CandidateDocument[],
  caps: Record<AgentName, number>
): void {
  const sorted = [...candidates].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return stableHash(left.doc.id) - stableHash(right.doc.id);
  });

  sorted.forEach((candidate) => {
    const bucket = store[candidate.agent];
    if (bucket.length >= caps[candidate.agent]) {
      return;
    }

    if (seenIds[candidate.agent].has(candidate.doc.id)) {
      return;
    }

    seenIds[candidate.agent].add(candidate.doc.id);
    bucket.push(candidate.doc);
  });
}

function createEmptyKnowledgeStore(): Record<AgentName, KnowledgeDocument[]> {
  return AGENTS.reduce((store, agent) => {
    store[agent] = [];
    return store;
  }, {} as Record<AgentName, KnowledgeDocument[]>);
}

function createSeenIdsStore(): Record<AgentName, Set<string>> {
  return AGENTS.reduce((store, agent) => {
    store[agent] = new Set<string>();
    return store;
  }, {} as Record<AgentName, Set<string>>);
}

function pushScoredCandidates(
  candidates: CandidateDocument[],
  doc: KnowledgeDocument,
  scores: Partial<Record<AgentName, number>>
): void {
  (Object.entries(scores) as Array<[AgentName, number]>).forEach(([agent, priority]) => {
    if (priority > 0) {
      candidates.push({ agent, doc, priority });
    }
  });
}

function extractH1Title(html: string): string {
  return (
    extractFirstMatch(html, /<h1[^>]*class="[^"]*(?:title-main|Cover-title)[^"]*"[^>]*>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?\s*<\/h1>/i) ||
    extractMetaContent(html, 'og:title') ||
    extractMetaContent(html, 'twitter:title') ||
    extractFirstMatch(html, /<main[\s\S]*?<h1[^>]*>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?\s*<\/h1>/i) ||
    normalizeWhitespace(decodeHtmlEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''))
      .replace(/\s+\|.*$/, '')
  );
}

function extractAmeliBodyText(html: string): string {
  const articleBlock = (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1] || '';
  const mainBlock = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || html;
  const contentRoot = articleBlock || mainBlock;
  const paragraphBlocks = extractAllMatches(contentRoot, /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi, 18).filter(
    (line) => line.length >= 35 && !line.startsWith('Cet article fait partie du dossier')
  );
  const headingBlocks = extractAllMatches(contentRoot, /<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/gi, 12).filter(
    (line) => line.length >= 5
  );

  return uniqueStrings([...paragraphBlocks, ...headingBlocks]).join('\n');
}

function extractMangerBougerBodyText(html: string): string {
  const richTexts = extractAllMatches(html, /<div class="ezrichtext-field">([\s\S]*?)<\/div>/gi, 8).filter(
    (line) => line.length >= 35
  );
  const headings = extractAllMatches(html, /<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/gi, 8).filter(
    (line) => line.length >= 5
  );

  return uniqueStrings([...richTexts, ...headings]).join('\n');
}

function extractSanteMentaleSummary(html: string): string {
  return (
    extractFirstMatch(html, /<p class="node-article__heading">([\s\S]*?)<\/p>/i) ||
    extractFirstMatch(html, /<p class="header-page__subtitle">([\s\S]*?)<\/p>/i) ||
    extractMetaContent(html, 'description') ||
    extractMetaContent(html, 'og:description')
  );
}

function extractSanteMentaleBodyText(html: string): string {
  if (html.includes('bloc-accordeon--faq')) {
    const qaBlocks = uniqueStrings(
      Array.from(
        html.matchAll(
          /<button[^>]*id="question-[^"]*"[^>]*>([\s\S]*?)<\/button>[\s\S]*?<dd[^>]*class="accordeon-item__content"[^>]*>[\s\S]*?<div class="wysiwyg-content">([\s\S]*?)<\/div>[\s\S]*?<\/dd>/gi
        )
      ).map((match) => {
        const question = normalizeWhitespace(htmlToPlainText(match[1]));
        const answer = normalizeWhitespace(htmlToPlainText(match[2]));
        return question && answer ? `Question: ${question}\nReponse: ${answer}` : '';
      })
    );

    if (qaBlocks.length > 0) {
      return qaBlocks.join('\n');
    }
  }

  const articleBlock = (html.match(/<div id="articleContent">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i) || [])[1] || '';
  const contentRoot = articleBlock || (html.match(/<main[\s\S]*?<\/main>/i) || [])[0] || html;
  const lines = uniqueStrings([
    ...extractAllMatches(contentRoot, /<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/gi, 18),
    ...extractAllMatches(contentRoot, /<p[^>]*>([\s\S]*?)<\/p>/gi, 40),
    ...extractAllMatches(contentRoot, /<li[^>]*>([\s\S]*?)<\/li>/gi, 50),
  ]).filter((line) => line.length >= 15);

  return lines.join('\n');
}

function getSanteMentaleUpdatedAt(html: string): string {
  return (
    extractFirstMatch(html, /<time[^>]*datetime="([^"]+)"[^>]*>/i) ||
    extractFirstMatch(html, /<p class="date">\s*([\s\S]*?)<\/p>/i)
  );
}

async function discoverSanteMentaleUrls(config: ProfileConfig): Promise<string[]> {
  const seedPaths = [
    '/',
    '/plan-du-site',
    '/en-prendre-soin/tous-les-conseils',
    '/en-prendre-soin/tous-les-exercices',
    '/trouver-de-l-aide/toutes-les-aides',
    '/questions-frequentes',
    '/lexique',
  ];

  const discoveredPaths = new Set<string>();
  const seedPages = await mapWithConcurrency(seedPaths, config.htmlConcurrency, async (path) => {
    try {
      return await fetchText(`${SANTE_MENTALE_SITE_BASE_URL}${path}`);
    } catch {
      return '';
    }
  });

  seedPages.forEach((html) => {
    if (!html) {
      return;
    }

    extractInternalPaths(html, SANTE_MENTALE_SITE_BASE_URL, {
      includePrefixes: [
        '/en-prendre-soin',
        '/trouver-de-l-aide',
        '/questions-frequentes',
        '/comprendre-la-sante-mentale',
        '/pour-mieux-comprendre-la-sante-mentale',
        '/quels-elements-peuvent-agir-sur-notre-sante-mentale',
        '/les-signes-auxquels-faire-attention',
        '/troubles-anxieux-comment-les-reconnaitre-comment-agir',
        '/depression-comment-la-reconnaitre-comment-agir',
        '/lexique',
      ],
      excludePrefixes: ['/declaration-d-accessibilite', '/mentions-legales', '/politique-de-confidentialite'],
    })
      .filter(
        (path) =>
          ![
            '/plan-du-site',
            '/questions-frequentes',
            '/en-prendre-soin',
            '/trouver-de-l-aide',
            '/lexique',
            '/comprendre-la-sante-mentale',
            '/pour-mieux-comprendre-la-sante-mentale',
          ].includes(path)
      )
      .forEach((path) => discoveredPaths.add(path));
  });

  return selectDeterministicSubset(Array.from(discoveredPaths), config.santeMentalePageLimit, (path) => path).map(
    (path) => `${SANTE_MENTALE_SITE_BASE_URL}${path}`
  );
}

async function ingestSanteMentaleInfoService(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const urls = await discoverSanteMentaleUrls(config);
  const candidates: CandidateDocument[] = [];

  await mapWithConcurrency(urls, config.htmlConcurrency, async (url) => {
    try {
      const html = await fetchText(url);
      const canonicalUrl = extractCanonicalUrl(html) || url;
      const title = extractH1Title(html);
      const summary = extractSanteMentaleSummary(html);
      const bodyText = truncateText(extractSanteMentaleBodyText(html), config.maxSummaryLength);
      const combinedText = `${summary} ${bodyText}`.trim();
      const updatedAt = getSanteMentaleUpdatedAt(html);

      if (!title || !combinedText) {
        return;
      }

      const doc: KnowledgeDocument = {
        id: `sante-mentale-${slugify(canonicalUrl.replace(SANTE_MENTALE_SITE_BASE_URL, ''))}`,
        category: inferCategory(title, ['Sante mentale info service'], combinedText),
        text: [
          `${title}:`,
          '- Source: Sante mentale info service',
          '- Langue source: fr',
          updatedAt ? `- Date de mise a jour: ${updatedAt}` : '',
          summary ? `- Resume: ${summary}` : '',
          bodyText ? `- Contenu: ${bodyText}` : '',
          `- URL: ${canonicalUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

      const scores = inferAgentScores(title, ['Sante mentale info service'], combinedText);
      scores.psychologue = Math.max(scores.psychologue || 0, 8);
      scores.sante_mentale = Math.max(scores.sante_mentale || 0, 8);
      scores.medecin_generaliste = Math.max(scores.medecin_generaliste || 0, 3);
      pushScoredCandidates(candidates, doc, scores);
    } catch {
      return;
    }
  });

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

function extractVaccinationUpdatedAt(html: string): string {
  const datetime = extractFirstMatch(html, /<time[^>]*datetime="([^"]+)"[^>]*>/i);
  if (datetime) {
    return datetime;
  }

  return extractFirstMatch(html, /<p class="date">[\s\S]*?([0-9]{2}\.[0-9]{2}\.[0-9]{4})[\s\S]*?<\/p>/i);
}

function extractVaccinationBodyText(html: string): string {
  const rowStart = html.search(/<div class="Row(?:\s|")/i);
  const rowEnd = html.search(/<div class="Main-sticky Main-sticky--scroll">/i);
  const contentRoot =
    rowStart >= 0 && rowEnd > rowStart
      ? html.slice(rowStart, rowEnd)
      : (html.match(/<main[\s\S]*?<\/main>/i) || [])[0] || html;

  const lines = uniqueStrings([
    ...extractAllMatches(contentRoot, /<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/gi, 24),
    ...extractAllMatches(contentRoot, /<p[^>]*>([\s\S]*?)<\/p>/gi, 80),
    ...extractAllMatches(contentRoot, /<li[^>]*>([\s\S]*?)<\/li>/gi, 120),
  ]).filter((line) => line.length >= 12);

  return lines.join('\n');
}

async function discoverVaccinationInfoServiceUrls(config: ProfileConfig): Promise<string[]> {
  const sitemapIndexXml = await fetchText(VACCINATION_INFO_SERVICE_SITEMAP_INDEX_URL);
  const sitemapUrls = uniqueStrings(
    Array.from(sitemapIndexXml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/g))
      .map((match) => normalizeWhitespace(decodeHtmlEntities(match[1])))
      .filter((url) => url.startsWith(VACCINATION_INFO_SERVICE_BASE_URL))
  );

  const sitemapPages = await mapWithConcurrency(sitemapUrls, config.htmlConcurrency, async (url) => {
    try {
      return await fetchText(url);
    } catch {
      return '';
    }
  });

  const allUrls = uniqueStrings(
    sitemapPages.flatMap((xml) =>
      Array.from(xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/g))
        .map((match) => normalizeWhitespace(decodeHtmlEntities(match[1])))
        .filter((url) => url.startsWith(VACCINATION_INFO_SERVICE_BASE_URL))
    )
  );

  const filteredUrls = allUrls.filter((url) => {
    const path = url.replace(`${VACCINATION_INFO_SERVICE_BASE_URL}/`, '');
    if (!path) {
      return false;
    }

    if (path.startsWith('Glossaire/') || path.startsWith('Infos/')) {
      return false;
    }

    return [
      'Les-maladies-et-leurs-vaccins/',
      'Generalites-sur-les-vaccinations/',
      'Vaccination-et-maladies-chroniques/',
      'La-vaccination-au-cours-de-la-vie/',
      'Questions-frequentes/',
      'Les-vaccins-existants-en-France',
    ].some((prefix) => path.startsWith(prefix));
  });

  const categoryPriority = (url: string): number => {
    const path = url.replace(`${VACCINATION_INFO_SERVICE_BASE_URL}/`, '');
    if (path.startsWith('Les-maladies-et-leurs-vaccins/')) {
      return 6;
    }
    if (path.startsWith('Generalites-sur-les-vaccinations/')) {
      return 5;
    }
    if (path.startsWith('Vaccination-et-maladies-chroniques/')) {
      return 4;
    }
    if (path.startsWith('La-vaccination-au-cours-de-la-vie/')) {
      return 4;
    }
    if (path.startsWith('Questions-frequentes/')) {
      return 3;
    }
    return 2;
  };

  return [...filteredUrls]
    .sort((left, right) => {
      const priorityDelta = categoryPriority(right) - categoryPriority(left);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return stableHash(left) - stableHash(right);
    })
    .slice(0, config.vaccinationInfoServicePageLimit);
}

async function ingestVaccinationInfoService(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const urls = await discoverVaccinationInfoServiceUrls(config);
  const candidates: CandidateDocument[] = [];

  await mapWithConcurrency(urls, config.htmlConcurrency, async (url) => {
    try {
      const html = await fetchText(url);
      const canonicalUrl = extractCanonicalUrl(html) || url;
      const title = extractH1Title(html);
      const summary = extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description');
      const bodyText = truncateText(extractVaccinationBodyText(html), config.maxSummaryLength);
      const combinedText = `${summary} ${bodyText}`.trim();
      const updatedAt = extractVaccinationUpdatedAt(html);

      if (!title || !combinedText) {
        return;
      }

      const doc: KnowledgeDocument = {
        id: `vaccination-info-service-${slugify(canonicalUrl.replace(VACCINATION_INFO_SERVICE_BASE_URL, ''))}`,
        category: inferCategory(title, ['Vaccination Info Service'], combinedText),
        text: [
          `${title}:`,
          '- Source: Vaccination Info Service',
          '- Langue source: fr',
          updatedAt ? `- Date de mise a jour: ${updatedAt}` : '',
          summary ? `- Resume: ${summary}` : '',
          bodyText ? `- Contenu: ${bodyText}` : '',
          `- URL: ${canonicalUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

      const scores = inferAgentScores(title, ['Vaccination Info Service'], combinedText);
      scores.vaccination = Math.max(scores.vaccination || 0, 8);
      scores.medecin_generaliste = Math.max(scores.medecin_generaliste || 0, 4);
      pushScoredCandidates(candidates, doc, scores);
    } catch {
      return;
    }
  });

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

function extractSantePubliqueFrancePathGroups(url: string): string[] {
  const path = url.replace(SANTE_PUBLIQUE_FRANCE_BASE_URL, '').replace(/^\/|\/$/g, '');
  if (!path) {
    return [];
  }

  return uniqueStrings(
    path
      .split('/')
      .filter(Boolean)
      .slice(0, 5)
      .map((segment) => segment.replace(/\.[a-z0-9]+$/i, '').replace(/[.-]+/g, ' '))
  );
}

function getSantePubliqueFranceBucket(path: string): SantePubliqueFranceBucket {
  const normalizedPath = path.replace(SANTE_PUBLIQUE_FRANCE_BASE_URL, '');

  if (normalizedPath.startsWith('/regions/')) {
    return 'regions';
  }
  if (normalizedPath.startsWith('/surveillance-syndromique-sursaud-R/')) {
    return 'surveillance-syndromique-sursaud-R';
  }
  if (normalizedPath.startsWith('/maladies-et-traumatismes/')) {
    return 'maladies-et-traumatismes';
  }
  if (normalizedPath.startsWith('/determinants-de-sante/')) {
    return 'determinants-de-sante';
  }
  if (normalizedPath.startsWith('/inegalites-sociales-et-territoriales-de-sante/')) {
    return 'inegalites-sociales-et-territoriales-de-sante';
  }
  if (normalizedPath.startsWith('/etudes-et-enquetes/')) {
    return 'etudes-et-enquetes';
  }
  if (normalizedPath.startsWith('/les-actualites/')) {
    return 'les-actualites';
  }
  if (normalizedPath.startsWith('/la-sante-a-tout-age/')) {
    return 'la-sante-a-tout-age';
  }
  if (normalizedPath.startsWith('/competences-psychosociales/')) {
    return 'competences-psychosociales';
  }
  if (normalizedPath.startsWith('/don-de-sang/')) {
    return 'don-de-sang';
  }

  return 'other';
}

function getSantePubliqueFranceTopicKey(url: string): string {
  const normalizedPath = url.replace(SANTE_PUBLIQUE_FRANCE_BASE_URL, '');
  const parts = normalizedPath.split('/').filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0] || normalizedPath || 'root';
}

function selectRoundRobinByTopic(urls: string[], limit: number): string[] {
  if (urls.length <= limit) {
    return [...urls];
  }

  const urlsByTopic = new Map<string, string[]>();
  const topicOrder: string[] = [];

  urls.forEach((url) => {
    const topicKey = getSantePubliqueFranceTopicKey(url);
    if (!urlsByTopic.has(topicKey)) {
      urlsByTopic.set(topicKey, []);
      topicOrder.push(topicKey);
    }
    urlsByTopic.get(topicKey)?.push(url);
  });

  const selected: string[] = [];
  let cursor = 0;

  while (selected.length < limit && topicOrder.length > 0) {
    const topicKey = topicOrder[cursor];
    const queue = urlsByTopic.get(topicKey) || [];

    if (queue.length === 0) {
      topicOrder.splice(cursor, 1);
      if (topicOrder.length === 0) {
        break;
      }
      cursor %= topicOrder.length;
      continue;
    }

    selected.push(queue.shift() as string);
    cursor = (cursor + 1) % topicOrder.length;
  }

  return selected;
}

function extractSantePubliqueFranceUpdatedAt(html: string): string {
  return extractFirstMatch(html, /<div class="date">([\s\S]*?)<\/div>/i);
}

function extractSantePubliqueFrancePdfUrl(html: string): string {
  const href =
    (html.match(/<a[^>]+class="[^"]*button--pdf[^"]*"[^>]+href="([^"]+)"/i) || [])[1] ||
    (html.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*button--pdf[^"]*"/i) || [])[1] ||
    '';

  return absolutizeUrl(href, SANTE_PUBLIQUE_FRANCE_BASE_URL);
}

function extractSantePubliqueFranceBodyText(html: string): string {
  const contentStart = html.search(/<div class="article__main-content\b/i);
  let contentRoot = '';

  if (contentStart >= 0) {
    const startTagEnd = html.indexOf('>', contentStart);
    const footerStart = html.search(/<div class="page__content-footer"/i);
    const endIndex = footerStart > startTagEnd ? footerStart : html.search(/<\/main>/i);

    if (startTagEnd >= 0 && endIndex > startTagEnd) {
      contentRoot = html.slice(startTagEnd + 1, endIndex);
    }
  }

  if (!contentRoot) {
    contentRoot = (html.match(/<main[\s\S]*?<\/main>/i) || [])[0] || html;
  }

  const lines = uniqueStrings([
    ...extractAllMatches(contentRoot, /<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/gi, 28),
    ...extractAllMatches(contentRoot, /<p[^>]*>([\s\S]*?)<\/p>/gi, 100),
    ...extractAllMatches(contentRoot, /<li[^>]*>([\s\S]*?)<\/li>/gi, 140),
  ]).filter((line) => line.length >= 12);

  return lines.join('\n');
}

function extractSantePubliqueFranceSummary(html: string, bodyText: string): string {
  const bodySummary = bodyText
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .find(
      (line) =>
        line.length >= 40 &&
        !/^points cles$/i.test(line) &&
        !/^pour en savoir plus$/i.test(line) &&
        !/^annee de publication$/i.test(line)
    );

  if (bodySummary) {
    return truncateText(bodySummary, 320);
  }

  return truncateText(
    extractMetaContent(html, 'description') ||
      extractMetaContent(html, 'og:description') ||
      extractMetaContent(html, 'twitter:description'),
    320
  );
}

async function discoverSantePubliqueFranceUrls(config: ProfileConfig): Promise<string[]> {
  const sitemapIndexXml = await fetchText(SANTE_PUBLIQUE_FRANCE_SITEMAP_INDEX_URL);
  const sitemapUrls = extractXmlLocs(sitemapIndexXml).filter((url) => url.startsWith(SANTE_PUBLIQUE_FRANCE_BASE_URL));
  const sitemapPages = await mapWithConcurrency(sitemapUrls, config.htmlConcurrency, async (url) => {
    try {
      return await fetchText(url);
    } catch {
      return '';
    }
  });

  const allowedPathPrefixes = [
    '/determinants-de-sante/',
    '/maladies-et-traumatismes/',
    '/regions/',
    '/surveillance-syndromique-sursaud-R/',
    '/inegalites-sociales-et-territoriales-de-sante/',
    '/etudes-et-enquetes/',
    '/les-actualites/',
    '/la-sante-a-tout-age/',
    '/competences-psychosociales/',
    '/don-de-sang/',
  ];

  const allUrls = uniqueStrings(
    sitemapPages.flatMap((xml) =>
      extractXmlLocs(xml).filter((url) => url.startsWith(SANTE_PUBLIQUE_FRANCE_BASE_URL))
    )
  );

  const filteredUrls = allUrls.filter((url) => {
    const path = url.replace(SANTE_PUBLIQUE_FRANCE_BASE_URL, '');
    const depth = path.split('/').filter(Boolean).length;

    if (!path || path === '/' || path.startsWith('/en/') || path.startsWith('/docs/') || path.startsWith('/a-propos/')) {
      return false;
    }

    if (
      path.includes('/content/download/') ||
      path.includes('?') ||
      path.includes('#') ||
      /\.(?:pdf|png|jpg|jpeg|webp|svg|xml)$/i.test(path)
    ) {
      return false;
    }

    if (!allowedPathPrefixes.some((prefix) => path.startsWith(prefix))) {
      return false;
    }

    if (/\/documents\/\d+(?:\/|$)/.test(path)) {
      return false;
    }

    return depth >= 3;
  });

  const priorityForUrl = (url: string): number => {
    const path = url.replace(SANTE_PUBLIQUE_FRANCE_BASE_URL, '');
    let priority = 0;

    if (path.startsWith('/surveillance-syndromique-sursaud-R/')) {
      priority += 8;
    }
    if (path.startsWith('/regions/')) {
      priority += 7;
    }
    if (path.startsWith('/maladies-et-traumatismes/')) {
      priority += 6;
    }
    if (path.startsWith('/determinants-de-sante/')) {
      priority += 6;
    }
    if (path.startsWith('/inegalites-sociales-et-territoriales-de-sante/')) {
      priority += 5;
    }
    if (path.startsWith('/etudes-et-enquetes/')) {
      priority += 4;
    }
    if (path.startsWith('/les-actualites/')) {
      priority += 3;
    }
    if (path.includes('/documents/')) {
      priority += 3;
    }
    if (path.includes('/bulletin') || path.includes('/surveillance-')) {
      priority += 4;
    }
    if (path.includes('/nutrition') || path.includes('/activite-physique')) {
      priority += 2;
    }
    if (path.includes('/sante-mentale') || path.includes('/psychosociales')) {
      priority += 2;
    }
    if (path.includes('/vaccin') || path.includes('/vaccination')) {
      priority += 2;
    }

    return priority;
  };

  const globallyRankedUrls = [...filteredUrls].sort((left, right) => {
    const priorityDelta = priorityForUrl(right) - priorityForUrl(left);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return stableHash(left) - stableHash(right);
  });
  const selectedUrls: string[] = [];
  const seenUrls = new Set<string>();

  (Object.entries(config.santePubliqueFranceBucketMinimums) as Array<[SantePubliqueFranceBucket, number]>).forEach(
    ([bucket, minimumCount]) => {
      if (!minimumCount || minimumCount <= 0) {
        return;
      }

      const rankedBucketUrls = globallyRankedUrls.filter((url) => getSantePubliqueFranceBucket(url) === bucket);
      const bucketUrls =
        bucket === 'maladies-et-traumatismes'
          ? selectRoundRobinByTopic(rankedBucketUrls, minimumCount)
          : rankedBucketUrls.slice(0, minimumCount);

      bucketUrls.forEach((url) => {
        if (!seenUrls.has(url) && selectedUrls.length < config.santePubliqueFrancePageLimit) {
          seenUrls.add(url);
          selectedUrls.push(url);
        }
      });
    }
  );

  globallyRankedUrls.forEach((url) => {
    if (selectedUrls.length >= config.santePubliqueFrancePageLimit || seenUrls.has(url)) {
      return;
    }

    seenUrls.add(url);
    selectedUrls.push(url);
  });

  return selectedUrls.sort((left, right) => {
      const priorityDelta = priorityForUrl(right) - priorityForUrl(left);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return stableHash(left) - stableHash(right);
    });
}

async function ingestSantePubliqueFrance(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const urls = await discoverSantePubliqueFranceUrls(config);
  const candidates: CandidateDocument[] = [];

  await mapWithConcurrency(urls, config.htmlConcurrency, async (url) => {
    try {
      const html = await fetchText(url);
      const canonicalUrl = absolutizeUrl(extractCanonicalUrl(html), SANTE_PUBLIQUE_FRANCE_BASE_URL) || url;
      const title = extractH1Title(html);
      const bodyText = truncateText(extractSantePubliqueFranceBodyText(html), config.maxSummaryLength);
      const summary = extractSantePubliqueFranceSummary(html, bodyText);
      const combinedText = `${summary} ${bodyText}`.trim();
      const updatedAt = extractSantePubliqueFranceUpdatedAt(html);
      const pdfUrl = extractSantePubliqueFrancePdfUrl(html);
      const groups = extractSantePubliqueFrancePathGroups(canonicalUrl);
      const normalizedPath = canonicalUrl
        .replace(SANTE_PUBLIQUE_FRANCE_BASE_URL, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (!title || !combinedText) {
        return;
      }

      const doc: KnowledgeDocument = {
        id: `sante-publique-france-${slugify(canonicalUrl.replace(SANTE_PUBLIQUE_FRANCE_BASE_URL, ''))}`,
        category: inferCategory(title, groups, combinedText),
        text: [
          `${title}:`,
          '- Source: Sante publique France',
          '- Langue source: fr',
          groups.length > 0 ? `- Rubriques: ${groups.join('; ')}` : '',
          updatedAt ? `- Date de publication / mise a jour: ${updatedAt}` : '',
          summary ? `- Resume: ${summary}` : '',
          bodyText ? `- Contenu: ${bodyText}` : '',
          pdfUrl ? `- PDF: ${pdfUrl}` : '',
          `- URL: ${canonicalUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

      const scores = inferAgentScores(title, groups, combinedText);
      scores.medecin_generaliste = Math.max(scores.medecin_generaliste || 0, 3);

      if (
        normalizedPath.includes('/regions/') ||
        normalizedPath.includes('surveillance') ||
        normalizedPath.includes('/etudes-et-enquetes/') ||
        normalizedPath.includes('/inegalites-sociales-et-territoriales-de-sante/')
      ) {
        scores.epidemiologie = Math.max(scores.epidemiologie || 0, 8);
      }

      if (normalizedPath.includes('nutrition') || normalizedPath.includes('activite-physique')) {
        scores.nutritionniste = Math.max(scores.nutritionniste || 0, 7);
      }

      if (normalizedPath.includes('sante-mentale') || normalizedPath.includes('psychosociales')) {
        scores.psychologue = Math.max(scores.psychologue || 0, 7);
        scores.sante_mentale = Math.max(scores.sante_mentale || 0, 7);
      }

      if (normalizedPath.includes('vaccin') || normalizedPath.includes('vaccination')) {
        scores.vaccination = Math.max(scores.vaccination || 0, 7);
      }

      pushScoredCandidates(candidates, doc, scores);
    } catch {
      return;
    }
  });

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

async function ingestAmeliTopics(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const themePages = await mapWithConcurrency(alphabet, config.htmlConcurrency, async (letter) => {
    try {
      return await fetchText(`${AMELI_THEME_INDEX_BASE_URL}/${letter}`);
    } catch {
      return '';
    }
  });

  const themeSlugs = uniqueStrings(
    themePages.flatMap((html) => {
      if (!html) {
        return [];
      }

      return Array.from(html.matchAll(/href="(\/assure\/sante\/themes\/[^"#?]+)"/g))
        .map((match) => match[1].replace(/^\/assure\/sante\/themes\//, ''))
        .filter((slug) => slug && !slug.includes('/') && slug.length > 1);
    })
  );

  const selectedThemes = selectDeterministicSubset(themeSlugs, config.ameliThemeLimit, (slug) => slug);

  const articleUrlsByTheme = await mapWithConcurrency(selectedThemes, config.htmlConcurrency, async (themeSlug) => {
    const themeUrl = `${AMELI_SITE_BASE_URL}/assure/sante/themes/${themeSlug}`;

    try {
      const html = await fetchText(themeUrl);
      const rawLinks = uniqueStrings(
        Array.from(
          html.matchAll(
            new RegExp(`href="(\\/assure\\/sante\\/themes\\/${escapeRegExp(themeSlug)}\\/[^"#?]+)"`, 'g')
          )
        ).map((match) => absolutizeUrl(match[1], AMELI_SITE_BASE_URL))
      );

      if (rawLinks.length === 0) {
        return [themeUrl];
      }

      return selectDeterministicSubset(rawLinks, config.ameliArticlesPerTheme, (url) => url);
    } catch {
      return [];
    }
  });

  const articleUrls = uniqueStrings(articleUrlsByTheme.flat());
  const candidates: CandidateDocument[] = [];

  await mapWithConcurrency(articleUrls, config.htmlConcurrency, async (url) => {
    try {
      const html = await fetchText(url);
      const canonicalUrl = extractCanonicalUrl(html) || url;
      const title = extractH1Title(html);
      const summary =
        extractFirstMatch(html, /<p class="field_ameli_chapo[^"]*">([\s\S]*?)<\/p>/i) ||
        extractMetaContent(html, 'description') ||
        extractMetaContent(html, 'og:description');
      const bodyText = truncateText(extractAmeliBodyText(html), config.maxSummaryLength);
      const combinedText = `${summary} ${bodyText}`.trim();
      const theme = extractFirstMatch(
        html,
        /<p class="article-reference">[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/p>/i
      );
      const updatedAt = extractFirstMatch(html, /<p class="date">\s*([\s\S]*?)\s*<\/p>/i);

      if (!title || !combinedText) {
        return;
      }

      const doc: KnowledgeDocument = {
        id: `ameli-${slugify(canonicalUrl.replace(AMELI_SITE_BASE_URL, ''))}`,
        category: inferCategory(title, theme ? [theme] : [], combinedText),
        text: [
          `${title}:`,
          '- Source: ameli.fr',
          '- Langue source: fr',
          theme ? `- Theme: ${theme}` : '',
          updatedAt ? `- Date de mise a jour: ${updatedAt}` : '',
          summary ? `- Resume: ${summary}` : '',
          bodyText ? `- Contenu: ${bodyText}` : '',
          `- URL: ${canonicalUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

      const scores = inferAgentScores(title, theme ? [theme] : [], combinedText);
      scores.medecin_generaliste = Math.max(scores.medecin_generaliste || 0, 4);
      pushScoredCandidates(candidates, doc, scores);
    } catch {
      return;
    }
  });

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

async function ingestMangerBouger(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const sitemapXml = await fetchText(MANGER_BOUGER_SITEMAP_URL);
  const sitemapUrls = uniqueStrings(
    Array.from(sitemapXml.matchAll(/<loc>([\s\S]*?)<\/loc>/g))
      .map((match) => normalizeWhitespace(decodeHtmlEntities(match[1])))
      .filter((url) => {
        if (!url.startsWith(MANGER_BOUGER_SITE_BASE_URL)) {
          return false;
        }

        if (url.endsWith('.pdf') || url.includes('/content/show/') || url.includes('/professionnels/')) {
          return false;
        }

        return url.includes('/manger-mieux/') || url.includes('/bouger-plus/');
      })
  );
  const selectedUrls = selectDeterministicSubset(sitemapUrls, config.mangerBougerPageLimit, (url) => url);
  const candidates: CandidateDocument[] = [];

  await mapWithConcurrency(selectedUrls, config.htmlConcurrency, async (url) => {
    try {
      const html = await fetchText(url);
      const canonicalUrl = extractCanonicalUrl(html) || url;
      const title = extractH1Title(html);
      const summary =
        extractFirstMatch(html, /<div class="PromotedSliderIntro-text"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ||
        extractMetaContent(html, 'description') ||
        extractMetaContent(html, 'og:description');
      const bodyText = truncateText(extractMangerBougerBodyText(html), config.maxSummaryLength);
      const combinedText = `${summary} ${bodyText}`.trim();

      if (!title || !combinedText) {
        return;
      }

      const doc: KnowledgeDocument = {
        id: `manger-bouger-${slugify(canonicalUrl.replace(MANGER_BOUGER_SITE_BASE_URL, ''))}`,
        category: inferCategory(title, ['Manger Bouger'], combinedText),
        text: [
          `${title}:`,
          '- Source: Manger Bouger / Sante publique France',
          '- Langue source: fr',
          summary ? `- Resume: ${summary}` : '',
          bodyText ? `- Contenu: ${bodyText}` : '',
          `- URL: ${canonicalUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

      const scores = inferAgentScores(title, ['Manger Bouger'], combinedText);
      scores.nutritionniste = Math.max(scores.nutritionniste || 0, 8);
      scores.medecin_generaliste = Math.max(scores.medecin_generaliste || 0, 3);
      pushScoredCandidates(candidates, doc, scores);
    } catch {
      return;
    }
  });

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

async function ingestMedlinePlusTopics(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const latestTopicsUrl = await discoverLatestMedlinePlusTopicsUrl();
  const xml = await fetchText(latestTopicsUrl);
  const candidates: CandidateDocument[] = [];
  const topicRegex = /<health-topic\b([^>]*)>([\s\S]*?)<\/health-topic>/g;
  let match: RegExpExecArray | null = topicRegex.exec(xml);

  while (match) {
    const attributes = parseAttributes(match[1]);
    const block = match[2];

    if ((attributes.language || '').toLowerCase() !== 'english') {
      match = topicRegex.exec(xml);
      continue;
    }

    const title = normalizeWhitespace(attributes.title || '');
    const url = attributes.url || '';
    const topicId = attributes.id || slugify(title);
    const alsoCalled = uniqueStrings(getTagContents(block, 'also-called').map(cleanRichText)).slice(0, 4);
    const groups = uniqueStrings(getTagContents(block, 'group').map(cleanRichText));
    const summary = truncateText(cleanRichText(getFirstTagContent(block, 'full-summary')), config.maxSummaryLength);

    if (!title || !summary) {
      match = topicRegex.exec(xml);
      continue;
    }

    const textSections = [
      `${title}:`,
      '- Source: MedlinePlus',
      '- Langue source: en',
      groups.length > 0 ? `- Groupes: ${groups.join('; ')}` : '',
      alsoCalled.length > 0 ? `- Alias: ${alsoCalled.join('; ')}` : '',
      `- Resume: ${summary}`,
      url ? `- URL: ${url}` : '',
    ].filter(Boolean);

    const doc: KnowledgeDocument = {
      id: `medlineplus-topic-${topicId}`,
      category: inferCategory(title, groups, summary),
      text: textSections.join('\n'),
    };

    const agentScores = inferAgentScores(title, groups, summary);
    (Object.entries(agentScores) as Array<[AgentName, number]>).forEach(([agent, score]) => {
      if (score > 0) {
        candidates.push({
          agent,
          doc,
          priority: score,
        });
      }
    });

    match = topicRegex.exec(xml);
  }

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

function inferDefinitionAgents(term: string, definition: string, sourceUrl: string): Partial<Record<AgentName, number>> {
  const scores = inferAgentScores(term, [], definition);

  if (
    sourceUrl.includes('fitnessdefinitions') ||
    sourceUrl.includes('nutritiondefinitions') ||
    sourceUrl.includes('mineralsdefinitions') ||
    sourceUrl.includes('vitaminsdefinitions')
  ) {
    scores.nutritionniste = Math.max(scores.nutritionniste || 0, 5);
  }

  if (sourceUrl.includes('generalhealthdefinitions')) {
    scores.anatomie_biologie = Math.max(scores.anatomie_biologie || 0, 6);
  }

  return scores;
}

async function ingestMedlinePlusDefinitions(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  for (const definitionUrl of MEDLINEPLUS_DEFINITION_URLS) {
    const xml = await fetchText(definitionUrl);
    const candidates: CandidateDocument[] = [];
    const termGroupRegex = /<term-group\b([^>]*)>([\s\S]*?)<\/term-group>/g;
    let match: RegExpExecArray | null = termGroupRegex.exec(xml);

    while (match) {
      const attributes = parseAttributes(match[1]);
      const block = match[2];
      const rawTerm = cleanRichText(getFirstTagContent(block, 'term')).replace(/^>/, '').trim();
      const rawDefinition = cleanRichText(getFirstTagContent(block, 'definition')).replace(/^>/, '').trim();
      const reference = normalizeWhitespace(attributes.reference || 'MedlinePlus');

      if (!rawTerm || !rawDefinition) {
        match = termGroupRegex.exec(xml);
        continue;
      }

      const doc: KnowledgeDocument = {
        id: `medlineplus-definition-${slugify(rawTerm)}`,
        category: 'definition-sante',
        text: [
          `${rawTerm}:`,
          '- Source: MedlinePlus Definitions',
          '- Langue source: en',
          `- Reference: ${reference}`,
          `- Definition: ${truncateText(rawDefinition, Math.min(1000, config.maxSummaryLength))}`,
          `- URL: ${definitionUrl}`,
        ].join('\n'),
      };

      const scores = inferDefinitionAgents(rawTerm, rawDefinition, definitionUrl);
      (Object.entries(scores) as Array<[AgentName, number]>).forEach(([agent, score]) => {
        if (score > 0) {
          candidates.push({
            agent,
            doc,
            priority: score,
          });
        }
      });

      match = termGroupRegex.exec(xml);
    }

    const cappedCandidates = candidates
      .sort((left, right) => stableHash(left.doc.id) - stableHash(right.doc.id))
      .slice(0, config.medlinePlusDefinitionsPerFile * AGENTS.length);

    emitCandidates(store, seenIds, cappedCandidates, config.agentCaps);
  }
}

async function ingestMedlinePlusGenetics(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const xml = await fetchText(MEDLINEPLUS_GENETICS_URL);
  const candidates: CandidateDocument[] = [];
  const summaryRegex = /<health-condition-summary\b([^>]*)>([\s\S]*?)<\/health-condition-summary>/g;
  let match: RegExpExecArray | null = summaryRegex.exec(xml);

  while (match) {
    const block = match[2];
    const name = cleanRichText(getFirstTagContent(block, 'name'));
    const pageUrl = cleanRichText(getFirstTagContent(block, 'ghr-page'));

    if (!name) {
      match = summaryRegex.exec(xml);
      continue;
    }

    const textRegex = /<text>([\s\S]*?)<\/text>/g;
    const textSegments: string[] = [];
    let textMatch: RegExpExecArray | null = textRegex.exec(block);

    while (textMatch) {
      const textBlock = textMatch[1];
      const role = cleanRichText(getFirstTagContent(textBlock, 'text-role'));
      const htmlPayload = cleanRichText(getFirstTagContent(textBlock, 'html'));
      if (role && htmlPayload) {
        textSegments.push(`${role}: ${htmlPayload}`);
      }
      textMatch = textRegex.exec(block);
    }

    if (textSegments.length === 0) {
      match = summaryRegex.exec(xml);
      continue;
    }

    const combinedText = truncateText(textSegments.join(' '), config.maxSummaryLength);
    const doc: KnowledgeDocument = {
      id: `medlineplus-genetics-${slugify(name)}`,
      category: 'genetique',
      text: [
        `${name}:`,
        '- Source: MedlinePlus Genetics',
        '- Langue source: en',
        `- Resume: ${combinedText}`,
        pageUrl ? `- URL: ${pageUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };

    const geneticsCandidates: CandidateDocument[] = [
      {
        agent: 'maladies_rares',
        doc,
        priority: 7,
      },
      {
        agent: 'anatomie_biologie',
        doc,
        priority: 5,
      },
      {
        agent: 'medecin_generaliste',
        doc,
        priority: 2,
      },
    ];

    candidates.push(...geneticsCandidates);
    match = summaryRegex.exec(xml);
  }

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

function isCommercializedDrug(record: BdpmDrugRecord): boolean {
  return record.commercialStatus.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('commercialisee');
}

function isLikelyHomeopathic(record: BdpmDrugRecord): boolean {
  const text = `${record.name} ${record.procedure}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return text.includes('homeo') || text.includes('homeopath');
}

function parseBdpmDrugRecord(line: string): BdpmDrugRecord | null {
  const columns = line.split('\t');

  if (columns.length < 12) {
    return null;
  }

  return {
    cis: normalizeWhitespace(columns[0]),
    name: normalizeWhitespace(columns[1]),
    form: normalizeWhitespace(columns[2]),
    routes: normalizeWhitespace(columns[3]),
    authorizationStatus: normalizeWhitespace(columns[4]),
    procedure: normalizeWhitespace(columns[5]),
    commercialStatus: normalizeWhitespace(columns[6]),
    authorizationDate: normalizeWhitespace(columns[7]),
    holder: normalizeWhitespace(columns[10]),
    isGeneric: normalizeWhitespace(columns[11]),
  };
}

function parseBdpmComposition(line: string): { cis: string; composition: BdpmComposition } | null {
  const columns = line.split('\t');

  if (columns.length < 8) {
    return null;
  }

  return {
    cis: normalizeWhitespace(columns[0]),
    composition: {
      substanceName: normalizeWhitespace(columns[3]),
      dosage: normalizeWhitespace(columns[4]),
      referenceUnit: normalizeWhitespace(columns[5]),
      nature: normalizeWhitespace(columns[6]),
    },
  };
}

async function ingestBdpm(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const [cisRaw, compositionsRaw, prescriptionRaw, importantInfoRaw] = await Promise.all([
    fetchText(BDPM_CIS_URL, 'latin1'),
    fetchText(BDPM_COMPO_URL, 'latin1'),
    fetchText(BDPM_CPD_URL, 'latin1'),
    fetchText(BDPM_IMPORTANT_INFO_URL, 'latin1'),
  ]);

  const drugByCis = new Map<string, BdpmDrugRecord>();
  cisRaw
    .split('\n')
    .map((line) => line.trimEnd())
    .forEach((line) => {
      if (!line) {
        return;
      }

      const record = parseBdpmDrugRecord(line);
      if (!record || !record.cis) {
        return;
      }

      drugByCis.set(record.cis, record);
    });

  const compositionsByCis = new Map<string, BdpmComposition[]>();
  compositionsRaw
    .split('\n')
    .map((line) => line.trimEnd())
    .forEach((line) => {
      if (!line) {
        return;
      }

      const parsed = parseBdpmComposition(line);
      if (!parsed) {
        return;
      }

      const bucket = compositionsByCis.get(parsed.cis) || [];
      bucket.push(parsed.composition);
      compositionsByCis.set(parsed.cis, bucket);
    });

  const prescriptionByCis = new Map<string, string[]>();
  prescriptionRaw
    .split('\n')
    .map((line) => line.trimEnd())
    .forEach((line) => {
      if (!line) {
        return;
      }

      const columns = line.split('\t');
      if (columns.length < 2) {
        return;
      }

      const cis = normalizeWhitespace(columns[0]);
      const value = normalizeWhitespace(columns[1]);
      if (!cis || !value) {
        return;
      }

      const bucket = prescriptionByCis.get(cis) || [];
      bucket.push(value);
      prescriptionByCis.set(cis, bucket);
    });

  const importantInfoByCis = new Map<string, string[]>();
  importantInfoRaw
    .split('\n')
    .map((line) => line.trimEnd())
    .forEach((line) => {
      if (!line) {
        return;
      }

      const columns = line.split('\t');
      if (columns.length < 4) {
        return;
      }

      const cis = normalizeWhitespace(columns[0]);
      const title = cleanRichText(columns[3]);
      if (!cis || !title) {
        return;
      }

      const bucket = importantInfoByCis.get(cis) || [];
      bucket.push(title);
      importantInfoByCis.set(cis, bucket);
    });

  const representativeByComposition = new Map<string, BdpmDrugRecord>();

  Array.from(drugByCis.values())
    .filter((record) => isCommercializedDrug(record) && !isLikelyHomeopathic(record))
    .forEach((record) => {
      const compositions = (compositionsByCis.get(record.cis) || [])
        .filter((item) => item.nature === 'SA' || item.nature === 'FT')
        .map((item) => item.substanceName)
        .filter(Boolean);

      const compositionKey = uniqueStrings(compositions)
        .sort((left, right) => left.localeCompare(right))
        .join('|');

      if (!compositionKey) {
        return;
      }

      const existing = representativeByComposition.get(compositionKey);
      if (!existing) {
        representativeByComposition.set(compositionKey, record);
        return;
      }

      if (existing.isGeneric === 'Oui' && record.isGeneric !== 'Oui') {
        representativeByComposition.set(compositionKey, record);
      }
    });

  const selectedDrugs = Array.from(representativeByComposition.values())
    .sort((left, right) => {
      const leftHasImportantInfo = (importantInfoByCis.get(left.cis) || []).length > 0 ? 1 : 0;
      const rightHasImportantInfo = (importantInfoByCis.get(right.cis) || []).length > 0 ? 1 : 0;

      if (leftHasImportantInfo !== rightHasImportantInfo) {
        return rightHasImportantInfo - leftHasImportantInfo;
      }

      return stableHash(left.cis) - stableHash(right.cis);
    })
    .slice(0, config.bdpmRepresentativeLimit);

  const candidates: CandidateDocument[] = [];

  selectedDrugs.forEach((record) => {
    const activeSubstances = uniqueStrings(
      (compositionsByCis.get(record.cis) || [])
        .filter((item) => item.nature === 'SA')
        .map((item) => normalizeWhitespace(`${item.substanceName} ${item.dosage}`))
    );
    const prescriptionConditions = uniqueStrings(prescriptionByCis.get(record.cis) || []).slice(0, 4);
    const importantInformation = uniqueStrings(importantInfoByCis.get(record.cis) || []).slice(0, 3);

    const doc: KnowledgeDocument = {
      id: `bdpm-${record.cis}`,
      category: record.name.toLowerCase().includes('vaccin') ? 'vaccination' : 'medicament-fr',
      text: [
        `${record.name}:`,
        '- Source: Base de Donnees Publique des Medicaments',
        '- Langue source: fr',
        `- Statut commercial: ${record.commercialStatus}`,
        record.authorizationStatus ? `- Autorisation: ${record.authorizationStatus}` : '',
        record.procedure ? `- Procedure: ${record.procedure}` : '',
        record.form ? `- Forme: ${record.form}` : '',
        record.routes ? `- Voies d administration: ${record.routes}` : '',
        record.holder ? `- Titulaire: ${record.holder}` : '',
        record.authorizationDate ? `- Date d autorisation: ${record.authorizationDate}` : '',
        activeSubstances.length > 0 ? `- Substances actives: ${activeSubstances.join('; ')}` : '',
        prescriptionConditions.length > 0
          ? `- Conditions de prescription/delivrance: ${prescriptionConditions.join('; ')}`
          : '',
        importantInformation.length > 0
          ? `- Informations importantes ANSM: ${importantInformation.join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };

    candidates.push({
      agent: 'medicaments',
      doc,
      priority: importantInformation.length > 0 ? 7 : 5,
    });

    if (record.name.toLowerCase().includes('vaccin')) {
      candidates.push({
        agent: 'vaccination',
        doc,
        priority: 6,
      });
    }
  });

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

interface OpenFdaLabelResponse {
  results?: Array<Record<string, unknown>>;
}

function extractStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? normalizeWhitespace(item) : ''))
    .filter(Boolean);
}

async function ingestOpenFdaDrugLabels(
  store: Record<AgentName, KnowledgeDocument[]>,
  seenIds: Record<AgentName, Set<string>>,
  config: ProfileConfig
): Promise<void> {
  const query = 'openfda.product_type:"HUMAN PRESCRIPTION DRUG"+AND+_exists_:indications_and_usage';
  const url = `${OPENFDA_BASE_URL}?search=${query.replace(/ /g, '%20')}&limit=${config.openFdaLimit}`;
  const payload = await fetchJson<OpenFdaLabelResponse>(url);
  const results = payload.results || [];
  const candidates: CandidateDocument[] = [];
  const seenGenericNames = new Set<string>();

  results.forEach((result, index) => {
    const openfda = typeof result.openfda === 'object' && result.openfda ? (result.openfda as Record<string, unknown>) : {};
    const brandNames = extractStringList(openfda.brand_name);
    const genericNames = extractStringList(openfda.generic_name);
    const routes = extractStringList(openfda.route);
    const substanceNames = extractStringList(openfda.substance_name);
    const manufacturerNames = extractStringList(openfda.manufacturer_name);
    const indications = truncateText(extractStringList(result.indications_and_usage).join(' '), 1200);
    const warnings = truncateText(extractStringList(result.warnings).join(' '), 900);
    const adverseReactions = truncateText(extractStringList(result.adverse_reactions).join(' '), 700);
    const dosage = truncateText(extractStringList(result.dosage_and_administration).join(' '), 500);
    const effectiveTime = typeof result.effective_time === 'string' ? result.effective_time : '';

    const canonicalGenericName = genericNames[0] || brandNames[0] || '';
    if (!canonicalGenericName || seenGenericNames.has(canonicalGenericName.toLowerCase())) {
      return;
    }

    seenGenericNames.add(canonicalGenericName.toLowerCase());

    const title = brandNames[0] || canonicalGenericName;
    const doc: KnowledgeDocument = {
      id: `openfda-label-${slugify(canonicalGenericName)}-${index}`,
      category: 'medicament-label',
      text: [
        `${title}:`,
        '- Source: openFDA Drug Label',
        '- Langue source: en',
        genericNames.length > 0 ? `- DCI/generic names: ${genericNames.join('; ')}` : '',
        substanceNames.length > 0 ? `- Substances: ${substanceNames.join('; ')}` : '',
        manufacturerNames.length > 0 ? `- Fabricants: ${manufacturerNames.join('; ')}` : '',
        routes.length > 0 ? `- Voies: ${routes.join('; ')}` : '',
        effectiveTime ? `- Date label: ${effectiveTime}` : '',
        indications ? `- Indications: ${indications}` : '',
        warnings ? `- Warnings: ${warnings}` : '',
        adverseReactions ? `- Effets indesirables: ${adverseReactions}` : '',
        dosage ? `- Posologie label/source: ${dosage}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };

    candidates.push({
      agent: 'medicaments',
      doc,
      priority: 8,
    });

    const specializedScores = inferAgentScores(title, [], `${indications} ${warnings} ${adverseReactions}`);
    (Object.entries(specializedScores) as Array<[AgentName, number]>).forEach(([agent, score]) => {
      if (agent === 'medecin_generaliste' || agent === 'medicaments') {
        return;
      }

      if (score > 0) {
        candidates.push({
          agent,
          doc,
          priority: score,
        });
      }
    });
  });

  emitCandidates(store, seenIds, candidates, config.agentCaps);
}

function toConstName(agent: AgentName): string {
  const base = agent
    .split('_')
    .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join('');

  return `${base}Knowledge`;
}

function renderGeneratedFile(
  store: Record<AgentName, KnowledgeDocument[]>,
  sourceIds: Set<string>,
  profile: string,
  languagePolicy: string
): string {
  const generationDate = new Date().toISOString();
  const enabledSources = Array.from(sourceIds)
    .map((sourceId) => allSources.find((source) => source.id === sourceId))
    .filter(Boolean)
    .map((source) => `- ${source?.id}: ${source?.url}`)
    .join('\n');

  const sections = AGENTS.map((agent) => {
    const constName = toConstName(agent);
    return `export const ${constName}: KnowledgeDocument[] = ${JSON.stringify(store[agent], null, 2)};\n`;
  }).join('\n');

  const byAgentLines = AGENTS.map((agent) => `  ${agent}: ${toConstName(agent)},`).join('\n');
  const byNamespaceLines = AGENTS.map(
    (agent) => `  '${NAMESPACE_BY_AGENT[agent]}': ${toConstName(agent)},`
  ).join('\n');

  return `/**
 * AUTO-GENERATED FILE.
 * Source generation date: ${generationDate}
 * Generation profile: ${profile}
 * Language policy: ${languagePolicy}
 *
 * Sources:
${enabledSources}
 */

export interface KnowledgeDocument {
  id: string;
  text: string;
  category: string;
}

${sections}
export const knowledgeByAgent: Record<string, KnowledgeDocument[]> = {
${byAgentLines}
};

export const knowledgeByNamespace: Record<string, KnowledgeDocument[]> = {
${byNamespaceLines}
};
`;
}

async function ensureParentDirectory(outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
}

function printCounts(store: Record<AgentName, KnowledgeDocument[]>): void {
  console.log('\nGenerated knowledge counts:\n');
  AGENTS.forEach((agent) => {
    console.log(`- ${agent}: ${store[agent].length}`);
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const config = PROFILE_CONFIG[options.profile];
  const store = createEmptyKnowledgeStore();
  const seenIds = createSeenIdsStore();
  const skippedSources: string[] = [];

  console.log(`Generating health knowledge with profile '${options.profile}'...`);
  console.log(`Sources: ${Array.from(options.sourceIds).join(', ')}`);
  console.log(`Language policy: ${options.languagePolicy}`);

  const canUseSource = (sourceId: string): boolean => {
    if (options.languagePolicy === 'allow-en-fallback') {
      return true;
    }

    const allowed = isFrenchCapableSource(sourceId);
    if (!allowed) {
      skippedSources.push(sourceId);
    }
    return allowed;
  };

  const shouldIngestAmeli =
    (options.sourceIds.has('ameli-health-topics') && canUseSource('ameli-health-topics')) ||
    (options.sourceIds.has('ameli-anatomie-fallback') && canUseSource('ameli-anatomie-fallback'));

  if (shouldIngestAmeli) {
    console.log('Ingesting ameli health topics...');
    await ingestAmeliTopics(store, seenIds, config);
  }

  if (options.sourceIds.has('manger-bouger') && canUseSource('manger-bouger')) {
    console.log('Ingesting Manger Bouger pages...');
    await ingestMangerBouger(store, seenIds, config);
  }

  if (options.sourceIds.has('sante-mentale-info-service') && canUseSource('sante-mentale-info-service')) {
    console.log('Ingesting Sante mentale info service pages...');
    await ingestSanteMentaleInfoService(store, seenIds, config);
  }

  if (options.sourceIds.has('vaccination-info-service') && canUseSource('vaccination-info-service')) {
    console.log('Ingesting Vaccination Info Service pages...');
    await ingestVaccinationInfoService(store, seenIds, config);
  }

  if (options.sourceIds.has('sante-publique-france') && canUseSource('sante-publique-france')) {
    console.log('Ingesting Sante publique France pages...');
    await ingestSantePubliqueFrance(store, seenIds, config);
  }

  // TODO(corevia-health-ingestion): Re-enable these fallback English ingesters when
  // the source policy expands beyond FR-only and their IDs are reintroduced in
  // SUPPORTED_SOURCE_IDS / DEFAULT_SOURCE_IDS.
  if (options.sourceIds.has('medlineplus-xml') && canUseSource('medlineplus-xml')) {
    console.log('Ingesting MedlinePlus topics and definitions...');
    await ingestMedlinePlusTopics(store, seenIds, config);
    await ingestMedlinePlusDefinitions(store, seenIds, config);
  }

  if (options.sourceIds.has('medlineplus-genetics') && canUseSource('medlineplus-genetics')) {
    console.log('Ingesting MedlinePlus genetics summaries...');
    await ingestMedlinePlusGenetics(store, seenIds, config);
  }

  if (options.sourceIds.has('openfda-drug-label') && canUseSource('openfda-drug-label')) {
    console.log('Ingesting openFDA drug labels...');
    await ingestOpenFdaDrugLabels(store, seenIds, config);
  }

  if (options.sourceIds.has('bdpm') && canUseSource('bdpm')) {
    console.log('Ingesting BDPM drug registry...');
    await ingestBdpm(store, seenIds, config);
  }

  const renderedFile = renderGeneratedFile(store, options.sourceIds, options.profile, options.languagePolicy);
  await ensureParentDirectory(options.outputPath);
  await writeFile(options.outputPath, renderedFile, 'utf8');

  printCounts(store);
  if (skippedSources.length > 0) {
    console.log('\nSkipped non-French sources:\n');
    uniqueStrings(skippedSources).forEach((sourceId) => {
      const source = getSourceById(sourceId);
      console.log(`- ${source.id} (${source.languages.join(', ')}) -> ${source.url}`);
    });
  }
  console.log(`\nGenerated file written to ${options.outputPath}`);
}

main().catch((error) => {
  console.error('Health knowledge generation failed:', error);
  process.exitCode = 1;
});
