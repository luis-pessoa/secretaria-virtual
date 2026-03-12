import React, { useState, useRef, useEffect } from 'react';
import { Send, BookOpen, Bot, HelpCircle, Database } from 'lucide-react';

const EditalChat = () => {
  const [messages, setMessages] = useState([
    {
      type: 'assistant',
      content: 'Olá! 👋 Sou seu assistente virtual. Estou conectado à base de conhecimento da Pró-Reitoria de Pesquisa e Pós-Graduação da UFBA e posso responder suas dúvidas. Como posso ajudar?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

  const quickQuestions = [
    "Quem pode participar do PIBIC?",
    "Qual é o valor da bolsa?",
    "Quem escolhe o bolsista?",
    "É possível substituir bolsistas durante a vigência da bolsa?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const searchDocuments = async (query) => {
    try {
      console.log('🔍 Buscando documentos para:', query);

      // Sem filtros na URL — evita erro 400 com camelCase no Supabase REST
      // Filtragem de isActive e relevância feita no cliente
      const textResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/documents?select=id,content,metadata,isActive`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );

      if (!textResponse.ok) {
        const error = await textResponse.text();
        console.error('❌ Erro Supabase:', error);
        throw new Error('Erro ao buscar documentos');
      }

      const allDocs = await textResponse.json();
      console.log('✓ Total de docs:', allDocs.length);

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(' ').filter(w => w.length > 2);

      const scored = allDocs
        .filter(doc => doc.content && doc.isActive !== false)
        .map(doc => {
          const contentLower = doc.content.toLowerCase();
          const score = queryWords.reduce((acc, word) => {
            return acc + (contentLower.includes(word) ? 1 : 0);
          }, 0);
          return { ...doc, score };
        })
        .filter(doc => doc.score > 0)
        .sort((a, b) => b.score - a.score);

      const results = scored.slice(0, 5);
      console.log('✓ Documentos relevantes encontrados:', results.length);

      return results;

    } catch (error) {
      console.error('❌ Erro na busca:', error);
      return [];
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const relevantDocs = await searchDocuments(userMessage);

      const context = relevantDocs.length > 0
        ? relevantDocs.map((doc, idx) => {
            const content = doc.content || '';
            const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
            const metaInfo = doc.metadata ? ` | Metadata: ${JSON.stringify(doc.metadata)}` : '';
            return `[Documento ${idx + 1}${metaInfo}]\nConteúdo: ${preview}\n`;
          }).join('\n---\n')
        : 'Nenhum documento relevante encontrado na base de conhecimento.';

      console.log('Contexto preparado com', relevantDocs.length, 'documentos');

      // Chamada à API do Groq (compatível com OpenAI)
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', // Modelo rápido e capaz do Groq
          messages: [
            {
              role: 'system',
              content: `Você é um assistente especializado da Secretaria Virtual. Responda perguntas APENAS com base nos documentos fornecidos. Seja claro, objetivo e amigável. Se os documentos não contiverem a informação, diga isso honestamente.`
            },
            {
              role: 'user',
              content: `DOCUMENTOS DA BASE DE CONHECIMENTO:\n${context}\n\nPERGUNTA DO USUÁRIO:\n${userMessage}\n\nResponda de forma clara e útil:`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!groqResponse.ok) {
        const errorData = await groqResponse.json();
        console.error('❌ Erro Groq:', errorData);
        throw new Error(`Erro Groq: ${errorData.error?.message || 'Desconhecido'}`);
      }

      const groqData = await groqResponse.json();

      if (groqData.choices && groqData.choices[0]?.message?.content) {
        const assistantResponse = groqData.choices[0].message.content;
        console.log('✓ Resposta gerada com sucesso');

        setMessages(prev => [...prev, {
          type: 'assistant',
          content: assistantResponse,
          sources: relevantDocs.length
        }]);
      } else {
        throw new Error('Resposta inválida do Groq');
      }

    } catch (error) {
      console.error('Erro completo:', error);

      let errorMessage = 'Desculpe, ocorreu um erro ao processar sua pergunta.';

      if (error.message.includes('Groq')) {
        errorMessage += ' Verifique se a API Key do Groq está correta.';
      } else if (error.message.includes('Supabase')) {
        errorMessage += ' Verifique suas credenciais do Supabase.';
      }

      setMessages(prev => [...prev, {
        type: 'assistant',
        content: errorMessage
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question) => {
    setInput(question);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

 
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="bg-blue-600 text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Secretaria Virtual</h1>
              <p className="text-blue-100 text-sm">Pró-Reitoria de Pesquisa e Pós-Graduação - UFBA</p>
              <p className="text-blue-100 text-sm">Desenvolvido por:  Muneo-PRPPG / Versão: 1.0.0-alpha.1</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl rounded-lg p-4 shadow-md ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.sources > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                    📚 Baseado em {message.sources} documento(s) da base de conhecimento
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-sm text-gray-500 ml-2">Buscando e processando...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-4">
          <div className="flex items-center gap-2 mb-3 text-gray-600">
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Perguntas sugeridas:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleQuickQuestion(question)}
                className="text-left p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all text-sm text-gray-700"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua pergunta..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditalChat;
