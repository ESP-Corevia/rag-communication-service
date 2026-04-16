/**
 * Script pour peupler TOUS les agents avec leurs connaissances médicales
 * Usage: npm run populate-all
 */

import 'reflect-metadata';
import { validateEnv } from '../src/config/env';
import { PineconeService } from '../src/services/pinecone.service';
import { LLMService } from '../src/services/llm.service';
import { logger } from '../src/utils/logger';

// ========================
// MÉDECIN GÉNÉRALISTE
// ========================
const medecinGeneralisteKnowledge = [
  {
    id: 'headache-001',
    text: `Maux de tête (céphalées):
- Tension musculaire, migraines, déshydratation, manque de sommeil, stress
- Repos dans endroit calme, hydratation, compresse froide/chaude
- URGENCE: maux de tête soudains intenses, avec fièvre/raideur nuque, troubles visuels`,
    category: 'symptomes',
  },
  {
    id: 'fever-001',
    text: `Fièvre (>38°C):
- Causes: infections virales/bactériennes, inflammation
- Repos, hydratation++, vêtements légers
- URGENCE: >39.5°C persistante, nourrisson <3 mois, difficultés respiratoires, confusion`,
    category: 'symptomes',
  },
  {
    id: 'cold-001',
    text: `Rhume (infection virale):
- Écoulement nasal, éternuements, mal de gorge léger, toux, fatigue
- Repos, hydratation, lavages nez sérum physiologique, miel pour toux
- Guérison: 7-10 jours. Consulter si >10 jours, fièvre persistante`,
    category: 'maladies-courantes',
  },
  {
    id: 'stomach-pain-001',
    text: `Douleurs abdominales:
- Causes bénignes: indigestion, gaz, constipation, gastro, crampes menstruelles
- Régime léger, hydratation, bouillotte chaude, repos
- URGENCE: douleur intense soudaine, abdomen dur, vomissements sang, selles sanglantes`,
    category: 'symptomes',
  },
  {
    id: 'back-pain-001',
    text: `Mal de dos:
- Tension musculaire, mauvaise posture, effort physique, sédentarité
- Rester actif, étirements doux, chaud/froid, améliorer posture
- Consulter: après traumatisme, douleur jambes, faiblesse membres, perte contrôle vésical`,
    category: 'symptomes',
  },
  {
    id: 'insomnia-001',
    text: `Insomnie:
- Horaires réguliers, éviter écrans 1h avant coucher, chambre fraîche/sombre
- Éviter caféine après 16h, activité physique (pas le soir), relaxation
- Consulter: insomnie >3 mois, impact vie quotidienne, somnolence diurne`,
    category: 'troubles-sommeil',
  },
  {
    id: 'anxiety-001',
    text: `Anxiété:
- Inquiétude excessive, tension musculaire, difficultés concentration, troubles sommeil
- Respiration profonde, méditation, activité physique, réduire caféine
- Consulter: interfère vie quotidienne, attaques panique. URGENCE: pensées suicidaires → 15`,
    category: 'sante-mentale',
  },
  {
    id: 'dehydration-001',
    text: `Déshydratation:
- Signes: soif, bouche sèche, urine foncée, fatigue, étourdissements
- Boire 1.5-2L/jour, augmenter si chaleur/exercice
- URGENCE: confusion, impossibilité boire, nourrisson/âgé, vomissements persistants`,
    category: 'prevention',
  },
  {
    id: 'flu-001',
    text: `Grippe (influenza):
- Fièvre soudaine, courbatures, fatigue intense, toux sèche, maux tête
- Repos++, hydratation, paracétamol pour fièvre/douleurs
- Consulter: difficultés respiratoires, douleur thoracique, confusion, déshydratation`,
    category: 'maladies-courantes',
  },
  {
    id: 'allergies-001',
    text: `Allergies saisonnières:
- Éternuements, nez qui coule/bouché, yeux qui piquent, gorge irritée
- Éviter allergènes, laver cheveux le soir, fermer fenêtres, antihistaminiques
- URGENCE: difficultés respirer, gonflement visage/gorge → choc anaphylactique → 15`,
    category: 'maladies-courantes',
  },
];

