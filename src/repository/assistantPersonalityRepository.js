import { connectToDb } from '../config/database/mongo.js';
import logger from '../utils/logger.js';

/**
 * Repositório para persistir a personalidade evolutiva do assistente
 */

const PERSONALITY_COLLECTION = 'assistant_personality';
const EVOLUTION_LOG_COLLECTION = 'personality_evolution_log';

/**
 * Obtém a personalidade do assistente
 * @param {string} assistantId - ID do assistente
 * @returns {Object|null} - Dados da personalidade ou null
 */
export async function getAssistantPersonality(assistantId = 'default') {
  try {
    logger.debug('AssistantPersonalityRepository', `Buscando personalidade para assistente: ${assistantId}`);
    
    const db = await connectToDb();
    const personalityData = await db.collection(PERSONALITY_COLLECTION).findOne({ assistant_id: assistantId });
    
    if (personalityData) {
      logger.debug('AssistantPersonalityRepository', 'Personalidade encontrada', {
        assistantId,
        mood: personalityData.current_mood,
        lastUpdated: personalityData.last_updated
      });
      
      return personalityData;
    }
    
    logger.debug('AssistantPersonalityRepository', `Nenhuma personalidade encontrada para ${assistantId}`);
    return null;
    
  } catch (error) {
    logger.error('AssistantPersonalityRepository', `Erro ao buscar personalidade: ${error.message}`, {
      assistantId,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Atualiza ou cria a personalidade do assistente
 * @param {string} assistantId - ID do assistente
 * @param {Object} personalityData - Dados da personalidade
 */
export async function updateAssistantPersonality(assistantId, personalityData) {
  try {
    logger.debug('AssistantPersonalityRepository', `Atualizando personalidade para assistente: ${assistantId}`);
    
    const db = await connectToDb();
    const now = new Date().toISOString();
    
    const updateData = {
      assistant_id: assistantId,
      emotional_dimensions: personalityData.emotional_dimensions || {},
      personality_traits: personalityData.personality_traits || {},
      emotional_memory: personalityData.emotional_memory || [],
      current_mood: personalityData.current_mood || 'balanced',
      evolutionary_traits: personalityData.evolutionary_traits || {},
      evolution_metrics: personalityData.evolution_metrics || {},
      last_updated: personalityData.last_updated || now,
      created_at: personalityData.created_at || now
    };
    
    const result = await db.collection(PERSONALITY_COLLECTION).updateOne(
      { assistant_id: assistantId },
      { $set: updateData },
      { upsert: true }
    );
    
    logger.debug('AssistantPersonalityRepository', 'Personalidade atualizada com sucesso', {
      assistantId,
      mood: personalityData.current_mood,
      upserted: result.upsertedCount > 0,
      modified: result.modifiedCount > 0
    });
    
    return result;
    
  } catch (error) {
    logger.error('AssistantPersonalityRepository', `Erro ao atualizar personalidade: ${error.message}`, {
      assistantId,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Obtém histórico de evolução da personalidade
 * @param {string} assistantId - ID do assistente
 * @param {number} limit - Limite de registros
 */
export async function getPersonalityEvolutionHistory(assistantId = 'default', limit = 10) {
  try {
    logger.debug('AssistantPersonalityRepository', `Buscando histórico de evolução: ${assistantId}`);
    
    const db = await connectToDb();
    const history = await db.collection(EVOLUTION_LOG_COLLECTION)
      .find({ assistant_id: assistantId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    logger.debug('AssistantPersonalityRepository', `${history.length} registros de evolução encontrados`);
    
    return history;
    
  } catch (error) {
    logger.error('AssistantPersonalityRepository', `Erro ao buscar histórico: ${error.message}`);
    return [];
  }
}

/**
 * Registra um evento de evolução da personalidade
 * @param {string} assistantId - ID do assistente
 * @param {Object} evolutionData - Dados do evento de evolução
 */
export async function logPersonalityEvolution(assistantId, evolutionData) {
  try {
    logger.debug('AssistantPersonalityRepository', `Registrando evolução da personalidade: ${assistantId}`);
    
    const db = await connectToDb();
    const evolutionEntry = {
      assistant_id: assistantId,
      evolution_type: evolutionData.evolution_type || 'interaction',
      trigger_event: evolutionData.trigger_event || '',
      emotional_impact: evolutionData.emotional_impact || {},
      personality_changes: evolutionData.personality_changes || {},
      user_context: evolutionData.user_context || {},
      timestamp: new Date().toISOString()
    };
    
    const result = await db.collection(EVOLUTION_LOG_COLLECTION).insertOne(evolutionEntry);
    
    logger.debug('AssistantPersonalityRepository', 'Evolução registrada', {
      evolutionId: result.insertedId,
      assistantId
    });
    
    return result.insertedId;
    
  } catch (error) {
    logger.error('AssistantPersonalityRepository', `Erro ao registrar evolução: ${error.message}`);
    // Não propagar erro para não quebrar o fluxo principal
    return null;
  }
}

/**
 * Obtém estatísticas da personalidade do assistente
 * @param {string} assistantId - ID do assistente
 */
export async function getPersonalityStats(assistantId = 'default') {
  try {
    logger.debug('AssistantPersonalityRepository', `Obtendo estatísticas: ${assistantId}`);
    
    const db = await connectToDb();
    
    // Estatísticas básicas
    const basicStats = await db.collection(PERSONALITY_COLLECTION).findOne({ assistant_id: assistantId });
    
    // Evolução ao longo do tempo (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const evolutionStats = await db.collection(EVOLUTION_LOG_COLLECTION).aggregate([
      { 
        $match: { 
          assistant_id: assistantId, 
          timestamp: { $gte: thirtyDaysAgo.toISOString() } 
        } 
      },
      {
        $group: {
          _id: {
            evolution_type: "$evolution_type",
            date: { $substr: ["$timestamp", 0, 10] }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": -1 }
      }
    ]).toArray();
    
    // Contadores gerais
    const totalEvolutions = await db.collection(EVOLUTION_LOG_COLLECTION).countDocuments({ assistant_id: assistantId });
    
    const activeDays = await db.collection(EVOLUTION_LOG_COLLECTION).aggregate([
      { $match: { assistant_id: assistantId } },
      {
        $group: {
          _id: { $substr: ["$timestamp", 0, 10] }
        }
      },
      { $count: "total" }
    ]).toArray();
    
    const uniqueUsers = await db.collection(EVOLUTION_LOG_COLLECTION).aggregate([
      { $match: { assistant_id: assistantId } },
      {
        $group: {
          _id: "$user_context.userId"
        }
      },
      { $count: "total" }
    ]).toArray();

    const stats = {
      basic: basicStats ? {
        assistant_id: basicStats.assistant_id,
        current_mood: basicStats.current_mood,
        last_updated: basicStats.last_updated,
        created_at: basicStats.created_at,
        days_active: basicStats.created_at ? Math.floor((new Date() - new Date(basicStats.created_at)) / (1000 * 60 * 60 * 24)) : 0
      } : null,
      evolution_by_type: evolutionStats,
      counters: {
        total_evolutions: totalEvolutions,
        active_days: activeDays[0]?.total || 0,
        unique_users: uniqueUsers[0]?.total || 0
      },
      generated_at: new Date().toISOString()
    };
    
    logger.debug('AssistantPersonalityRepository', 'Estatísticas geradas', {
      assistantId,
      totalEvolutions: stats.counters.total_evolutions
    });
    
    return stats;
    
  } catch (error) {
    logger.error('AssistantPersonalityRepository', `Erro ao obter estatísticas: ${error.message}`);
    return null;
  }
}

/**
 * Limpa dados antigos de evolução (manutenção)
 * @param {number} daysToKeep - Dias para manter os dados
 */
export async function cleanupOldEvolutionData(daysToKeep = 90) {
  try {
    logger.info('AssistantPersonalityRepository', `Limpando dados de evolução mais antigos que ${daysToKeep} dias`);
    
    const db = await connectToDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db.collection(EVOLUTION_LOG_COLLECTION).deleteMany({
      timestamp: { $lt: cutoffDate.toISOString() }
    });
    
    logger.info('AssistantPersonalityRepository', 'Limpeza concluída', {
      deletedCount: result.deletedCount,
      daysToKeep
    });
    
    return result.deletedCount;
    
  } catch (error) {
    logger.error('AssistantPersonalityRepository', `Erro na limpeza: ${error.message}`);
    throw error;
  }
}

/**
 * Inicializa as coleções necessárias (caso não existam) - Para MongoDB não é necessário
 * criar estrutura prévia, mas podemos criar índices para otimização
 */
export async function initializePersonalityTables() {
  try {
    logger.info('AssistantPersonalityRepository', 'Inicializando coleções de personalidade');
    
    const db = await connectToDb();
    
    // Criar índices para otimização
    await db.collection(PERSONALITY_COLLECTION).createIndex({ assistant_id: 1 }, { unique: true });
    await db.collection(PERSONALITY_COLLECTION).createIndex({ current_mood: 1 });
    await db.collection(PERSONALITY_COLLECTION).createIndex({ last_updated: 1 });
    
    await db.collection(EVOLUTION_LOG_COLLECTION).createIndex({ assistant_id: 1, timestamp: -1 });
    await db.collection(EVOLUTION_LOG_COLLECTION).createIndex({ evolution_type: 1 });
    await db.collection(EVOLUTION_LOG_COLLECTION).createIndex({ timestamp: -1 });
    
    logger.info('AssistantPersonalityRepository', 'Coleções de personalidade inicializadas com sucesso');
    
  } catch (error) {
    logger.error('AssistantPersonalityRepository', `Erro ao inicializar coleções: ${error.message}`);
    throw error;
  }
}
