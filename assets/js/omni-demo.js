/* Simulate the userscript's export formats without creating files. */
(() => {
  const view = document.querySelector('.omni-manual-view');
  if (!view) return;

  const frame = view.closest('.omni-frame');
  const content = view.querySelector('[data-omni-preview-content]');
  const filename = view.querySelector('[data-omni-preview-name]');
  const close = view.querySelector('[data-omni-preview-close]');
  const scroll = view.querySelector('.omni-manual-scroll');
  const metadata = {
    url: 'https://claude.ai/chat/example',
    exportedAt: '2026-10-30T12:00:00.000Z',
    conversationTitle: 'Project review'
  };
  const messages = [
    {
      role: 'user',
      text: 'Make this workflow easier to reuse.',
      html: '<p>Make this workflow easier to reuse.</p>'
    },
    {
      role: 'assistant',
      text: 'Here is a clean, portable structure.\n\n# Project review\n\n## Reusable workflow\n- Clear steps\n- Portable notes\n\nSave the result and share it with your team.',
      html: '<p>Here is a clean, portable structure.</p><pre><code class="language-markdown"># Project review\n\n## Reusable workflow\n- Clear steps\n- Portable notes</code></pre><p>Save the result and share it with your team.</p>'
    }
  ];
  let trigger;

  window.addEventListener('drewx-omni-export', ({ detail }) => {
    const { format, scope } = detail || {};
    if (!['pdf', 'markdown', 'txt', 'json'].includes(format)) return;

    trigger = frame.querySelector(scope === 'inline' ? '.omni-inline-export' : '.omni-export-button');
    const selectedMessages = scope === 'inline' ? messages.slice(1) : messages;
    const header = `Conversation: ${metadata.conversationTitle}\nURL: ${metadata.url}\nExported: ${metadata.exportedAt}`;
    filename.textContent = `Project-review.${format === 'markdown' ? 'md' : format}`;
    content.replaceChildren();

    if (format === 'pdf') {
      const paper = frame.querySelector('.omni-pdf-paper').cloneNode(true);
      if (scope === 'inline') paper.querySelector('.pdf-user')?.remove();
      content.append(paper);
    } else {
      const text = document.createElement('pre');
      text.className = 'omni-manual-text';
      if (format === 'json') {
        text.textContent = JSON.stringify({ ...metadata, messages: selectedMessages }, null, 2);
      } else if (format === 'markdown') {
        const markdownMessages = selectedMessages.map(message => {
          const body = message.role === 'assistant'
            ? 'Here is a clean, portable structure.\n\n```markdown\n# Project review\n\n## Reusable workflow\n- Clear steps\n- Portable notes\n```\n\nSave the result and share it with your team.'
            : message.text;
          return `## ${message.role[0].toUpperCase() + message.role.slice(1)}\n\n${body}`;
        });
        text.textContent = `# Claude Export\nConversation: ${metadata.conversationTitle}  \nURL: ${metadata.url}  \nExported: ${metadata.exportedAt}\n\n${markdownMessages.join('\n\n')}\n`;
      } else {
        text.textContent = `Claude Export\n${header}\n\n${selectedMessages.map(message => `${message.role[0].toUpperCase() + message.role.slice(1)}:\n${message.text}`).join('\n\n')}\n`;
      }
      content.append(text);
    }

    view.hidden = false;
    scroll.scrollTop = 0;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      view.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'ease-out' });
    }
    close.focus({ preventScroll: true });
  });

  close.addEventListener('click', () => {
    view.hidden = true;
    trigger?.focus({ preventScroll: true });
  });
})();
