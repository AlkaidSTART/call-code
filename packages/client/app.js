const DATA_URLS = ['./data.json', './data.example.json'];
const THEME_KEY = 'call-code-theme';

const state = {
  data: null,
  sessions: [],
  activeId: null,
  query: '',
  filter: 'all',
  theme: localStorage.getItem(THEME_KEY) || 'dark',
};

const app = document.getElementById('app');

const applyTheme = () => {
  document.documentElement.dataset.theme = state.theme;
};

const toggleTheme = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, state.theme);
  applyTheme();
  render();
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }
  return element;
};

const formatTime = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const entryText = (entry) => {
  if (entry.text) {
    return entry.text;
  }
  if (entry.payload && typeof entry.payload === 'object' && 'content' in entry.payload) {
    const content = entry.payload.content;
    if (typeof content === 'string') {
      return content;
    }
  }
  return '';
};

const entryRole = (entry) => entry.role || entry.type || 'assistant';

const getSessionTitle = (session) => {
  const firstUser = session.entries.find((entry) => entryRole(entry) === 'user');
  if (firstUser) {
    const text = entryText(firstUser).trim();
    if (text) {
      return text;
    }
  }
  const objective = session.metadata?.objective;
  if (typeof objective === 'string' && objective.trim()) {
    return objective;
  }
  return session.id;
};

const getSessionMode = (session) => {
  const mode = session.metadata?.mode;
  return typeof mode === 'string' ? mode : 'build';
};

const getEntryCount = (session, role) =>
  role ? session.entries.filter((entry) => entryRole(entry) === role).length : session.entries.length;

const matchesQuery = (session) => {
  const query = state.query.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const haystack = [session.id, session.cwd, getSessionTitle(session)].map((value) => value.toLowerCase());
  for (const entry of session.entries) {
    haystack.push(entryText(entry).toLowerCase());
    if (entry.tool) {
      haystack.push(entry.tool.toLowerCase());
    }
  }
  return haystack.some((value) => value.includes(query));
};

const filteredSessions = () =>
  state.sessions.filter((session) => matchesQuery(session));

const activeSession = () => {
  const sessions = filteredSessions();
  return sessions.find((session) => session.id === state.activeId) || sessions[0] || null;
};

const filteredEntries = (session) => {
  if (state.filter === 'all') {
    return session.entries;
  }
  return session.entries.filter((entry) => entryRole(entry) === state.filter);
};

const renderStats = (sessions) => ({
  sessions: sessions.length,
  messages: sessions.reduce((sum, session) => sum + session.entries.length, 0),
  tools: sessions.reduce(
    (sum, session) => sum + session.entries.filter((entry) => entryRole(entry) === 'tool').length,
    0,
  ),
});

const renderSidebar = (sessions) => {
  const sidebar = createElement('aside', 'panel sidebar');

  const header = createElement('div', 'sidebar-header');
  const brandRow = createElement('div', 'brand-row');
  const brand = createElement('div', 'brand');
  brand.append(createElement('span', 'brand-mark', 'CC'));
  const brandText = createElement('span', 'muted', 'Call Code');
  brand.append(brandText);

  const themeButton = createElement('button', 'theme-toggle', state.theme === 'dark' ? '☀' : '◐');
  themeButton.setAttribute('aria-label', state.theme === 'dark' ? '切换到白色毛玻璃主题' : '切换到高级黑主题');
  themeButton.addEventListener('click', toggleTheme);
  brandRow.append(brand, themeButton);

  const searchBox = createElement('div', 'search-box');
  const searchIcon = createElement('span', 'faint', '⌕');
  const searchInput = createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = '搜索会话';
  searchInput.value = state.query;
  searchInput.setAttribute('aria-label', '搜索会话');
  searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });
  searchBox.append(searchIcon, searchInput);

  const stats = renderStats(sessions);
  const metaStats = createElement('div', 'meta-stats');
  const statDefs = [
    ['会话', stats.sessions],
    ['消息', stats.messages],
    ['工具', stats.tools],
  ];
  for (const [label, value] of statDefs) {
    const cell = createElement('div', 'stat-cell');
    cell.append(createElement('div', 'stat-value', value));
    cell.append(createElement('div', 'stat-label', label));
    metaStats.append(cell);
  }

  header.append(brandRow, searchBox, metaStats);
  sidebar.append(header);

  const list = createElement('div', 'session-list');
  if (sessions.length === 0) {
    list.append(createElement('div', 'empty-state', '暂无会话'));
  } else {
    for (const session of sessions) {
      const button = createElement('button', 'session-item');
      if (session.id === state.activeId) {
        button.classList.add('active');
      }
      button.append(createElement('div', 'session-title', getSessionTitle(session)));
      const sub = createElement('div', 'session-sub');
      const meta = createElement('span', '', `${getSessionMode(session).toUpperCase()} · ${session.entries.length} 条`);
      const time = createElement('span', '', formatTime(session.createdAt));
      sub.append(meta, time);
      button.append(sub);
      button.addEventListener('click', () => {
        state.activeId = session.id;
        render();
      });
      list.append(button);
    }
  }

  sidebar.append(list);
  return sidebar;
};

