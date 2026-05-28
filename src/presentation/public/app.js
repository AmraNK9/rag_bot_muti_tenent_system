document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const tabTitle = document.getElementById('active-tab-title');
  const tabDesc = document.getElementById('active-tab-desc');

  const tabDescriptions = {
    overview: 'Chatbot Prototype dashboard state and quick operations.',
    embeddings: 'Test Voyage AI embedding generation.',
    chromadb: 'Create collections, index documents, and perform semantic searches.',
    bots: 'Simulate chat sessions via webhook API and view real-time pipeline execution.',
    deepseek: 'Directly test the DeepSeek chat endpoint without RAG/DB side-effects.',
    myanmar: 'Test how the text chunker handles Myanmar language segmentation and overlap.'
  };

  // Toggle custom prompt visibility based on bot role selection
  const botRoleSelect = document.getElementById('bot-role');
  const customPromptGroup = document.getElementById('custom-prompt-group');
  if (botRoleSelect && customPromptGroup) {
    botRoleSelect.addEventListener('change', () => {
      customPromptGroup.style.display = botRoleSelect.value === 'custom' ? 'block' : 'none';
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      
      // Update active nav item
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Update active pane
      tabPanes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(`tab-${tabId}`).classList.add('active');

      // Update header text
      tabTitle.textContent = item.textContent.trim();
      tabDesc.textContent = tabDescriptions[tabId] || '';

      // Tab specific logic
      if (tabId === 'overview') {
        fetchOverviewData();
      } else if (tabId === 'bots') {
        fetchChatbotDropdowns();
      }
    });
  });

  // Helper function to render JSON in boxes
  function renderJSON(elementId, data) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = JSON.stringify(data, null, 2);
      el.style.color = data.success !== false ? '#38bdf8' : '#f87171';
    }
  }

  // --- OVERVIEW TAB FUNCTIONS ---
  async function fetchOverviewData() {
    try {
      // Fetch Businesses
      const bizRes = await fetch('/api/test/businesses');
      const bizData = await bizRes.json();
      
      // Fetch Chatbots
      const botRes = await fetch('/api/test/chatbots');
      const botData = await botRes.json();

      // Update stats
      document.getElementById('stat-businesses-count').textContent = bizData.businesses ? bizData.businesses.length : 0;
      document.getElementById('stat-chatbots-count').textContent = botData.chatbots ? botData.chatbots.length : 0;

      // Populate business select dropdown
      const bizSelect = document.getElementById('bot-business-id');
      if (bizSelect && bizData.businesses) {
        bizSelect.innerHTML = '<option value="" disabled selected>Select a business</option>';
        bizData.businesses.forEach(biz => {
          const opt = document.createElement('option');
          opt.value = biz.id;
          opt.textContent = `${biz.name} (ID: ${biz.id})`;
          bizSelect.appendChild(opt);
        });
      }

      // Populate chatbots table
      const botsTableBody = document.querySelector('#table-chatbots tbody');
      if (botsTableBody && botData.chatbots) {
        if (botData.chatbots.length === 0) {
          botsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No chatbots registered yet. Create one!</td></tr>';
        } else {
          botsTableBody.innerHTML = '';
          botData.chatbots.forEach(bot => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${bot.id}</td>
              <td><strong>${bot.name}</strong></td>
              <td><span class="badge-value" style="text-transform: capitalize;">${bot.type}</span></td>
              <td><span class="role-badge">${bot.bot_role || 'sales'}</span></td>
              <td>${bot.business ? bot.business.name : 'Unknown'} (ID: ${bot.business_id})</td>
              <td><code>${bot.token.substring(0, 15)}${bot.token.length > 15 ? '...' : ''}</code></td>
            `;
            botsTableBody.appendChild(tr);
          });
        }
      }

      // Update Badges based on active environment (just reading process configuration)
      const hasRealKeys = botData.chatbots && botData.chatbots.some(b => b.token !== 'mock-token');
      document.getElementById('badge-llm').textContent = 'DeepSeek API';
      document.getElementById('badge-db').textContent = 'SQLite / MySQL';
      document.getElementById('stat-chroma-status').textContent = 'Chroma Store Ready';

      // Fetch credits for the first business
      if (bizData.businesses && bizData.businesses.length > 0) {
        try {
          const creditsRes = await fetch(`/api/test/business/${bizData.businesses[0].id}/credits`);
          const creditsData = await creditsRes.json();
          if (creditsData.success) {
            document.getElementById('stat-credits-count').textContent = creditsData.activeMessagesCount;
            const planLabel = creditsData.plan === 'subscription'
              ? `${(creditsData.subscriptionPlan || 'basic').toUpperCase()} Plan`
              : `${creditsData.plan.replace(/_/g, ' ')} Plan`;
            document.getElementById('stat-plan-info').textContent = planLabel;
          }
        } catch (e) {
          console.error('Failed to fetch credits:', e);
        }
      }

    } catch (err) {
      console.error('Failed to load overview data:', err);
    }
  }

  // Handle Business Sign-up Form
  const formRegisterBusiness = document.getElementById('form-register-business');
  if (formRegisterBusiness) {
    formRegisterBusiness.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('biz-name').value;
      const detailInfo = document.getElementById('biz-desc').value;
      const password = document.getElementById('biz-password').value;

      try {
        const res = await fetch('/api/test/business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, detailInfo, password: password || undefined })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Business "${name}" created successfully!`);
          formRegisterBusiness.reset();
          fetchOverviewData();
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch (err) {
        alert(`Request failed: ${err.message}`);
      }
    });
  }

  // Handle Chatbot Onboarding Form
  const formCreateChatbot = document.getElementById('form-create-chatbot');
  if (formCreateChatbot) {
    formCreateChatbot.addEventListener('submit', async (e) => {
      e.preventDefault();
      const businessId = document.getElementById('bot-business-id').value;
      const name = document.getElementById('bot-name').value;
      const type = document.getElementById('bot-type').value;
      const token = document.getElementById('bot-token').value;
      const botRole = document.getElementById('bot-role').value;
      const customSystemPrompt = document.getElementById('bot-custom-prompt').value;

      try {
        const res = await fetch('/api/test/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId, name, type, token,
            botRole,
            customSystemPrompt: botRole === 'custom' ? customSystemPrompt : undefined
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Chatbot "${name}" created successfully!`);
          formCreateChatbot.reset();
          fetchOverviewData();
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch (err) {
        alert(`Request failed: ${err.message}`);
      }
    });
  }


  // --- EMBEDDINGS TAB ---
  const formTestEmbedding = document.getElementById('form-test-embedding');
  if (formTestEmbedding) {
    formTestEmbedding.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('emb-text').value;
      const outputBox = document.getElementById('emb-vector-output');
      outputBox.innerHTML = '<div class="placeholder-text">Computing embeddings, please wait...</div>';

      try {
        const res = await fetch('/api/test/embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        renderJSON('emb-vector-output', data);
      } catch (err) {
        outputBox.innerHTML = `<div style="color: #f87171;">Request failed: ${err.message}</div>`;
      }
    });
  }


  // --- CHROMADB MANAGER TAB ---
  // Initialize collection
  const formChromaInit = document.getElementById('form-chroma-init');
  if (formChromaInit) {
    formChromaInit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('chroma-init-name').value;
      const outputBox = document.getElementById('chroma-op-output');
      outputBox.innerHTML = 'Initializing collection...';

      try {
        const res = await fetch('/api/test/chroma/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        renderJSON('chroma-op-output', data);
      } catch (err) {
        outputBox.innerHTML = `Error: ${err.message}`;
      }
    });
  }

  // Add document
  const formChromaAdd = document.getElementById('form-chroma-add');
  if (formChromaAdd) {
    formChromaAdd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const collectionName = document.getElementById('chroma-add-coll').value;
      const id = document.getElementById('chroma-add-id').value;
      const text = document.getElementById('chroma-add-text').value;
      const outputBox = document.getElementById('chroma-op-output');
      outputBox.innerHTML = 'Adding document chunk (generating embedding via Voyage AI if needed)...';

      try {
        const res = await fetch('/api/test/chroma/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionName, id, text })
        });
        const data = await res.json();
        renderJSON('chroma-op-output', data);
      } catch (err) {
        outputBox.innerHTML = `Error: ${err.message}`;
      }
    });
  }

  // Search collection
  const formChromaSearch = document.getElementById('form-chroma-search');
  if (formChromaSearch) {
    formChromaSearch.addEventListener('submit', async (e) => {
      e.preventDefault();
      const collectionName = document.getElementById('chroma-search-coll').value;
      const queryText = document.getElementById('chroma-search-text').value;
      const outputBox = document.getElementById('chroma-op-output');
      outputBox.innerHTML = 'Querying collection...';

      try {
        const res = await fetch('/api/test/chroma/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionName, queryText })
        });
        const data = await res.json();
        renderJSON('chroma-op-output', data);
      } catch (err) {
        outputBox.innerHTML = `Error: ${err.message}`;
      }
    });
  }


  // --- CHAT SIMULATOR TAB ---
  let selectedChatbotId = null;
  let activeBotData = null;

  async function fetchChatbotDropdowns() {
    try {
      const res = await fetch('/api/test/chatbots');
      const data = await res.json();
      const select = document.getElementById('chat-bot-id');
      if (select && data.chatbots) {
        select.innerHTML = '<option value="" disabled selected>Select a chatbot</option>';
        data.chatbots.forEach(bot => {
          const opt = document.createElement('option');
          opt.value = bot.id;
          opt.textContent = `${bot.name} (${bot.type} - ID: ${bot.id})`;
          opt.dataset.businessId = bot.business_id;
          select.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Failed to load chatbots dropdown:', err);
    }
  }

  // Handle active chatbot selection change
  const chatBotSelect = document.getElementById('chat-bot-id');
  if (chatBotSelect) {
    chatBotSelect.addEventListener('change', async () => {
      selectedChatbotId = chatBotSelect.value;
      const option = chatBotSelect.options[chatBotSelect.selectedIndex];
      const botName = option.text;
      
      document.getElementById('chat-bot-title-display').textContent = botName;
      document.getElementById('chat-bot-status-display').textContent = 'Ready';
      
      // Enable text inputs
      document.getElementById('chat-message-input').removeAttribute('disabled');
      document.getElementById('btn-send-message').removeAttribute('disabled');

      // Clear previous chats and load existing logs
      const conversationArea = document.getElementById('chat-conversation-area');
      conversationArea.innerHTML = '<div class="chat-notice">Loading conversation history...</div>';
      
      await syncChatLogsAndSummaries();
    });
  }

  // Sync logs and summaries
  async function syncChatLogsAndSummaries() {
    if (!selectedChatbotId) return;
    const senderId = document.getElementById('chat-sender-id').value;

    try {
      // 1. Fetch message history
      const msgRes = await fetch(`/api/test/messages?chatbotId=${selectedChatbotId}&senderId=${senderId}`);
      const msgData = await msgRes.json();

      const conversationArea = document.getElementById('chat-conversation-area');
      conversationArea.innerHTML = '';

      if (msgData.messages && msgData.messages.length > 0) {
          msgData.messages.forEach((msg) => {
            // Use sender_type from DB to render user vs bot bubbles
            const isUser = msg.sender_type === 'user';
            appendChatBubble(msg.message, isUser, msg.sent_date);
          });
        } else {
          conversationArea.innerHTML = '<div class="chat-notice">No messages in history. Send a message to start!</div>';
        }
      

      // 2. Fetch summaries
      const sumRes = await fetch(`/api/test/summaries?chatbotId=${selectedChatbotId}&senderId=${senderId}`);
      const sumData = await sumRes.json();
      
      // Update DB messages inspect list
      const dbMsgsList = document.getElementById('db-messages-list');
      if (dbMsgsList && msgData.messages) {
        if (msgData.messages.length === 0) {
          dbMsgsList.innerHTML = '<div class="placeholder-text">No messages in database yet.</div>';
        } else {
          dbMsgsList.innerHTML = '';
          msgData.messages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `
              <div class="log-header">
                <span>Message ID: ${msg.id}</span>
                <span>${new Date(msg.sent_date).toLocaleTimeString()}</span>
              </div>
              <div class="log-text">ChatBot ID ${msg.chatbot_id} | Sender ID ${msg.sender_id}: "${msg.message}"</div>
            `;
            dbMsgsList.appendChild(item);
          });
        }
      }

      // Update DB summaries inspect list
      const dbSumList = document.getElementById('db-summaries-list');
      if (dbSumList && sumData.summaries) {
        if (sumData.summaries.length === 0) {
          dbSumList.innerHTML = '<div class="placeholder-text">No history summaries triggered yet. (Threshold is 20 messages)</div>';
        } else {
          dbSumList.innerHTML = '';
          sumData.summaries.forEach(sum => {
            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `
              <div class="log-header">
                <span>Summary ID: ${sum.id}</span>
                <span>${new Date(sum.created_at).toLocaleTimeString()}</span>
              </div>
              <div class="log-text log-text-summary">Chatbot ${sum.chatbot_id} | Sender ${sum.sender_id}: "${sum.summary}"</div>
            `;
            dbSumList.appendChild(item);
          });
        }
      }

    } catch (err) {
      console.error('Failed to sync logs:', err);
    }
  }

  // Handle Knowledge Ingestion button
  const btnIngestKnowledge = document.getElementById('btn-ingest-knowledge');
  if (btnIngestKnowledge) {
    btnIngestKnowledge.addEventListener('click', async () => {
      if (!selectedChatbotId) {
        alert('Please select a chatbot first.');
        return;
      }
      const documentText = document.getElementById('chat-ingest-text').value;
      if (!documentText.trim()) {
        alert('Please enter some knowledge text to ingest.');
        return;
      }

      const option = chatBotSelect.options[chatBotSelect.selectedIndex];
      const businessId = option.dataset.businessId;

      btnIngestKnowledge.textContent = 'Ingesting...';
      btnIngestKnowledge.setAttribute('disabled', 'true');

      try {
        const res = await fetch('/api/test/knowledge/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatbotId: selectedChatbotId,
            businessId: businessId,
            documentText: documentText
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Success! Ingested documents into vector db. Created ${data.chunkCount} chunks.`);
          document.getElementById('chat-ingest-text').value = '';
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch (err) {
        alert(`Ingestion failed: ${err.message}`);
      } finally {
        btnIngestKnowledge.textContent = 'Ingest Documents';
        btnIngestKnowledge.removeAttribute('disabled');
      }
    });
  }

  // In-app chat display function
  function appendChatBubble(text, isUser, dateString) {
    const conversationArea = document.getElementById('chat-conversation-area');
    // Remove notice if present
    const notice = conversationArea.querySelector('.chat-notice');
    if (notice) notice.remove();

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isUser ? 'user' : 'bot'}`;
    
    const time = dateString ? new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    bubble.innerHTML = `
      <div class="bubble-content">${text}</div>
      <div class="bubble-meta">${isUser ? 'User' : 'Bot'} • ${time}</div>
    `;
    conversationArea.appendChild(bubble);
    conversationArea.scrollTop = conversationArea.scrollHeight;
  }

  // Handle Send Message
  const btnSendMessage = document.getElementById('btn-send-message');
  const chatMessageInput = document.getElementById('chat-message-input');

  async function handleSendMessageSimulation() {
    const text = chatMessageInput.value.trim();
    if (!text || !selectedChatbotId) return;

    const senderId = document.getElementById('chat-sender-id').value;

    // Append to UI immediately as user
    appendChatBubble(text, true);
    chatMessageInput.value = '';

    try {
      const res = await fetch('/api/test/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId: selectedChatbotId,
          senderId: senderId,
          text: text
        })
      });
      const data = await res.json();
      if (data.success) {
        appendChatBubble(data.replyText, false);
      } else {
        appendChatBubble('[Simulation Failed: Check server logs or verify configurations]', false);
      }
      
      // Sync DB logs tables in inspect pane
      await syncChatLogsAndSummaries();
    } catch (err) {
      appendChatBubble(`[Simulation Connection Error: ${err.message}]`, false);
    }
  }

  if (btnSendMessage && chatMessageInput) {
    btnSendMessage.addEventListener('click', handleSendMessageSimulation);
    chatMessageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSendMessageSimulation();
      }
    });
  }

  // Clear chat window button
  const btnClearChat = document.getElementById('btn-clear-chat');
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      const conversationArea = document.getElementById('chat-conversation-area');
      conversationArea.innerHTML = '<div class="chat-notice">Conversation UI cleared. System logs in database remain intact.</div>';
    });
  }

  // Chat Inspect Panel tabs
  const inspectBtns = document.querySelectorAll('.inspect-tab-btn');
  const inspectPanes = document.querySelectorAll('.inspect-pane');

  inspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const paneId = btn.getAttribute('data-inspect');
      inspectBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      inspectPanes.forEach(p => p.classList.remove('active'));
      document.getElementById(`inspect-pane-${paneId}`).classList.add('active');
    });
  });


  // --- DEEPSEEK PLAYGROUND ---
  const formTestDeepseek = document.getElementById('form-test-deepseek');
  if (formTestDeepseek) {
    formTestDeepseek.addEventListener('submit', async (e) => {
      e.preventDefault();
      const systemPrompt = document.getElementById('ds-system').value;
      const prompt = document.getElementById('ds-prompt').value;
      const temperature = document.getElementById('ds-temp').value;

      const outputBox = document.getElementById('ds-response-output');
      outputBox.innerHTML = '<div class="placeholder-text">Calling DeepSeek Chat API...</div>';

      try {
        const messages = [{ role: 'user', content: prompt }];
        const res = await fetch('/api/test/deepseek/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            systemPrompt: systemPrompt || undefined,
            temperature: temperature ? Number(temperature) : undefined
          })
        });
        const data = await res.json();
        renderJSON('ds-response-output', data);
      } catch (err) {
        outputBox.innerHTML = `<div style="color: #f87171;">Request failed: ${err.message}</div>`;
      }
    });
  }


  // --- MYANMAR CHUNKER TAB ---
  const formTestMyanmar = document.getElementById('form-test-myanmar');
  if (formTestMyanmar) {
    formTestMyanmar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('myanmar-text').value;
      const chunkSize = document.getElementById('myanmar-size').value;
      const overlap = document.getElementById('myanmar-overlap').value;

      const outputBox = document.getElementById('myanmar-chunks-output');
      outputBox.innerHTML = '<div class="placeholder-text">Running chunker...</div>';

      try {
        const res = await fetch('/api/test/myanmar-chunker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            chunkSize: chunkSize ? Number(chunkSize) : undefined,
            overlap: overlap ? Number(overlap) : undefined
          })
        });
        const data = await res.json();
        
        if (data.success && data.chunks) {
          outputBox.innerHTML = '';
          data.chunks.forEach((chunk, i) => {
            const chunkDiv = document.createElement('div');
            chunkDiv.className = 'log-item';
            chunkDiv.style.borderColor = 'rgba(6, 182, 212, 0.3)';
            chunkDiv.innerHTML = `
              <div class="log-header" style="color: var(--color-cyan);">Chunk ${i + 1} (${chunk.length} chars)</div>
              <div class="log-text" style="font-family: inherit; font-size: 13px;">"${chunk}"</div>
            `;
            outputBox.appendChild(chunkDiv);
          });
        } else {
          outputBox.innerHTML = `<div style="color: #f87171;">Error: ${data.error}</div>`;
        }
      } catch (err) {
        outputBox.innerHTML = `<div style="color: #f87171;">Request failed: ${err.message}</div>`;
      }
    });
  }

  // Initialize
  fetchOverviewData();
});
