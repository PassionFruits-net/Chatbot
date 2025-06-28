(function() {
    const script = document.currentScript;
    const customerId = script.getAttribute('data-customer');
    const customLogo = script.getAttribute('data-logo');
    
    if (!customerId) {
        console.error('RAG-Lite: data-customer attribute is required');
        return;
    }

    const widgetHTML = `
        <div id="rag-widget" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;" class="rag-widget">
            <button id="rag-toggle" style="width: 60px; height: 60px; border-radius: 50%; background: #a855f7; color: white; border: none; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
            </button>
            
            <div id="rag-chat" style="display: none; position: absolute; bottom: 80px; right: 0; width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden;">
                <div style="background: #a855f7; color: white; padding: 16px; font-weight: 600; display: flex; align-items: center;">
                    <img src="${customLogo || new URL(script.src).origin + '/logo.png'}" alt="Logo" style="height: 24px; width: auto; margin-right: 8px;">
                    Assistant
                    <button id="rag-close" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer; font-size: 20px;">&times;</button>
                </div>
                
                <div id="rag-messages" style="height: 380px; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; max-width: 80%;">
                        Hello! How can I help you today?
                    </div>
                </div>
                
                <div style="padding: 16px; border-top: 1px solid #e5e7eb;">
                    <div style="display: flex; gap: 8px;">
                        <input id="rag-input" type="text" placeholder="Type your message..." 
                            style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; focus: border-color: #2563eb;">
                        <button id="rag-send" style="padding: 8px 16px; background: #a855f7; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #rag-widget * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #rag-toggle:hover {
            background: #7c3aed !important;
        }
        #rag-send:hover {
            background: #7c3aed !important;
        }
        #rag-input:focus {
            border-color: #a855f7 !important;
        }
        .rag-user-msg {
            background: #2563eb !important;
            color: white !important;
            align-self: flex-end !important;
        }
        .rag-bot-msg {
            background: #f3f4f6 !important;
            align-self: flex-start !important;
        }
        .rag-sources {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = widgetHTML;
    document.body.appendChild(container.firstElementChild);

    const toggle = document.getElementById('rag-toggle');
    const chat = document.getElementById('rag-chat');
    const close = document.getElementById('rag-close');
    const input = document.getElementById('rag-input');
    const send = document.getElementById('rag-send');
    const messages = document.getElementById('rag-messages');

    toggle.onclick = () => chat.style.display = 'block';
    close.onclick = () => chat.style.display = 'none';

    async function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        messages.innerHTML += `
            <div class="rag-user-msg" style="background: #2563eb; color: white; padding: 12px; border-radius: 8px; max-width: 80%; align-self: flex-end;">
                ${message}
            </div>
        `;
        
        input.value = '';
        messages.scrollTop = messages.scrollHeight;

        const botMsgId = 'bot-' + Date.now();
        messages.innerHTML += `
            <div id="${botMsgId}" class="rag-bot-msg" style="background: #f3f4f6; padding: 12px; border-radius: 8px; max-width: 80%; align-self: flex-start;">
                <div class="rag-content">Thinking...</div>
                <div class="rag-sources"></div>
            </div>
        `;

        try {
            // Get the base URL from where the widget was loaded
            const scriptUrl = new URL(script.src);
            const baseUrl = scriptUrl.origin;
            
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, message })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const botMsg = document.getElementById(botMsgId);
            const contentDiv = botMsg.querySelector('.rag-content');
            const sourcesDiv = botMsg.querySelector('.rag-sources');
            
            contentDiv.innerHTML = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                console.log('Received chunk:', text);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.content) {
                                contentDiv.innerHTML += data.content;
                            }
                            if (data.sources) {
                                const uniqueSources = data.sources.reduce((acc, source) => {
                                    const fileName = typeof source === 'string' ? source : source.fileName;
                                    if (!acc.includes(fileName)) {
                                        acc.push(fileName);
                                    }
                                    return acc;
                                }, []);
                                sourcesDiv.innerHTML = `<div class="rag-sources">Sources: ${uniqueSources.join(', ')}</div>`;
                            }
                        } catch (e) {}
                    }
                }
                
                messages.scrollTop = messages.scrollHeight;
            }
        } catch (error) {
            console.error('Chat widget error:', error);
            const botMsg = document.getElementById(botMsgId);
            botMsg.querySelector('.rag-content').innerHTML = 'Sorry, I encountered an error. Please try again.';
        }
    }

    send.onclick = sendMessage;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
})();