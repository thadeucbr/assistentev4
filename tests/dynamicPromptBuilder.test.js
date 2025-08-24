import { describe, it, expect } from '@jest/globals';
import DynamicPromptBuilder from '../src/core/prompt/dynamicPromptBuilder.js';

describe('DynamicPromptBuilder', () => {
  const baseUserProfile = {
    summary: 'Um desenvolvedor de software que gosta de café.',
    preferences: { tone: 'amigável', humor_level: 'médio', language: 'pt-br' },
    key_facts: [{ fact: 'Trabalha remotamente' }],
  };
  const ltmContext = 'Lembre-se que o usuário prefere respostas curtas.';

  it('should build a baseline prompt correctly', () => {
    // Pass null for interactionStyle to avoid default behavior
    const prompt = DynamicPromptBuilder.buildDynamicPrompt({}, '', '', '', null, '');
    expect(prompt.role).toBe('system');
    expect(prompt.content).toContain('Você é Brenda, uma assistente de IA integrada ao WhatsApp.');
    expect(prompt.content).not.toContain('Instruções Adaptativas');
    expect(prompt.content).not.toContain('Perfil do Usuário');
    expect(prompt.content).not.toContain('Conversas Anteriores Relevantes');
  });

  it('should add negative sentiment adaptation', () => {
    const prompt = DynamicPromptBuilder.buildDynamicPrompt({}, '', '', 'negative', {}, '');
    expect(prompt.content).toContain('Instruções Adaptativas para ESTA Resposta:');
    expect(prompt.content).toContain('Adote um tom especialmente empático, cuidadoso e resolutivo.');
  });

  it('should add formal interaction style adaptation', () => {
    const prompt = DynamicPromptBuilder.buildDynamicPrompt({}, '', '', '', { isFormal: true }, '');
    expect(prompt.content).toContain('A comunicação do usuário é formal. Mantenha um estilo de comunicação similar');
  });

  it('should add complex task situation adaptation', () => {
    const prompt = DynamicPromptBuilder.buildDynamicPrompt({}, '', '', '', {}, 'complex_task');
    expect(prompt.content).toContain('Use o raciocínio "Chain-of-Thought".');
  });

  it('should include user profile information', () => {
    const prompt = DynamicPromptBuilder.buildDynamicPrompt(baseUserProfile, '', '', '', {});
    expect(prompt.content).toContain('--- Perfil do Usuário (Memória de Longo Prazo) ---');
    expect(prompt.content).toContain('Resumo: Um desenvolvedor de software que gosta de café.');
    expect(prompt.content).toContain('Preferências: Tom: amigável, Humor: médio, Idioma: pt-br');
    expect(prompt.content).toContain('Fatos importantes: Trabalha remotamente');
  });

  it('should include LTM context', () => {
    const prompt = DynamicPromptBuilder.buildDynamicPrompt({}, ltmContext, '', '', {});
    expect(prompt.content).toContain('--- Conversas Anteriores Relevantes (Memória de Longo Prazo) ---');
    expect(prompt.content).toContain(ltmContext);
  });

  it('should include image analysis result warning', () => {
    const prompt = DynamicPromptBuilder.buildDynamicPrompt({}, '', 'Análise da imagem aqui', '', {});
    expect(prompt.content).toContain('⚠️ IMPORTANTE: Uma análise automática de imagem já foi realizada');
  });

  it('should combine all elements correctly', () => {
    const prompt = DynamicPromptBuilder.buildDynamicPrompt(
      baseUserProfile,
      ltmContext,
      'Análise da imagem',
      'negative',
      { isFormal: false },
      'complex_task'
    );
    // Check for all sections
    expect(prompt.content).toContain('Instruções Adaptativas para ESTA Resposta:');
    expect(prompt.content).toContain('--- Perfil do Usuário (Memória de Longo Prazo) ---');
    expect(prompt.content).toContain('--- Conversas Anteriores Relevantes (Memória de Longo Prazo) ---');
    expect(prompt.content).toContain('⚠️ IMPORTANTE: Uma análise automática de imagem já foi realizada');

    // Check for specific instructions
    expect(prompt.content).toContain('Adote um tom especialmente empático');
    expect(prompt.content).toContain('O usuário é informal.');
    expect(prompt.content).toContain('Use o raciocínio "Chain-of-Thought".');
  });
});