// ========================
// CARDIOLOGUE
// ========================
const cardiologueKnowledge = [
  {
    id: 'hypertension-001',
    text: `Hypertension artérielle (HTA):
- Normal: <120/80. HTA Grade 1: 140-159/90-99. HTA Grade 2: ≥160/100
- Facteurs: âge, surpoids, sel++, sédentarité, stress, tabac, alcool
- Complications: AVC, infarctus, insuffisance rénale
- Prévention: activité physique, alimentation peu salée, poids santé, arrêt tabac`,
    category: 'pathologies-cardio',
  },
  {
    id: 'cholesterol-001',
    text: `Cholestérol:
- LDL (mauvais): dépôts artères. HDL (bon): nettoie artères
- Cibles LDL: <1.6g/L (bas risque) à <0.7g/L (haut risque)
- Causes: graisses saturées++, surpoids, sédentarité, tabac, génétique
- Prévention: fruits, légumes, fibres, oméga-3, activité physique, arrêt tabac`,
    category: 'pathologies-cardio',
  },
  {
    id: 'arythmie-001',
    text: `Arythmies cardiaques:
- Types: fibrillation auriculaire (FA), tachycardie (>100bpm), bradycardie (<60bpm)
- Symptômes: palpitations, essoufflement, fatigue, étourdissements
- URGENCE: palpitations + douleur thoracique/malaise/perte conscience → 15
- Prise en charge: ECG, Holter, médicaments/ablation/pacemaker selon type`,
    category: 'pathologies-cardio',
  },
  {
    id: 'infarctus-001',
    text: `Infarctus du myocarde (crise cardiaque):
- Symptômes: douleur thoracique intense/oppression, irradiation bras gauche/mâchoire/dos, sueurs, nausées, essoufflement
- URGENCE ABSOLUE → 15 immédiatement
- Facteurs risque: tabac, HTA, diabète, cholestérol, obésité, sédentarité, stress, hérédité
- Prévention: mode de vie sain, contrôle facteurs risque, aspirine si haut risque`,
    category: 'urgences-cardio',
  },
  {
    id: 'insuffisance-cardiaque-001',
    text: `Insuffisance cardiaque:
- Cœur pompe mal le sang. Causes: infarctus, HTA, valvulopathies
- Symptômes: essoufflement effort/repos, fatigue, œdèmes chevilles/jambes, prise poids rapide
- Traitement: médicaments, régime pauvre en sel, activité physique adaptée
- Consulter: essoufflement nouveau/aggravé, œdèmes, prise poids >2kg/semaine`,
    category: 'pathologies-cardio',
  },
  {
    id: 'avc-prevention-001',
    text: `Prévention AVC (accident vasculaire cérébral):
- Facteurs risque: HTA, FA, diabète, cholestérol, tabac, obésité, sédentarité
- Symptômes AVC: paralysie faciale, faiblesse bras, trouble parole, vertige, maux tête sévère
- URGENCE AVC → 15 immédiatement. Chaque minute compte!
- Prévention: contrôle HTA, traitement FA, activité physique, alimentation saine, arrêt tabac`,
    category: 'prevention-cardio',
  },
  {
    id: 'angine-poitrine-001',
    text: `Angine de poitrine (angor):
- Douleur thoracique effort due manque oxygène cœur. Artères coronaires rétrécies
- Symptômes: oppression/serrement poitrine effort, soulagement repos
- Angine instable (douleur repos/aggravation) → URGENCE → 15
- Traitement: médicaments vasodilatateurs, contrôle facteurs risque, parfois angioplastie/pontage`,
    category: 'pathologies-cardio',
  },
  {
    id: 'palpitations-001',
    text: `Palpitations cardiaques:
- Sensation battements cœur rapides/irréguliers/forts
- Causes bénignes: stress, caféine, alcool, tabac, manque sommeil
- Causes cardiaques: arythmies, troubles valvulaires
- Consulter: palpitations fréquentes/prolongées. URGENCE: avec douleur thoracique/malaise/essoufflement`,
    category: 'symptomes-cardio',
  },
];

