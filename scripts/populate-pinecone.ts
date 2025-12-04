/**
 * Script to populate Pinecone with medical knowledge
 *
 * Usage: npm run populate-pinecone
 * Add to package.json: "populate-pinecone": "ts-node scripts/populate-pinecone.ts"
 */

import 'reflect-metadata';
import { validateEnv } from '../src/config/env';
import { PineconeService } from '../src/services/pinecone.service';
import { LLMService } from '../src/services/llm.service';
import { logger } from '../src/utils/logger';

// Sample medical knowledge base
const medicalKnowledge = [
  {
    id: 'headache-001',
    text: `Les maux de tête (céphalées) sont très fréquents. Les causes communes incluent :
    - Tension musculaire (céphalée de tension)
    - Migraines
    - Déshydratation
    - Manque de sommeil
    - Stress

    Conseils généraux :
    - Repos dans un endroit calme et sombre
    - Hydratation
    - Application de compresse froide ou chaude
    - Gestion du stress

    Consulter un médecin si :
    - Maux de tête soudains et intenses ("pire mal de tête de votre vie")
    - Maux de tête accompagnés de fièvre, raideur de nuque
    - Changements visuels ou troubles neurologiques
    - Maux de tête persistants ou qui s'aggravent`,
    category: 'symptomes',
  },
  {
    id: 'fever-001',
    text: `La fièvre est une élévation de la température corporelle au-dessus de 38°C.

    Causes fréquentes :
    - Infections virales (grippe, rhume)
    - Infections bactériennes
    - Inflammation

    Mesures de confort :
    - Repos
    - Hydratation importante (eau, bouillons)
    - Vêtements légers
    - Température ambiante fraîche

    Consulter un médecin si :
    - Fièvre > 39.5°C persistante
    - Fièvre chez nourrisson < 3 mois
    - Difficultés respiratoires
    - Confusion ou somnolence excessive
    - Éruption cutanée
    - Fièvre durant plus de 3 jours`,
    category: 'symptomes',
  },
  {
    id: 'cold-001',
    text: `Le rhume est une infection virale des voies respiratoires supérieures.

    Symptômes typiques :
    - Écoulement nasal
    - Éternuements
    - Mal de gorge léger
    - Toux légère
    - Fatigue

    Traitement :
    - Repos
    - Hydratation (eau, tisanes, bouillons)
    - Lavages de nez au sérum physiologique
    - Humidificateur d'air
    - Miel pour la toux (adultes et enfants > 1 an)

    Le rhume guérit généralement en 7-10 jours sans traitement spécifique.

    Consulter si :
    - Symptômes durant plus de 10 jours
    - Fièvre élevée persistante
    - Difficultés respiratoires
    - Douleur thoracique`,
    category: 'maladies-courantes',
  },
  {
    id: 'stomach-pain-001',
    text: `Les douleurs abdominales peuvent avoir de nombreuses causes.

    Causes fréquentes bénignes :
    - Indigestion
    - Gaz intestinaux
    - Constipation
    - Gastro-entérite virale
    - Crampes menstruelles

    Mesures de confort :
    - Régime léger (riz, bananes, compote)
    - Hydratation
    - Bouillotte chaude sur le ventre
    - Repos

    URGENCE - Appelez le 15 si :
    - Douleur abdominale intense et soudaine
    - Abdomen dur et tendu
    - Vomissements de sang
    - Selles noires ou sanglantes
    - Fièvre élevée avec douleur abdominale
    - Douleur qui ne s'améliore pas`,
    category: 'symptomes',
  },
  {
    id: 'back-pain-001',
    text: `Le mal de dos (dorsalgie, lombalgie) est très courant.

    Causes fréquentes :
    - Tension musculaire
    - Mauvaise posture
    - Effort physique
    - Sédentarité
    - Stress

    Conseils :
    - Rester actif (repos prolongé déconseillé)
    - Exercices d'étirement doux
    - Application de chaud ou froid
    - Amélioration de la posture
    - Activité physique régulière

    Consulter un médecin si :
    - Douleur après chute ou traumatisme
    - Douleur irradiant dans les jambes
    - Faiblesse, engourdissement des membres
    - Perte de contrôle vésical ou intestinal
    - Fièvre avec mal de dos
    - Douleur persistante > 4-6 semaines`,
    category: 'symptomes',
  },
  {
    id: 'insomnia-001',
    text: `L'insomnie est une difficulté à s'endormir ou à rester endormi.

    Conseils d'hygiène du sommeil :
    - Horaires réguliers de coucher et lever
    - Éviter écrans 1h avant le coucher
    - Chambre fraîche, sombre et calme
    - Éviter caféine après 16h
    - Éviter alcool le soir
    - Activité physique régulière (pas le soir)
    - Relaxation (méditation, respiration)
    - Éviter siestes longues dans la journée

    Consulter si :
    - Insomnie chronique (> 3 mois)
    - Impact important sur la vie quotidienne
    - Somnolence diurne excessive
    - Suspicion d'apnée du sommeil (ronflements, pauses respiratoires)`,
    category: 'troubles-sommeil',
  },
  {
    id: 'anxiety-001',
    text: `L'anxiété est une réaction normale au stress, mais peut devenir problématique.

    Symptômes courants :
    - Inquiétude excessive
    - Tension musculaire
    - Difficultés de concentration
    - Troubles du sommeil
    - Symptômes physiques (palpitations, transpiration)

    Stratégies de gestion :
    - Techniques de respiration profonde
    - Méditation et pleine conscience
    - Activité physique régulière
    - Sommeil suffisant
    - Réduction de la caféine
    - Soutien social

    Consulter un professionnel si :
    - Anxiété interfère avec la vie quotidienne
    - Attaques de panique
    - Évitement de situations
    - Symptômes persistants malgré les efforts

    En urgence (pensées suicidaires) : 15 ou 112`,
    category: 'sante-mentale',
  },
  {
    id: 'dehydration-001',
    text: `La déshydratation survient quand le corps perd plus de liquides qu'il n'en absorbe.

    Signes de déshydratation :
    - Soif intense
    - Bouche sèche
    - Urine foncée et peu abondante
    - Fatigue
    - Étourdissements
    - Peau sèche

    Prévention et traitement :
    - Boire régulièrement (1.5-2L par jour)
    - Augmenter les apports en cas de chaleur, exercice, maladie
    - Solutions de réhydratation orale si gastro-entérite
    - Aliments riches en eau (fruits, légumes)

    Urgence médicale si :
    - Déshydratation sévère (confusion, très peu d'urine)
    - Impossibilité de boire
    - Chez nourrisson ou personne âgée
    - Vomissements ou diarrhée persistants`,
    category: 'prevention',
  },
];

async function main() {
  try {
    logger.info('🚀 Starting Pinecone population script...');

    // Validate environment
    validateEnv();

    // Initialize services
    const llmService = new LLMService();
    const pineconeService = new PineconeService();

    logger.info(`📚 Processing ${medicalKnowledge.length} medical documents...`);

    // Generate embeddings and prepare vectors
    const vectors = [];

    for (const doc of medicalKnowledge) {
      logger.info(`Generating embedding for: ${doc.id}`);

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

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Upsert to Pinecone with namespace
    const namespace = 'medecin-generaliste';
    logger.info(`📤 Upserting vectors to Pinecone namespace '${namespace}'...`);
    await pineconeService.upsertVectors(vectors, namespace);

    logger.info('✅ Successfully populated Pinecone with medical knowledge!');
    logger.info(`📊 Total documents: ${vectors.length}`);
    logger.info(`🏷️  Namespace: ${namespace}`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error populating Pinecone:', error);
    process.exit(1);
  }
}

main();
