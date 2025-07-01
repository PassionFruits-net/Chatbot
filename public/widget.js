(function() {
    const script = document.currentScript;
    const customerId = script.getAttribute('data-customer') || window.chatbotConfig?.botId;
    const customLogo = script.getAttribute('data-logo') || window.chatbotConfig?.logoUrl;
    
    // Get configuration from window.chatbotConfig or defaults
    const config = window.chatbotConfig || {};
    const brandColor = config.brandColor || '#a855f7';
    const assistantLabel = config.assistantLabel || 'Assistant';
    const welcomeMessage = config.welcomeMessage || 'Hello! How can I help you today?';
    const simpleModeLabel = config.simpleModeLabel || 'Simple explanations';
    const inputPlaceholder = config.inputPlaceholder || 'Type your message...';
    const sendLabel = config.sendLabel || 'Send';
    const thinkingLabel = config.thinkingLabel || 'Thinking...';
    
    if (!customerId) {
        console.error('RAG-Lite: data-customer attribute or chatbotConfig.botId is required');
        return;
    }

    const widgetHTML = `
        <div id="rag-widget" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;" class="rag-widget">
            <button id="rag-toggle" style="width: 60px; height: 60px; border-radius: 50%; background: ${brandColor}; color: white; border: none; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
            </button>
            
            <div id="rag-chat" style="display: none; position: absolute; bottom: 80px; right: 0; width: 350px; height: 600px; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden; transition: all 0.3s ease;">
                <div style="background: ${brandColor}; color: white; padding: 12px 16px; font-weight: 600; display: flex; align-items: center; height: 56px;">
                    ${customLogo ? `<img src="${customLogo}" alt="Logo" style="height: 24px; width: auto; margin-right: 8px;">` : ''}
                    ${assistantLabel}
                    <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
                        <button id="rag-fullscreen" style="background: none; border: none; color: white; cursor: pointer; padding: 4px; display: flex; align-items: center;" title="Toggle fullscreen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                            </svg>
                        </button>
                        <button id="rag-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px; line-height: 1;">&times;</button>
                    </div>
                </div>
                
                <div id="rag-messages" style="height: calc(100% - 156px); overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; max-width: 80%;">
                        ${welcomeMessage}
                    </div>
                </div>
                
                <div style="padding: 12px 16px 16px 16px; border-top: 1px solid #e5e7eb; background: white;">
                    <div id="rag-complexity-selector" style="display: none; margin-bottom: 12px; font-size: 14px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rag-simple-mode" style="margin: 0;">
                            <span>${simpleModeLabel}</span>
                        </label>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <input id="rag-input" type="text" placeholder="${inputPlaceholder}" 
                            style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; focus: border-color: #2563eb;">
                        <button id="rag-send" style="padding: 8px 16px; background: ${brandColor}; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            ${sendLabel}
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
            background: ${brandColor} !important;
            filter: brightness(0.9);
        }
        #rag-send:hover {
            background: ${brandColor} !important;
            filter: brightness(0.9);
        }
        #rag-input:focus {
            border-color: ${brandColor} !important;
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
        .rag-fullscreen {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            z-index: 10000 !important;
        }
        .rag-content strong {
            font-weight: 600;
        }
        .rag-content em {
            font-style: italic;
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = widgetHTML;
    document.body.appendChild(container.firstElementChild);

    const toggle = document.getElementById('rag-toggle');
    const chat = document.getElementById('rag-chat');
    const close = document.getElementById('rag-close');
    const fullscreen = document.getElementById('rag-fullscreen');
    const input = document.getElementById('rag-input');
    const send = document.getElementById('rag-send');
    const messages = document.getElementById('rag-messages');
    const complexitySelector = document.getElementById('rag-complexity-selector');
    const simpleModeCheckbox = document.getElementById('rag-simple-mode');

    let customerSettings = {
        explanationComplexity: 'advanced',
        allowComplexitySelection: false
    };

    // Fetch customer settings
    async function loadCustomerSettings() {
        try {
            const scriptUrl = new URL(script.src);
            const baseUrl = scriptUrl.origin;
            console.log('Loading customer settings for:', customerId, 'from:', baseUrl);
            const response = await fetch(`${baseUrl}/api/customers/${customerId}/settings`);
            
            if (response.ok) {
                customerSettings = await response.json();
                console.log('Customer settings loaded:', customerSettings);
                
                // Show complexity selector if allowed
                if (customerSettings.allowComplexitySelection) {
                    console.log('Showing complexity selector');
                    complexitySelector.style.display = 'block';
                    // Set initial state based on customer default
                    simpleModeCheckbox.checked = customerSettings.explanationComplexity === 'simple';
                } else {
                    console.log('Complexity selection not allowed for this customer');
                }
            } else {
                console.error('Failed to fetch customer settings:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Failed to load customer settings:', error);
        }
    }

    // Initialize settings
    loadCustomerSettings();

    // Simple markdown parser for headers, bold and italic
    function parseMarkdown(text) {
        return text
            .replace(/### (.+)/g, '<h3 style="font-size: 1.1em; font-weight: 600; margin: 12px 0 8px 0; color: #374151;">$1</h3>')
            .replace(/## (.+)/g, '<h2 style="font-size: 1.2em; font-weight: 600; margin: 14px 0 10px 0; color: #374151;">$1</h2>')
            .replace(/# (.+)/g, '<h1 style="font-size: 1.3em; font-weight: 700; margin: 16px 0 12px 0; color: #374151;">$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    }

    toggle.onclick = () => chat.style.display = 'block';
    close.onclick = () => chat.style.display = 'none';
    fullscreen.onclick = () => {
        chat.classList.toggle('rag-fullscreen');
        // Update fullscreen icon
        const isFullscreen = chat.classList.contains('rag-fullscreen');
        fullscreen.innerHTML = isFullscreen ? 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>' : 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
    };

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
                <div class="rag-content">${thinkingLabel}</div>
                <div class="rag-sources"></div>
            </div>
        `;

        try {
            // Get the base URL from where the widget was loaded
            const scriptUrl = new URL(script.src);
            const baseUrl = scriptUrl.origin;
            
            // Determine current complexity preference
            const currentComplexity = customerSettings.allowComplexitySelection && simpleModeCheckbox.checked 
                ? 'simple' 
                : customerSettings.explanationComplexity;

            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    customerId, 
                    message,
                    explanationComplexity: currentComplexity
                })
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
            let accumulatedContent = '';

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
                                accumulatedContent += data.content;
                                contentDiv.innerHTML = '<p>' + parseMarkdown(accumulatedContent) + '</p>';
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
            botMsg.querySelector('.rag-content').innerHTML = '<p>Sorry, I encountered an error. Please try again.</p>';
        }
    }

    send.onclick = sendMessage;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
})();