const renderMessage = (entry) => {
  const role = entryRole(entry);
  const message = createElement('div', `message ${role}`);
  const avatar = createElement('div', 'message-avatar', role === 'user' ? 'U' : role === 'assistant' ? 'A' : 'T');
  message.append(avatar);

  const body = createElement('div', 'message-body');
  const head = createElement('div', 'message-head');
  const label = createElement('div', 'message-label');
  label.append(createElement('span', '', role === 'user' ? '用户' : role === 'assistant' ? '助手' : '工具'));
  if (entry.tool) {
    label.append(createElement('span', 'pill', entry.tool));
  }
  head.append(label, createElement('div', 'message-time', formatTime(entry.timestamp)));
  body.append(head);

  const text = entryText(entry);
  if (role === 'tool' || text.length > 320) {
    body.append(createElement('pre', 'code-block', text));
  } else {
    body.append(createElement('div', 'message-content', text));
  }

  message.append(body);
  return message;
};

const renderFacts = (session) => {
  if (!Array.isArray(session.facts) || session.facts.length === 0) {
    return null;
  }
  const grid = createElement('div', 'fact-grid');
  for (const fact of session.facts.slice(0, 12)) {
    const cell = createElement('div', 'fact-cell');
    cell.append(createElement('div', 'fact-kind', fact.kind));
    cell.append(createElement('div', 'fact-value', fact.value || fact.key || String(fact.seq)));
    grid.append(cell);
  }
  return grid;
};

const renderMain = (session) => {
  const main = createElement('main', 'panel main');

  const header = createElement('div', 'main-header');
  const titleWrap = createElement('div');
  titleWrap.append(createElement('h1', 'main-title', session ? getSessionTitle(session) : 'Call Code'));
  const meta = createElement('div', 'main-meta');
  if (session) {
    const stats = session.stats || {};
    const pills = [
      getSessionMode(session).toUpperCase(),
      `${session.entries.length} 条消息`,
      `tokens ${stats.totalTokens ?? 0}`,
      session.cwd,
    ];
    for (const pill of pills) {
      meta.append(createElement('span', 'pill', pill));
    }
  }
  titleWrap.append(meta);
  header.append(titleWrap);

  const toolbar = createElement('div', 'toolbar');
  const segmented = createElement('div', 'segmented');
  const filters = [
    ['all', '全部'],
    ['user', '用户'],
    ['assistant', '助手'],
    ['tool', '工具'],
  ];
  for (const [value, label] of filters) {
    const button = createElement('button', state.filter === value ? 'active' : '', label);
    button.addEventListener('click', () => {
      state.filter = value;
      render();
    });
    segmented.append(button);
  }
  toolbar.append(segmented);

  const messages = createElement('div', 'messages');
  if (!session) {
    messages.append(createElement('div', 'empty-state', '暂无会话数据'));
  } else {
    const entries = filteredEntries(session);
    if (entries.length === 0) {
      messages.append(createElement('div', 'empty-state', '没有匹配的消息'));
    } else {
      for (const entry of entries) {
        messages.append(renderMessage(entry));
      }
      const facts = renderFacts(session);
      if (facts) {
        messages.append(facts);
      }
    }
  }

  main.append(header, toolbar, messages);
  return main;
};

const render = () => {
  app.className = 'app-shell';
  app.innerHTML = '';
  const sessions = filteredSessions();
  const session = activeSession();
  app.append(renderSidebar(sessions), renderMain(session));
};

const renderLoadError = () => {
  app.className = 'app-shell';
  app.innerHTML = '';
  const panel = createElement('div', 'panel main');
  const empty = createElement('div', 'empty-state', '无法读取会话数据');
  panel.append(empty);
  app.append(createElement('aside', 'panel sidebar', 'Call Code'), panel);
};

const init = async () => {
  applyTheme();
  for (const url of DATA_URLS) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      if (data && Array.isArray(data.sessions)) {
        state.data = data;
        state.sessions = data.sessions;
        state.activeId = data.sessions[0]?.id || null;
        render();
        return;
      }
    } catch {
      // 继续尝试下一个数据源
    }
  }
  renderLoadError();
};

init();
