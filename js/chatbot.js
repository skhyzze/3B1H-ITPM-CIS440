(function () {
  'use strict';

  if (document.querySelector('[data-lab-chat]')) return;

  const externalConfig = window.LAB_CHAT_CONFIG || {};
  const config = {
    endpoint: typeof externalConfig.endpoint === 'string' ? externalConfig.endpoint : '',
    requestTimeout: Number(externalConfig.requestTimeout) || 12000
  };

  const pageLinks = {
    home: 'index.html',
    fellowship: 'fellowship.html',
    outcomes: 'studentoutcomes.html',
    events: 'event.html',
    industry: 'industry.html',
    involved: 'index.html#opportunities'
  };

  const mockAnswers = [
    {
      pattern: /\b(hello|hi|hey|good morning|good afternoon)\b/i,
      answer: 'Hi! I can help you explore the Applied AI Lab, student projects, fellowships, events, and ways to get involved.'
    },
    {
      pattern: /\b(fellow|fellowship|pathway|eligib|application|apply)\b/i,
      answer: 'The Fellowship Pathway introduces the student experience and current fellows. Eligibility, timeline, and commitment details are still awaiting client confirmation.',
      link: { label: 'Explore the Fellowship Pathway', href: pageLinks.fellowship }
    },
    {
      pattern: /\b(event|events|workshop|workshops|talk|speaker|calendar|idea lab)\b/i,
      answer: 'The Events page is the best place to find Lab workshops, research events, talks, and Idea Lab sessions.',
      link: { label: 'View Lab events', href: pageLinks.events }
    },
    {
      pattern: /\b(project|projects|student outcome|student outcomes|showcase|cis 440|blockchain|avatar|vr tour)\b/i,
      answer: 'Student Outcomes showcases approved student projects, collaborative work, and achievements connected to the Lab.',
      link: { label: 'Explore Student Outcomes', href: pageLinks.outcomes }
    },
    {
      pattern: /\b(industry|partner|partners|company|companies|organization|collaborate)\b/i,
      answer: 'The Industry Partners page explains how organizations can bring real challenges, professional perspectives, and collaboration opportunities into the Lab.',
      link: { label: 'Explore Industry Partners', href: pageLinks.industry }
    },
    {
      pattern: /\b(join|participate|involved|opportunit|student|faculty|propose)\b/i,
      answer: 'Students can attend events, join or propose projects, explore resources, and collaborate with faculty. Faculty can develop research, mentor students, and connect coursework with Lab initiatives.',
      link: { label: 'See ways to get involved', href: pageLinks.involved }
    },
    {
      pattern: /\b(contact|email|phone|reach|who runs|director)\b/i,
      answer: 'A confirmed public contact method is not available in the current site content yet. The Get Involved section is the best available starting point.',
      link: { label: 'Go to Get Involved', href: pageLinks.involved }
    },
    {
      pattern: /\b(what is|about|purpose|applied ai lab|the lab|artificial intelligence)\b/i,
      answer: 'The Applied AI Lab is a collaborative environment for exploring artificial intelligence through experimentation, research, technical projects, and interdisciplinary problem-solving.',
      link: { label: 'Learn about the Lab', href: pageLinks.home }
    }
  ];

  const root = document.createElement('div');
  root.dataset.labChat = '';
  root.innerHTML = [
    '<button class="lab-chat-launcher" type="button" aria-expanded="false" aria-controls="labChatPanel">Ask the Lab</button>',
    '<section class="lab-chat-panel" id="labChatPanel" role="dialog" aria-modal="false" aria-labelledby="labChatTitle" hidden>',
    '  <header class="lab-chat-header">',
    '    <div class="lab-chat-title">',
    '      <strong id="labChatTitle">Ask the Lab</strong>',
    '      <span class="lab-chat-status">' + (config.endpoint ? 'Connected' : 'Demo mode - approved site content') + '</span>',
    '    </div>',
    '    <button class="lab-chat-close" type="button" aria-label="Close chat">&times;</button>',
    '  </header>',
    '  <div class="lab-chat-messages" aria-live="polite" aria-relevant="additions text"></div>',
    '  <form class="lab-chat-form">',
    '    <label class="lab-chat-visually-hidden" for="labChatInput">Ask a question about the Applied AI Lab</label>',
    '    <input class="lab-chat-input" id="labChatInput" name="message" type="text" maxlength="500" autocomplete="off" placeholder="Ask about the Lab..." required>',
    '    <button class="lab-chat-send" type="submit">Send</button>',
    '  </form>',
    '</section>'
  ].join('');
  document.body.appendChild(root);

  const launcher = root.querySelector('.lab-chat-launcher');
  const panel = root.querySelector('.lab-chat-panel');
  const closeButton = root.querySelector('.lab-chat-close');
  const messages = root.querySelector('.lab-chat-messages');
  const form = root.querySelector('.lab-chat-form');
  const input = root.querySelector('.lab-chat-input');
  const sendButton = root.querySelector('.lab-chat-send');
  let initialized = false;
  let busy = false;

  function addMessage(role, text, link) {
    const message = document.createElement('div');
    const label = document.createElement('span');
    const bubble = document.createElement('div');

    message.className = 'lab-chat-message';
    message.dataset.role = role;
    label.className = 'lab-chat-message-label';
    label.textContent = role === 'user' ? 'You' : 'Lab assistant';
    bubble.className = 'lab-chat-bubble';
    bubble.textContent = text;

    if (link && link.href && link.label) {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.label + ' \u2192';
      bubble.appendChild(document.createElement('br'));
      bubble.appendChild(anchor);
    }

    message.appendChild(label);
    message.appendChild(bubble);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  }

  function addSuggestions() {
    const suggestions = document.createElement('div');
    suggestions.className = 'lab-chat-suggestions';
    suggestions.setAttribute('aria-label', 'Suggested questions');

    [
      'What is the Lab?',
      'How can I get involved?',
      'Show me student projects',
      'Tell me about fellowships'
    ].forEach(function (question) {
      const button = document.createElement('button');
      button.className = 'lab-chat-suggestion';
      button.type = 'button';
      button.textContent = question;
      button.addEventListener('click', function () {
        submitQuestion(question);
      });
      suggestions.appendChild(button);
    });

    messages.appendChild(suggestions);
  }

  function initializeChat() {
    if (initialized) return;
    initialized = true;
    addMessage(
      'assistant',
      config.endpoint
        ? 'Welcome! Ask me a question about the Applied AI Lab.'
        : 'Welcome! This demo uses approved information already published on the Lab website. It is not connected to Grok yet.'
    );
    addSuggestions();
  }

  function openChat() {
    initializeChat();
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    window.requestAnimationFrame(function () {
      input.focus();
    });
  }

  function closeChat() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  function getMockAnswer(question) {
    const match = mockAnswers.find(function (item) {
      return item.pattern.test(question);
    });

    if (match) return match;

    return {
      answer: 'I can only answer questions supported by the current Applied AI Lab website. Try asking about the Lab, fellowships, events, student projects, industry partners, or ways to get involved.'
    };
  }

  async function getConnectedAnswer(question) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () {
      controller.abort();
    }, config.requestTimeout);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          page: window.location.pathname.split('/').pop() || 'index.html'
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error('Chat request failed');
      const data = await response.json();
      if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('Chat response was invalid');
      }

      return { answer: data.answer.trim() };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function submitQuestion(rawQuestion) {
    const question = String(rawQuestion || '').trim();
    if (!question || busy) return;

    busy = true;
    input.value = '';
    input.disabled = true;
    sendButton.disabled = true;
    addMessage('user', question);

    const typing = addMessage('assistant', 'Checking the available Lab information...');
    typing.classList.add('lab-chat-typing');

    try {
      let reply;
      if (config.endpoint) {
        reply = await getConnectedAnswer(question);
      } else {
        await new Promise(function (resolve) { window.setTimeout(resolve, 280); });
        reply = getMockAnswer(question);
      }

      typing.remove();
      addMessage('assistant', reply.answer, reply.link);
    } catch (error) {
      typing.remove();
      addMessage('assistant', 'The Lab assistant is temporarily unavailable. You can still use the website navigation to explore the Lab.');
    } finally {
      busy = false;
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener('click', function () {
    if (panel.hidden) openChat();
    else closeChat();
  });

  closeButton.addEventListener('click', closeChat);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    submitQuestion(input.value);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) closeChat();
  });
})();