// ========================
// DERMATOLOGUE
// ========================
const dermatologueKnowledge = [
  {
    id: 'acne-001',
    text: `Acné:
- Sébum++ → pores bouchés → inflammation. Hormones, stress, alimentation, cosmétiques
- Types: points noirs, boutons rouges, kystes
- Soins: nettoyage doux 2x/jour, éviter percer boutons, crèmes adaptées non comédogènes
- Consulter: acné sévère/kystique, cicatrices, échec automédication`,
    category: 'pathologies-peau',
  },
  {
    id: 'eczema-001',
    text: `Eczéma (dermatite atopique):
- Peau sèche, plaques rouges, démangeaisons intenses, croûtes
- Facteurs: génétique, peau sèche, allergènes, stress
- Soins: hydratation++, crèmes émollientes, éviter irritants (savons durs, laine), ongles courts
- Consulter: poussées fréquentes, surintection, échec traitement`,
    category: 'pathologies-peau',
  },
  {
    id: 'psoriasis-001',
    text: `Psoriasis:
- Plaques rouges épaisses recouvertes squames blanches. Maladie auto-immune chronique
- Zones: coudes, genoux, cuir chevelu, bas du dos
- Facteurs déclenchants: stress, infections, médicaments, alcool, tabac
- Traitement: crèmes, photothérapie, traitements systémiques selon sévérité`,
    category: 'pathologies-peau',
  },
  {
    id: 'melanome-001',
    text: `Mélanome (cancer peau):
- Grain de beauté suspect: Asymétrie, Bords irréguliers, Couleur non homogène, Diamètre >6mm, Évolution
- URGENCE: grain beauté change forme/couleur/taille, saignement, démangeaisons → dermatologue rapidement
- Prévention: protection solaire (SPF50+), éviter UV 12h-16h, surveiller grains beauté, consultation annuelle si risque`,
    category: 'cancers-peau',
  },
  {
    id: 'urticaire-001',
    text: `Urticaire:
- Plaques rouges en relief, démangeaisons intenses, apparition/disparition rapide
- Causes: allergie (aliments, médicaments), stress, froid, chaleur, pression
- Traitement: antihistaminiques, éviter déclencheur, compresses froides
- URGENCE: urticaire + gonflement visage/gorge/difficultés respirer → choc anaphylactique → 15`,
    category: 'allergies-peau',
  },
  {
    id: 'mycoses-001',
    text: `Mycoses cutanées:
- Infection champignons. Peau rouge, desquamation, démangeaisons, fissures
- Zones: plis (aisselles, aine), pieds (pied d'athlète), ongles
- Facteurs: humidité, chaleur, macération, défenses immunitaires basses
- Traitement: antifongiques locaux/oraux, hygiène++, sécher bien plis, chaussures respirantes`,
    category: 'infections-peau',
  },
  {
    id: 'verrues-001',
    text: `Verrues:
- Infection virus HPV. Excroissances peau rugueuses
- Types: verrues plantaires (pieds), vulgaires (mains), planes (visage)
- Contagieux par contact. Éviter gratter/toucher
- Traitement: acide salicylique, cryothérapie (azote liquide), parfois laser. Peuvent disparaître seules`,
    category: 'infections-peau',
  },
  {
    id: 'rosacee-001',
    text: `Rosacée:
- Rougeurs visage (joues, nez, front), vaisseaux apparents, boutons
- Facteurs déclenchants: soleil, chaleur, alcool, épices, stress, cosmétiques
- Éviter: eau chaude, gommages, alcool, aliments épicés
- Traitement: crèmes métronidazole, laser vasculaire selon sévérité`,
    category: 'pathologies-peau',
  },
];

