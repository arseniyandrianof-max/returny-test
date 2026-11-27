import { resolveInput } from './engine.mjs';
import { checkApple } from './apple.mjs';

const form = document.querySelector('#finder');
const query = document.querySelector('#query');
const region = document.querySelector('#region');
const notice = document.querySelector('#notice');
const panel = document.querySelector('#panel');
const iconKeys = new Set(['sber', 'tbank', 'alfa', 'vk', 'max', 'avito', 'mail', 'yandex-pay']);
const featured = ['sber', 'tbank', 'vk', 'max'];
let catalog;
let controller;

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function button(text, className, handler) {
  const item = node('button', text, className);
  item.type = 'button';
  item.addEventListener('click', handler);
  return item;
}

function link(text, href, className) {
  const item = node('a', text, className);
  item.href = href;
  item.rel = 'noreferrer';
  return item;
}

function symbol(group) {
  const item = node('span', '', 'symbol');
  item.setAttribute('aria-hidden', 'true');
  if (iconKeys.has(group.key)) {
    const img = node('img');
    img.src = './icons/group-' + group.key + '.png';
    img.alt = '';
    img.addEventListener('error', () => item.replaceChildren(group.title.slice(0, 1)), {once: true});
    item.append(img);
  } else {
    item.textContent = group.title.slice(0, 1);
  }
  return item;
}

function tiles(groups) {
  const list = node('ul', '', 'catalog');
  for (const group of groups) {
    const item = node('li');
    const tile = button('', 'tile', () => {
      query.value = group.title;
      render({live: true, focus: true});
    });
    const arrow = node('span', '›', 'chevron');
    arrow.setAttribute('aria-hidden', 'true');
    tile.append(symbol(group), node('span', group.title), arrow);
    item.append(tile);
    list.append(item);
  }
  return list;
}

function details(label, className) {
  const item = node('details', '', className);
  item.append(node('summary', label));
  return item;
}

function showHome() {
  const quick = featured.map(key => catalog.groups.find(group => group.key === key)).filter(Boolean);
  const other = catalog.groups.filter(group => !quick.includes(group));
  const heading = node('h2', 'Быстрый выбор', 'section-title');
  panel.append(heading, tiles(quick.length ? quick : other));
  if (other.length && quick.length) {
    const rest = details('Ещё приложения', 'more');
    rest.append(tiles(other));
    panel.append(rest);
  }
}

function purchaseSteps() {
  const block = details('Как найти в своих покупках', 'history');
  const steps = node('ol');
  for (const text of [
    'Откройте App Store на iPhone и нажмите фото профиля.',
    'Перейдите в «Приложения и история покупок» → «Мои приложения» → «Не на этом iPhone».',
    'Найдите нужное название и нажмите значок облака, если он есть.',
  ]) steps.append(node('li', text));
  block.append(steps, link('Инструкция Apple', 'https://support.apple.com/ru-ru/102417', 'footlink'));
  return block;
}

function resultCard(title, group) {
  panel.append(button('‹ К каталогу', 'back', () => {
    query.value = '';
    render();
    query.focus();
  }));
  const card = node('section', '', 'result');
  const heading = node('div', '', 'result-title');
  if (group) heading.append(symbol(group));
  const label = node('h2', title);
  label.tabIndex = -1;
  heading.append(label);
  card.append(heading);
  panel.append(card);
  return card;
}

function storeRoutes(card, apps) {
  for (const app of apps) {
    const route = node('div', '', 'route');
    const action = link('Открыть в App Store', app.url, 'primary');
    action.setAttribute('aria-label', app.title + ' — открыть в App Store');
    route.append(node('p', app.title), action);
    card.append(route);
  }
}

