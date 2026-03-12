import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, HelpCircle } from 'lucide-react';

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

  // ✅ Apenas variáveis PÚBLICAS ficam no frontend — são seguras por design
  // A GROQ_API_KEY foi movida para os Secrets da Edge Function no Supabase
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

  // Chama a Edge Function — toda a lógica sensível fica no servidor
  const callChatRAG = async (query) => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/chat-rag`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }

    return response.json(); // { answer, sourcesCount }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { answer, sourcesCount } = await callChatRAG(userMessage);

      setMessages(prev => [...prev, {
        type: 'assistant',
        content: answer,
        sources: sourcesCount
      }]);

    } catch (error) {
      console.error('Erro:', error);

      setMessages(prev => [...prev, {
        type: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente em instantes.'
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
              <p className="text-blue-100 text-sm">Desenvolvido por: Muneo-PRPPG / Versão: 1.0.0-alpha.1</p>
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