// ========================
// PSYCHOLOGUE
// ========================
const psychologueKnowledge = [
  {
    id: 'stress-001',
    text: `Stress:
- Le stress est une réponse normale du corps. Il peut devenir problématique s'il est constant.
- Signes fréquents: irritabilité, fatigue, troubles du sommeil, ruminations, tensions musculaires.
- Stratégies: respiration lente (4-6 cycles/min), pauses, activité physique légère, limiter caféine/alcool, routine de sommeil.
- Consulter: si le stress impacte la vie quotidienne ou s'accompagne de crises de panique.`,
    category: 'stress',
  },
  {
    id: 'anxiety-psy-001',
    text: `Anxiété:
- Pensées inquiétantes persistantes, tension, difficulté à se détendre, symptômes physiques (palpitations, souffle court).
- Techniques: ancrage (5-4-3-2-1), respiration diaphragmatique, écrire les pensées, exposition progressive.
- Consulter: si l'anxiété est fréquente, intense, ou entraîne évitements importants.`,
    category: 'anxiete',
  },
  {
    id: 'depression-001',
    text: `Humeur dépressive:
- Signes: tristesse, perte d'intérêt, fatigue, troubles sommeil/appétit, difficulté concentration.
- Aide: routine minimale, contacts sociaux, activités plaisantes simples, demander du soutien, consulter un professionnel.
- Urgence: idées suicidaires, désespoir extrême, danger immédiat → 15 / 112.`,
    category: 'depression',
  },
  {
    id: 'panic-001',
    text: `Crise de panique:
- Pic de peur intense avec symptômes physiques (cœur qui bat, tremblements, souffle court), souvent transitoire.
- Aide immédiate: ralentir la respiration, se rappeler que la crise passe, se concentrer sur l'expiration, s'asseoir.
- Consulter: crises répétées, peur d'en refaire, évitements.`,
    category: 'panique',
  },
  {
    id: 'sleep-psy-001',
    text: `Sommeil:
- Hygiène du sommeil: horaires réguliers, limiter écrans le soir, éviter caféine tard, chambre fraîche et sombre.
- Si ruminations: noter les pensées, relaxation, respiration, routine apaisante.
- Consulter: insomnie chronique (>3 mois) ou forte somnolence diurne.`,
    category: 'sommeil',
  },
];

// ========================
// PÉDIATRE
// ========================
const pediatreKnowledge = [
  {
    id: 'fievre-enfant-001',
    text: `Fièvre chez enfant:
- Normal: 36-37.5°C. Fièvre: >38°C (rectal). >38.5°C (buccal/axillaire)
- URGENCE nourrisson <3 mois avec fièvre → pédiatre/urgences immédiatement
- Signes gravité: léthargie, refus boire, pleurs inconsolables, difficultés respirer, convulsions, éruption
- Traitement: paracétamol (15mg/kg/6h), hydratation++, vêtements légers, surveiller`,
    category: 'symptomes-pediatrie',
  },
  {
    id: 'bronchiolite-001',
    text: `Bronchiolite (nourrisson):
- Infection virale voies respiratoires. Pic: hiver, <2 ans
- Symptômes: toux, sifflements, difficultés respiratoires, refus boire, fatigue
- URGENCE: difficultés respirer importantes, pause respiratoire, cyanose, refus total boire → 15
- Traitement: lavages nez++, hydratation, position semi-assise, fractionner repas`,
    category: 'maladies-pediatrie',
  },
  {
    id: 'rougeole-001',
    text: `Rougeole:
- Virus très contagieux. Prévention: vaccin ROR
- Symptômes: fièvre élevée, toux, nez qui coule, yeux rouges, éruption taches rouges (visage → corps)
- Complications: otite, pneumonie, encéphalite (rare mais grave)
- URGENCE: difficultés respirer, convulsions, léthargie importante → pédiatre urgences`,
    category: 'maladies-infectieuses-pediatrie',
  },
  {
    id: 'gastro-enfant-001',
    text: `Gastro-entérite enfant:
- Diarrhée, vomissements, douleurs abdominales, fièvre possible
- Risque: déshydratation (surtout <2 ans)
- Traitement: SRO (solutés réhydratation orale) petites quantités fréquentes, alimentation normale dès que possible
- URGENCE: refus boire, urine rare/foncée, bouche sèche, léthargie, perte poids rapide → pédiatre`,
    category: 'maladies-pediatrie',
  },
  {
    id: 'otite-enfant-001',
    text: `Otite moyenne aiguë:
- Infection oreille moyenne. Fréquent <3 ans
- Symptômes: douleur oreille, fièvre, pleurs, irritabilité, touche oreille, difficultés sommeil
- Facteurs risque: rhume, tabagisme passif, garderie, biberon couché
- Traitement: paracétamol/ibuprofène douleur. Antibiotiques selon âge/sévérité`,
    category: 'infections-pediatrie',
  },
  {
    id: 'croissance-enfant-001',
    text: `Surveillance croissance:
- Courbes croissance: poids, taille, périmètre crânien (PC)
- Alertes: cassure courbe croissance, stagnation poids, PC anormal
- Facteurs: alimentation, sommeil, activité physique, maladies chroniques, génétique
- Suivi régulier: carnet santé, consultations pédiatre, pesée/mesure systématique`,
    category: 'suivi-pediatrie',
  },
  {
    id: 'varicelle-001',
    text: `Varicelle:
- Virus très contagieux. Immunité à vie après infection
- Symptômes: fièvre légère puis éruption vésicules (tête → corps). Démangeaisons++
- Traitement: antihistaminiques démangeaisons, ongles courts, bains tièdes, éviter gratter (cicatrices)
- Complications: surinfection lésions. URGENCE: fièvre élevée persistante, difficultés respirer, léthargie`,
    category: 'maladies-infectieuses-pediatrie',
  },
];