function showApp(result, fresh) {
  const {group, releases = [], available = [], publisher, direct} = result;
  const country = region.value === 'ru' ? 'России' : 'Испании';
  if (!group && direct) {
    const app = available[0];
    const card = resultCard(app?.title ?? 'Приложение ' + direct.id);
    if (app) {
      card.append(node('p', 'Найдено в App Store для ' + country + '.'),
        link('Открыть в App Store', app.url, 'primary'));
    } else {
      card.append(node('p', fresh ? 'В публичном каталоге Apple для ' + country + ' карточки с этим ID не нашлось.' :
        'Вы можете проверить этот ID в App Store на своём iPhone.'),
        link('Проверить в App Store', direct.url, 'primary'));
    }
    if (!app && result.search) card.append(link('Искать «' + direct.id + '» как название', result.search.url, 'footlink'));
    card.append(purchaseSteps());
    return;
  }
  const title = releases.length === 1 ? releases[0].title : group.title;
  const card = resultCard(title, group);
  if (available.length) {
    storeRoutes(card, available);
  } else {
    card.append(node('p', 'В публичном каталоге App Store для ' + country + ' карточки для iPhone не нашлось.'));
    card.append(node('p', 'Проверьте свои покупки. Если там тоже нет кнопки загрузки, у returny нет прямой ссылки на установку из App Store.'));
  }
  if (fresh) {
    card.append(node('p', 'Проверено сейчас · App Store для ' + country, 'caption'));
  } else if (catalog.checkedAt) {
    const checked = new Date(catalog.checkedAt);
    if (!Number.isNaN(checked.getTime())) {
      card.append(node('p', 'Проверено по каталогу Apple · ' + checked.toLocaleDateString('ru-RU', {timeZone: 'UTC'}), 'caption'));
    }
  }
  if (publisher) {
    const route = node('div', '', 'publisher route');
    route.append(node('h3', publisher.label, 'route-title'), node('p', publisher.condition),
      link('Открыть сайт издателя', publisher.url, 'primary'));
    card.append(route);
  }
  if (releases.length > 1) {
    const names = details('Названия для поиска в покупках', 'history');
    const list = node('ul', '', 'names');
    for (const release of releases) list.append(node('li', release.title));
    names.append(list);
    card.append(names);
  }
  card.append(purchaseSteps());
}

function showSearch(result, freshApps) {
  const card = resultCard(query.value.trim());
  if (freshApps?.length) {
    const country = region.value === 'ru' ? 'России' : 'Испании';
    card.append(node('p', 'Результаты поиска в App Store для ' + country, 'caption'));
    storeRoutes(card, freshApps);
    card.append(link('Все результаты в App Store', result.search.url, 'footlink'));
  } else {
    card.append(node('p', freshApps ? 'Публичный поиск Apple не нашёл приложений. Попробуйте другое название или проверьте свои покупки.' :
      'Можно продолжить поиск по этому названию в выбранном магазине.'),
      link('Поиск в App Store', result.search.url, 'primary'));
  }
  card.append(purchaseSteps());
}

async function render({live = false, focus = false} = {}) {
  controller?.abort();
  controller = undefined;
  if (!catalog) return;
  const result = resolveInput(query.value, region.value, catalog);
  panel.replaceChildren();
  notice.textContent = '';
  let freshApps;
  if (live && ['app', 'query', 'matches'].includes(result.kind)) {
    const active = new AbortController();
    controller = active;
    const timer = setTimeout(() => active.abort(), 8000);
    notice.textContent = 'Проверяем App Store…';
    try {
      const lookup = result.kind !== 'app' ? {term: query.value.trim()} :
        {ids: result.direct ? [result.direct.id] : result.releases.map(release => release.id)};
      freshApps = await checkApple({...lookup, country: region.value, signal: active.signal});
      if (controller !== active) return;
      notice.textContent = '';
    } catch {
      if (controller !== active) return;
      notice.textContent = 'Не удалось обновить данные Apple.';
    } finally {
      clearTimeout(timer);
      if (controller === active) controller = undefined;
    }
  }
  switch (result.kind) {
    case 'empty':
      showHome();
      break;
    case 'invalid':
      notice.textContent = 'Введите название приложения, его числовой ID или ссылку с apps.apple.com.';
      query.focus();
      return;
    case 'matches':
      panel.append(node('h2', 'Из каталога returny', 'section-title'), tiles(result.groups));
      showSearch(result, freshApps);
      break;
    case 'app':
      showApp(freshApps ? {...result, available: freshApps} : result, freshApps !== undefined);
      break;
    case 'query':
      showSearch(result, freshApps);
      break;
  }
  if (focus) {
    const heading = panel.querySelector('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  query.blur();
  render({live: true, focus: true});
});
region.addEventListener('change', () => render({live: true, focus: Boolean(query.value.trim())}));
query.addEventListener('input', () => {
  controller?.abort();
  controller = undefined;
  notice.textContent = '';
  if (!catalog) return;
  panel.replaceChildren();
  showHome();
});

async function load() {
  panel.replaceChildren();
  notice.textContent = 'Загружаем каталог…';
  const loading = new AbortController();
  const timer = setTimeout(() => loading.abort(), 8000);
  try {
    const response = await fetch('./catalog.json', {cache: 'no-cache', signal: loading.signal});
    if (!response.ok) throw new Error('catalog');
    catalog = await response.json();
    const key = new URLSearchParams(location.search).get('app');
    const selected = catalog.groups.find(group => group.key === key);
    if (selected) query.value = selected.title;
    render({live: Boolean(selected)});
  } catch {
    catalog = undefined;
    notice.textContent = 'Не удалось загрузить каталог returny. Проверьте подключение.';
    panel.replaceChildren(button('Повторить', 'retry', load));
  } finally {
    clearTimeout(timer);
  }
}

load();