// ========================
// NUTRITIONNISTE
// ========================
const nutritionnisteKnowledge = [
  {
    id: 'equilibre-alimentaire-001',
    text: `Équilibre alimentaire:
- 5 fruits/légumes jour, féculents complets chaque repas, protéines 1-2x/jour, produits laitiers 2-3x/jour
- Limiter: sucres rapides, graisses saturées, sel, aliments ultra-transformés
- Hydratation: 1.5-2L eau/jour
- Repas réguliers: petit-déjeuner, déjeuner, dîner + collations si besoin`,
    category: 'nutrition-generale',
  },
  {
    id: 'perte-poids-001',
    text: `Perte de poids saine:
- Déficit calorique modéré 300-500 kcal/jour. Perte 0.5-1kg/semaine
- Éviter régimes restrictifs (reprise poids, carences, frustration)
- Principes: légumes++, protéines chaque repas, féculents complets, bonnes graisses, limiter sucres/aliments transformés
- Activité physique régulière: 30min/jour minimum, musculation maintenir masse musculaire`,
    category: 'gestion-poids',
  },
  {
    id: 'diabete-nutrition-001',
    text: `Nutrition et diabète:
- Contrôler glycémie: répartir glucides, privilégier index glycémique bas, fibres++
- Aliments favorables: légumes, légumineuses, céréales complètes, fruits, protéines maigres
- Limiter: sucres rapides, boissons sucrées, aliments raffinés, graisses saturées
- Repas réguliers, portions contrôlées, activité physique post-repas`,
    category: 'pathologies-nutrition',
  },
  {
    id: 'cholesterol-nutrition-001',
    text: `Nutrition et cholestérol:
- Réduire graisses saturées: charcuterie, viandes grasses, beurre, fromages, pâtisseries
- Favoriser: oméga-3 (poissons gras), fibres solubles (avoine, légumineuses, pommes), huile olive, noix, légumes
- Éviter graisses trans (produits industriels)
- Activité physique augmente HDL (bon cholestérol)`,
    category: 'pathologies-nutrition',
  },
  {
    id: 'vegetarien-001',
    text: `Alimentation végétarienne/végétalienne:
- Protéines: légumineuses, tofu, tempeh, seitan, quinoa, noix, graines
- Fer: lentilles, épinards, graines (+ vitamine C absorption)
- Vitamine B12: complémentation OBLIGATOIRE végétalien, recommandée végétarien
- Calcium: légumes verts, amandes, graines sésame, tofu, laits végétaux enrichis
- Oméga-3: graines lin/chia, noix, huile colza`,
    category: 'regimes-specifiques',
  },
  {
    id: 'intolerance-lactose-001',
    text: `Intolérance lactose:
- Déficit lactase → difficultés digérer lactose (sucre lait)
- Symptômes: ballonnements, gaz, diarrhée, douleurs abdominales après produits laitiers
- Solutions: laits sans lactose, laits végétaux, yaourts (lactose pré-digéré), fromages affinés (peu lactose)
- Calcium: légumes verts, amandes, sardines, eaux minérales riches calcium`,
    category: 'intolerance-nutrition',
  },
  {
    id: 'sport-nutrition-001',
    text: `Nutrition et sport:
- Avant: glucides 2-3h avant (pâtes, riz, banane), hydratation
- Pendant: hydratation régulière, glucides si >1h effort
- Après: protéines + glucides 30min-2h post-effort (récupération musculaire)
- Protéines: 1.2-2g/kg poids corps sportif. Sources: viandes, poissons, œufs, légumineuses, produits laitiers`,
    category: 'nutrition-sport',
  },
  {
    id: 'troubles-alimentaires-001',
    text: `Troubles comportement alimentaire (TCA):
- Anorexie: restriction alimentaire extrême, peur prendre poids, image corporelle altérée
- Boulimie: crises alimentaires + comportements compensatoires (vomissements, sport excessif)
- Hyperphagie: crises alimentaires sans compensation
- URGENCE: perte poids rapide importante, malaises, pensées suicidaires → médecin/psy urgence
- Prise en charge: équipe pluridisciplinaire (médecin, psy, nutritionniste)`,
    category: 'troubles-nutrition',
  },
];

async function populateNamespace(
  llmService: LLMService,
  pineconeService: PineconeService,
  knowledge: any[],
  namespace: string
) {
  logger.info(`\n📚 Processing ${knowledge.length} documents for namespace '${namespace}'...`);

  const vectors = [];

  for (const doc of knowledge) {
    logger.info(`  Generating embedding for: ${doc.id}`);

    const embedding = await llmService.generateEmbedding(doc.text);

    vectors.push({
      id: doc.id,
      values: embedding,
      metadata: {
        text: doc.text,
        category: doc.category,
        createdAt: new Date().toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  logger.info(`📤 Upserting ${vectors.length} vectors to namespace '${namespace}'...`);
  await pineconeService.upsertVectors(vectors, namespace);

  logger.info(`✅ Namespace '${namespace}' populated with ${vectors.length} documents`);
}

async function main() {
  try {
    logger.info('🚀 Starting population of ALL agents...\n');

    validateEnv();

    const llmService = new LLMService();
    const pineconeService = new PineconeService();

    // Peupler tous les namespaces
    await populateNamespace(llmService, pineconeService, medecinGeneralisteKnowledge, 'medecin-generaliste');
    await populateNamespace(llmService, pineconeService, cardiologueKnowledge, 'cardiologue');
    await populateNamespace(llmService, pineconeService, dermatologueKnowledge, 'dermatologue');
    await populateNamespace(llmService, pineconeService, pediatreKnowledge, 'pediatre');
    await populateNamespace(llmService, pineconeService, nutritionnisteKnowledge, 'nutritionniste');
    await populateNamespace(llmService, pineconeService, psychologueKnowledge, 'psychologue');

    logger.info('\n✅ ALL AGENTS POPULATED SUCCESSFULLY!');
    logger.info('📊 Summary:');
    logger.info(`  - Médecin Généraliste: ${medecinGeneralisteKnowledge.length} docs`);
    logger.info(`  - Cardiologue: ${cardiologueKnowledge.length} docs`);
    logger.info(`  - Dermatologue: ${dermatologueKnowledge.length} docs`);
    logger.info(`  - Pédiatre: ${pediatreKnowledge.length} docs`);
    logger.info(`  - Nutritionniste: ${nutritionnisteKnowledge.length} docs`);
    logger.info(`  - Psychologue: ${psychologueKnowledge.length} docs`);
    logger.info(`  - TOTAL: ${medecinGeneralisteKnowledge.length + cardiologueKnowledge.length + dermatologueKnowledge.length + pediatreKnowledge.length + nutritionnisteKnowledge.length + psychologueKnowledge.length} docs\n`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error populating agents:', error);
    process.exit(1);
  }
}

main();
