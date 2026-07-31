import {
  TOTAL_ROUNDS,
  createSessionContext,
  createRoundOrder,
  generateRound,
  scoreDecision,
  stageForLevel,
} from './game.js'
import {analyzeSession, summarizeDecisions} from './analysis.js'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const CURRENT_USER_KEY = 'intuiflix-current-user'

const state = {
  screen: 'home',
  user: null,
  history: [],
  gameCatalog: [],
  comparisonHistory: [],
  order: [],
  decisions: [],
  currentRound: null,
  sessionContext: null,
  roundIndex: 0,
  roundStartedAt: 0,
  timerFrame: null,
  visualTimer: null,
  revealTimer: null,
  transitionTimer: null,
  score: 0,
  streak: 0,
  longestStreak: 0,
  acceptingAnswer: false,
  muted: false,
  audioContext: null,
  analysis: null,
}

const accents = {
  red: 'var(--dsg-color__brand__highlight)',
  blue: 'var(--dsg-color__data__blue)',
  violet: 'var(--dsg-color__data__violet)',
  amber: 'var(--dsg-color__signal__warning)',
  green: 'var(--dsg-color__signal__success)',
}

const ballColors = {
  red: 'var(--dsg-color__brand__highlight)',
  blue: 'var(--dsg-color__data__blue)',
  amber: 'var(--dsg-color__signal__warning)',
}

const catalogArt = {
  cards: '<i></i><i></i><i></i><i></i>',
  dice: '<i>•</i><i>••</i><i>•••</i>',
  bag: '<i></i><i></i><i></i><i></i><i></i>',
  boxes: '<i style="--ratio:64%"></i><i style="--ratio:58%"></i>',
  dots: '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>',
  fireflies: '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>',
  hands: '<i>G</i><span>?</span><i>D</i>',
  doors: '<i>A</i><i>B</i><i>C</i>',
  path: '<i></i><i></i><i></i><span></span>',
  risk: '<i></i><i></i><i></i><i></i><span>?</span>',
}

const catalogArtClass = {
  cards: 'card-art',
  dice: 'dice-art',
  bag: 'bag-art',
  boxes: 'ratio-art',
  dots: 'dots-art',
  fireflies: 'fireflies-art',
  hands: 'hands-art',
  doors: 'doors-art',
  path: 'path-art',
  risk: 'risk-art',
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function illustrationMarkup(game) {
  const art = catalogArt[game.illustration] || catalogArt.cards
  const artClass = catalogArtClass[game.illustration] || catalogArtClass.cards
  return `<div class="catalog-art ${artClass}" aria-hidden="true">${art}</div>`
}

function renderGameCatalog() {
  const container = $('[data-game-catalog]')
  container.innerHTML = state.gameCatalog.map((game) => `
    <button
      class="catalog-card card-${escapeHTML(game.id)}"
      type="button"
      data-game-card="${escapeHTML(game.id)}"
      data-dsg-component="feature-card"
      aria-haspopup="dialog"
      aria-label="Découvrir ${escapeHTML(game.title)}"
    >
      <span class="card-index">${escapeHTML(game.number)}</span>
      ${illustrationMarkup(game)}
      <p>${escapeHTML(game.eyebrow)}</p>
      <h3>${escapeHTML(game.title)}</h3>
      <span class="card-tagline">${escapeHTML(game.tagline)}</span>
    </button>
  `).join('')
}

async function loadGameCatalog() {
  const container = $('[data-game-catalog]')
  try {
    const response = await fetch('/data/games.json', {cache: 'no-store'})
    if (!response.ok) throw new Error('Catalogue indisponible')
    const payload = await response.json()
    if (!Array.isArray(payload.games) || !payload.games.length) throw new Error('Catalogue vide')
    state.gameCatalog = payload.games
    renderGameCatalog()
  } catch {
    container.innerHTML = '<p class="catalog-loading is-error">La collection ne peut pas être chargée pour le moment.</p>'
  }
}

function openGameDetails(gameId) {
  const game = state.gameCatalog.find((candidate) => candidate.id === gameId)
  if (!game) return
  const panel = $('.game-detail-panel')
  state.gameCatalog.forEach((candidate) => panel.classList.remove(`card-${candidate.id}`))
  panel.classList.add(`card-${game.id}`)
  $('[data-game-detail-number]').textContent = game.number
  $('[data-game-detail-art]').innerHTML = illustrationMarkup(game)
  $('[data-game-detail-measure]').textContent = game.measures
  $('[data-game-detail-eyebrow]').textContent = game.eyebrow
  $('[data-game-detail-title]').textContent = game.title
  $('[data-game-detail-description]').textContent = game.description
  $('[data-game-detail-duration]').textContent = game.duration
  $('[data-game-detail-instructions]').innerHTML = game.instructions
    .map((instruction) => `<li>${escapeHTML(instruction)}</li>`)
    .join('')
  openModal('game-detail')
}

function showScreen(name) {
  state.screen = name
  $$('[data-screen]').forEach((screen) => {
    const active = screen.dataset.screen === name
    screen.hidden = !active
    screen.classList.toggle('is-active', active)
  })
  window.scrollTo({top: 0, behavior: 'instant'})
  document.title = name === 'home'
    ? 'Intuiflix — L’instinct en chiffres'
    : `${name === 'game' ? 'Session' : name === 'results' ? 'Résultats' : 'Analyse'} — Intuiflix`
}

function openModal(name) {
  closeModals()
  const modal = $(`[data-modal="${name}"]`)
  if (!modal) return
  modal.hidden = false
  document.body.style.overflow = 'hidden'
  requestAnimationFrame(() => {
    const focusTarget = $('input, button:not(.modal-close)', modal)
    focusTarget?.focus()
  })
}

function closeModals() {
  $$('[data-modal]').forEach((modal) => { modal.hidden = true })
  document.body.style.overflow = ''
  $('[data-login-error]').hidden = true
}

function showToast(message) {
  const toast = $('[data-toast]')
  toast.textContent = message
  toast.hidden = false
  window.clearTimeout(showToast.timeout)
  showToast.timeout = window.setTimeout(() => { toast.hidden = true }, 3200)
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', ...(options.headers || {})},
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Le service local ne répond pas.')
  return payload
}

function historyKey() {
  return state.user ? `intuiflix:${state.user.username}:history` : 'intuiflix:anonymous:history'
}

function readLocalHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey()) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeLocalHistory(entry) {
  try {
    const history = readLocalHistory()
    history.push(entry)
    localStorage.setItem(historyKey(), JSON.stringify(history.slice(-80)))
  } catch {
    // A completed session remains visible even when browser storage is unavailable.
  }
}

function readRememberedUser() {
  try {
    const user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null')
    return user && typeof user.username === 'string' && typeof user.displayName === 'string'
      ? user
      : null
  } catch {
    return null
  }
}

function rememberUser(user) {
  try {
    if (user) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(CURRENT_USER_KEY)
  } catch {
    // The server session remains usable when browser storage is unavailable.
  }
}

async function loadHistory() {
  if (!state.user) {
    state.history = []
    updateUserInterface()
    return
  }
  try {
    const payload = await api('/api/history')
    state.history = Array.isArray(payload.history) ? payload.history : []
  } catch {
    state.history = readLocalHistory()
  }
  updateUserInterface()
}

function updateUserInterface() {
  const record = state.history.reduce((maximum, session) => Math.max(maximum, Number(session.score) || 0), 0)
  const navRecord = $('[data-nav-record]')
  if (state.user) {
    navRecord.innerHTML = `<span>Record de ${state.user.displayName}</span><strong>${record.toLocaleString('fr-FR')} pts</strong>`
    $('[data-avatar-initial]').textContent = state.user.displayName.charAt(0).toUpperCase()
    $('.profile-avatar').setAttribute('aria-label', `Profil de ${state.user.displayName}`)
    $('[data-profile-name]').textContent = state.user.displayName
    $('[data-profile-username]').textContent = `@${state.user.username}`
    $('[data-player-prompt]').textContent = `${state.history.length} session${state.history.length > 1 ? 's' : ''} enregistrée${state.history.length > 1 ? 's' : ''} pour ${state.user.displayName}.`
  } else {
    navRecord.innerHTML = '<span>Profil joueur</span><strong>Se connecter</strong>'
    $('[data-avatar-initial]').textContent = '?'
    $('.profile-avatar').setAttribute('aria-label', 'Se connecter')
    $('[data-player-prompt]').textContent = 'Connecte ton profil pour conserver ton évolution.'
    $('[data-profile-menu]').hidden = true
  }
}

async function logIn(username) {
  const payload = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({username}),
  })
  state.user = payload.user
  rememberUser(state.user)
  await loadHistory()
  updateUserInterface()
}

async function logOut() {
  try {
    await api('/api/logout', {method: 'POST', body: '{}'})
  } catch {
    // Local UI logout still succeeds when the lightweight server is unavailable.
  }
  state.user = null
  rememberUser(null)
  state.history = []
  state.comparisonHistory = []
  updateUserInterface()
  showScreen('home')
}

function ensureAudio() {
  if (!state.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) state.audioContext = new AudioContext()
  }
  state.audioContext?.resume()
}

function playTone(kind) {
  if (state.muted) return
  ensureAudio()
  const context = state.audioContext
  if (!context) return
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = kind === 'success' ? 'sine' : kind === 'strategy' ? 'triangle' : 'sawtooth'
  oscillator.frequency.setValueAtTime(kind === 'success' ? 520 : kind === 'strategy' ? 360 : 150, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(kind === 'success' ? 820 : kind === 'strategy' ? 540 : 95, context.currentTime + 0.15)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.22)
}

function clearRoundTimers() {
  if (state.timerFrame) cancelAnimationFrame(state.timerFrame)
  window.clearTimeout(state.visualTimer)
  window.clearTimeout(state.revealTimer)
  window.clearTimeout(state.transitionTimer)
  state.timerFrame = null
  state.visualTimer = null
  state.revealTimer = null
  state.transitionTimer = null
}

function startGame() {
  closeModals()
  if (!state.user) {
    openModal('login')
    $('[data-login-form]').dataset.startAfterLogin = 'true'
    return
  }
  ensureAudio()
  clearRoundTimers()
  state.order = createRoundOrder()
  state.sessionContext = createSessionContext()
  state.decisions = []
  state.roundIndex = 0
  state.score = 0
  state.streak = 0
  state.longestStreak = 0
  state.analysis = null
  state.comparisonHistory = [...state.history]
  $('[data-live-score]').textContent = '0'
  $('[data-live-streak]').textContent = '0'
  showScreen('game')
  renderRound()
}

function renderRound() {
  clearRoundTimers()
  $('[data-feedback]').hidden = true
  const level = state.roundIndex + 1
  const round = generateRound(state.order[state.roundIndex], level, state.decisions, state.sessionContext)
  state.currentRound = round
  state.acceptingAnswer = true
  state.roundStartedAt = performance.now()

  const stage = stageForLevel(level)
  $('[data-round-current]').textContent = level
  $('[data-round-number]').textContent = String(level).padStart(2, '0')
  $('[data-stage-label]').textContent = `Phase ${stage.index} · ${stage.label}`
  $('[data-session-progress]').style.width = `${(level - 1) / TOTAL_ROUNDS * 100}%`
  $('[data-game-eyebrow]').textContent = round.meta.eyebrow
  $('[data-game-label]').textContent = round.meta.label
  $('[data-game-prompt]').textContent = round.prompt
  $('[data-supporting-text]').textContent = round.supportingText
  $('[data-difficulty-bar]').style.width = `${Math.max(8, round.difficulty * 100)}%`
  const accent = accents[round.meta.color]
  $('.game-screen').style.setProperty('--game-accent', accent)
  $('.challenge-card').style.setProperty('--game-accent', accent)
  $('.challenge-card').style.animation = 'none'
  void $('.challenge-card').offsetWidth
  $('.challenge-card').style.animation = ''

  renderGameVisual(round)
  renderChoices(round)
  updateTimer(1, round.durationMs)

  if (round.type === 'dots') {
    state.visualTimer = window.setTimeout(() => {
      $('.dots-cloud')?.classList.add('is-hidden')
    }, round.visual.visibleMs)
  }
  state.timerFrame = requestAnimationFrame(timerTick)
}

function renderChoices(round) {
  const container = $('[data-choices]')
  container.innerHTML = ''
  container.hidden = round.type === 'cards'
  if (round.type === 'cards') {
    $('[data-keyboard-hint]').textContent = round.choices.length === 10
      ? 'Touches 1–9 et 0 pour choisir'
      : `Touches 1–${round.choices.length} pour choisir`
    return
  }
  $('[data-keyboard-hint]').textContent = `Touches 1–${round.choices.length} pour répondre`
  round.choices.forEach((choice, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'choice-button'
    button.dataset.option = choice.id
    button.setAttribute('data-dsg-component', 'button')
    button.innerHTML = `<span class="choice-key">${index + 1}</span>${choice.label}`
    container.append(button)
  })
}

function renderGameVisual(round) {
  const visual = $('[data-game-visual]')
  if (round.type === 'cards') {
    visual.innerHTML = `<div class="hidden-cards">${round.choices.map((choice, index) => (
      `<button type="button" class="hidden-card" data-option="${choice.id}" data-card-index="${index}" aria-label="${choice.label}"></button>`
    )).join('')}</div>`
    return
  }
  if (round.type === 'dice') {
    visual.innerHTML = `
      <div class="dice-visual">
        <div class="dice-row">${round.visual.rolls.map(() => '<span class="die is-hidden">?</span>').join('')}</div>
        <div class="dice-reference">Valeur de référence<strong>${round.visual.reference}</strong></div>
      </div>`
    return
  }
  if (round.type === 'bag') {
    const dots = round.visual.colors.flatMap((color) => (
      [...Array(Math.min(color.count, 12))].map(() => (
        `<i class="bag-dot" style="--ball-color:${ballColors[color.id]}"></i>`
      ))
    )).join('')
    const legend = round.visual.colors.map((color) => (
      `<span><i style="--ball-color:${ballColors[color.id]}"></i><strong>${color.count}</strong> ${color.label.toLowerCase()}${color.count > 1 ? 's' : ''}</span>`
    )).join('')
    visual.innerHTML = `<div class="bag-visual"><div class="bag-shape">${dots}</div><div class="bag-legend">${legend}</div></div>`
    return
  }
  if (round.type === 'boxes') {
    const {left, right} = round.visual
    visual.innerHTML = `
      <div class="boxes-visual">
        <div class="box-option" data-box="left"><span>Boîte A</span><strong>${left.numerator}/${left.denominator}</strong><small>${left.numerator} gain${left.numerator > 1 ? 's' : ''} sur ${left.denominator}</small></div>
        <b class="versus">VS</b>
        <div class="box-option" data-box="right"><span>Boîte B</span><strong>${right.numerator}/${right.denominator}</strong><small>${right.numerator} gain${right.numerator > 1 ? 's' : ''} sur ${right.denominator}</small></div>
      </div>`
    return
  }
  if (round.type === 'dots') {
    visual.innerHTML = `<div class="dots-cloud">${round.visual.points.map((point) => (
      `<i class="dot-point" style="left:${point.x}%;top:${point.y}%;--point-size:${point.size}px;--point-color:${point.tone === 'red' ? 'var(--dsg-color__brand__highlight)' : 'var(--dsg-color__text__primary)'}"></i>`
    )).join('')}</div>`
    return
  }
  if (round.type === 'fireflies') {
    visual.innerHTML = `
      <div class="firefly-field">
        <div class="moon-haze"></div>
        ${round.visual.fireflies.map((firefly) => `
          <i class="firefly${firefly.bright ? ' is-bright' : ''}" style="left:${firefly.x}%;top:${firefly.y}%;--fly-x:${firefly.dx}%;--fly-y:${firefly.dy}px;--fly-size:${firefly.size}px;--fly-delay:${firefly.delay}s;--fly-duration:${firefly.duration}s"></i>
        `).join('')}
        <span class="firefly-gate gate-left" data-firefly-gate="left"><b>G</b></span>
        <span class="firefly-gate gate-center" data-firefly-gate="center"><b>C</b></span>
        <span class="firefly-gate gate-right" data-firefly-gate="right"><b>D</b></span>
      </div>`
    return
  }
  if (round.type === 'hands') {
    visual.innerHTML = `
      <div class="hands-scene${round.visual.shifted ? ' is-shifted' : ''}">
        <div class="behavior-history" aria-label="Historique des mains">
          ${round.visual.history.map((side) => `<i class="history-hand is-${side}" title="${side === 'left' ? 'Gauche' : 'Droite'}">${side === 'left' ? 'G' : 'D'}</i>`).join('')}
        </div>
        <div class="character">
          <div class="character-head"><i></i><i></i><span></span></div>
          <div class="character-body"></div>
          <div class="character-arm arm-left"><span class="character-hand" data-hand="left"></span></div>
          <div class="character-arm arm-right"><span class="character-hand" data-hand="right"></span></div>
        </div>
      </div>`
    return
  }
  if (round.type === 'doors') {
    visual.innerHTML = `
      <div class="doors-stage">
        ${round.choices.map((choice, index) => `
          <div class="mystery-door" data-door="${choice.id}">
            <div class="door-frame">
              <div class="door-panel"><span>${String.fromCharCode(65 + index)}</span><i></i></div>
              <div class="door-reveal"><strong>◆</strong><small></small></div>
            </div>
            <div class="door-history" aria-label="Résultats récents de la porte ${String.fromCharCode(65 + index)}">
              ${round.visual.histories[index].map((won) => `<i class="${won ? 'was-win' : 'was-empty'}"></i>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>`
    return
  }
  if (round.type === 'path') {
    const {weights, pathId} = round.visual
    visual.innerHTML = `
      <div class="living-path">
        <svg viewBox="0 0 420 240" role="img" aria-label="Trois chemins de largeurs différentes">
          <defs>
            <filter id="${pathId}-glow"><feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
          </defs>
          <circle class="path-start" cx="210" cy="21" r="8"></circle>
          <path id="${pathId}-left" data-path-zone="left" class="living-branch" style="--branch-width:${3 + weights[0] * 20}" d="M210 26 C202 82 116 92 67 216"></path>
          <path id="${pathId}-center" data-path-zone="center" class="living-branch" style="--branch-width:${3 + weights[1] * 20}" d="M210 26 C210 88 210 138 210 216"></path>
          <path id="${pathId}-right" data-path-zone="right" class="living-branch" style="--branch-width:${3 + weights[2] * 20}" d="M210 26 C218 82 304 92 353 216"></path>
          <g class="path-destinations">
            <circle cx="67" cy="220" r="13"></circle><circle cx="210" cy="220" r="13"></circle><circle cx="353" cy="220" r="13"></circle>
          </g>
          <g data-path-animation></g>
        </svg>
        <div class="path-labels"><span>Gauche</span><span>Centre</span><span>Droite</span></div>
      </div>`
    return
  }
  if (round.type === 'risk') {
    visual.innerHTML = `
      <div class="risk-scene" data-risk-scene>
        <div class="risk-history">
          ${round.visual.recent.length
            ? round.visual.recent.map((item) => `<i class="risk-${item}" title="${item}"></i>`).join('')
            : '<span>Première tentative</span>'}
        </div>
        <div class="risk-tower">
          ${[...Array(8)].map((_, index) => `<i class="${index < round.visual.step ? 'is-lit' : ''}" style="--step:${index}"></i>`).join('')}
          <span class="risk-orb">?</span>
        </div>
        <div class="risk-bank">
          <span>En jeu</span>
          <strong>${round.visual.bank}</strong>
          <small>prochain palier ${round.visual.nextBank}</small>
        </div>
      </div>`
  }
}

function revealVisual(round, resolution, selectedOption) {
  if (round.type === 'cards') {
    const cards = $$('.hidden-card')
    cards.forEach((card, index) => {
      const red = round.visual.winningPositions.includes(index)
      card.style.setProperty('--reveal-index', index)
      card.classList.add(red ? 'is-red' : 'is-green')
      if (card.dataset.option === selectedOption) card.classList.add('is-selected')
      card.disabled = true
    })
    return 915 + cards.length * 65
  } else if (round.type === 'dice') {
    $$('.die').forEach((die, index) => {
      die.textContent = round.visual.rolls[index]
      die.classList.remove('is-hidden')
      die.style.setProperty('--reveal-index', index)
      die.classList.add('is-revealed')
    })
    return 975 + round.visual.rolls.length * 85
  } else if (round.type === 'bag') {
    const color = ballColors[round.visual.drawn.id]
    $('.bag-shape')?.classList.add('is-open')
    $('[data-game-visual]').insertAdjacentHTML('beforeend', `<span class="drawn-ball" style="--ball-color:${color}" aria-label="Bille ${round.visual.drawn.label}"></span>`)
    return 1120
  } else if (round.type === 'boxes') {
    $('.boxes-visual')?.classList.add('is-revealed')
    ;['left', 'right'].forEach((side) => {
      const box = $(`[data-box="${side}"]`)
      const ratio = Math.round(round.visual[side].ratio * 100)
      box?.classList.add(side === resolution.correctOption ? 'is-winner' : 'is-lower')
      box?.insertAdjacentHTML('beforeend', `<em class="ratio-reveal">${ratio}%</em>`)
    })
    return 1150
  } else if (round.type === 'dots') {
    const cloud = $('.dots-cloud')
    cloud?.classList.remove('is-hidden')
    cloud?.classList.add('is-revealed')
    cloud?.insertAdjacentHTML('beforeend', `<strong class="dot-count-reveal">${round.visual.count}</strong>`)
    return 1080
  } else if (round.type === 'fireflies') {
    $('.firefly-field')?.classList.add('is-revealed', `reveal-${round.visual.actualZone}`)
    $(`[data-firefly-gate="${round.visual.actualZone}"]`)?.classList.add('is-winner')
    return 1350
  } else if (round.type === 'hands') {
    $('.hands-scene')?.classList.add('is-revealed')
    const hand = $(`[data-hand="${round.visual.actualSide}"]`)
    hand?.insertAdjacentHTML('beforeend', '<i class="hidden-object">◆</i>')
    hand?.classList.add('has-object')
    hand?.closest('.character-arm')?.classList.add('is-answer')
    return 1020
  } else if (round.type === 'doors' && selectedOption !== null) {
    $('.doors-stage')?.classList.add('is-revealed')
    const door = $(`[data-door="${selectedOption}"]`)
    door?.classList.add('is-open', resolution.rewarded ? 'is-rewarded' : 'is-empty')
    const label = $('.door-reveal small', door)
    if (label) label.textContent = resolution.rewarded ? 'GAGNÉ' : 'VIDE'
    return 1100
  } else if (round.type === 'doors') {
    $('.doors-stage')?.classList.add('is-revealed')
    const suggestedDoor = $(`[data-door="${round.optimalOption}"]`)
    suggestedDoor?.classList.add('is-suggested')
    const label = $('.door-reveal small', suggestedDoor)
    if (label) label.textContent = 'MEILLEUR SIGNAL'
    return 1000
  } else if (round.type === 'path') {
    $('.living-path')?.classList.add('is-revealed')
    const animation = $('[data-path-animation]')
    if (animation) {
      animation.innerHTML = `
        <circle class="living-ball" r="8" filter="url(#${round.visual.pathId}-glow)">
          <animateMotion dur="1.05s" fill="freeze" begin="0s">
            <mpath href="#${round.visual.pathId}-${round.visual.actualZone}"></mpath>
          </animateMotion>
        </circle>`
    }
    $(`[data-path-zone="${round.visual.actualZone}"]`)?.classList.add('is-actual')
    return 1740
  } else if (round.type === 'risk') {
    const scene = $('[data-risk-scene]')
    const outcome = resolution.riskOutcome || 'timeout'
    scene?.classList.add('is-revealed', `is-${outcome}`)
    const orb = $('.risk-orb', scene)
    if (orb) orb.textContent = outcome === 'crashed' ? '×' : outcome === 'banked' ? '✓' : outcome === 'survived' ? '↑' : '…'
    return 1400
  }
  return 1100
}

function updateTimer(progress, remainingMs) {
  const safeProgress = Math.max(0, Math.min(1, progress))
  $('.timer-wrap').style.setProperty('--timer-progress', safeProgress)
  $('.timer-wrap').classList.toggle('is-critical', safeProgress <= 0.23)
  $('[data-timer-text]').textContent = (Math.max(0, remainingMs) / 1000).toFixed(1)
}

function timerTick(now) {
  if (!state.acceptingAnswer || !state.currentRound) return
  const elapsed = now - state.roundStartedAt
  const remaining = state.currentRound.durationMs - elapsed
  updateTimer(remaining / state.currentRound.durationMs, remaining)
  if (remaining <= 0) {
    submitDecision(null)
    return
  }
  state.timerFrame = requestAnimationFrame(timerTick)
}

function submitDecision(selectedOption) {
  if (!state.acceptingAnswer || !state.currentRound) return
  state.acceptingAnswer = false
  if (state.timerFrame) cancelAnimationFrame(state.timerFrame)
  window.clearTimeout(state.visualTimer)

  const round = state.currentRound
  const timedOut = selectedOption === null
  const reactionTimeMs = timedOut
    ? round.durationMs
    : Math.max(100, Math.round(performance.now() - state.roundStartedAt))
  let resolution = timedOut
    ? {
        correctOption: round.correctOption,
        isCorrect: false,
        isOptimal: false,
        resultTitle: 'Temps écoulé.',
        resultDetail: 'La décision est enregistrée comme manquée. La prochaine épreuve sera légèrement rééquilibrée.',
      }
    : round.resolve(selectedOption)

  const nextStreak = resolution.isOptimal ? state.streak + 1 : 0
  const points = timedOut
    ? {total: 0, outcomePoints: 0, strategyPoints: 0, speedBonus: 0, difficultyBonus: 0, streakBonus: 0}
    : scoreDecision({round, resolution, reactionTimeMs, streak: nextStreak})
  state.streak = nextStreak
  state.longestStreak = Math.max(state.longestStreak, state.streak)
  state.score += points.total

  const decision = {
    gameType: round.type,
    level: round.level,
    presentedOptions: round.choices.length,
    targetProbability: round.targetProbability,
    selectedOption,
    correctOption: resolution.correctOption,
    optimalOption: round.optimalOption,
    isCorrect: resolution.isCorrect,
    isOptimal: resolution.isOptimal,
    timedOut,
    reactionTimeMs,
    durationMs: round.durationMs,
    scoreEarned: points.total,
    difficulty: round.difficulty,
    uncertainty: round.uncertainty,
    timestamp: new Date().toISOString(),
  }
  state.decisions.push(decision)
  $('[data-live-score]').textContent = state.score.toLocaleString('fr-FR')
  $('[data-live-streak]').textContent = state.streak
  $('[data-session-progress]').style.width = `${round.level / TOTAL_ROUNDS * 100}%`

  $$('[data-option]').forEach((button) => {
    button.disabled = true
    if (button.dataset.option === selectedOption) button.classList.add('is-selected')
  })
  const revealDuration = revealVisual(round, resolution, selectedOption)
  state.revealTimer = window.setTimeout(() => {
    showFeedback(resolution, points, timedOut)

    playTone(timedOut || (!resolution.isCorrect && !resolution.isOptimal)
      ? 'error'
      : resolution.isCorrect
        ? 'success'
        : 'strategy')

    state.transitionTimer = window.setTimeout(() => {
      if (state.roundIndex + 1 >= TOTAL_ROUNDS) {
        completeGame()
        return
      }
      state.roundIndex += 1
      renderRound()
    }, 1350)
  }, revealDuration)
}

function showFeedback(resolution, points, timedOut) {
  const feedback = $('[data-feedback]')
  let tone = 'var(--dsg-color__signal__danger)'
  let icon = '×'
  let kicker = timedOut ? 'Décision manquée' : 'Issue défavorable'
  if (resolution.isCorrect) {
    tone = 'var(--dsg-color__signal__success)'
    icon = '✓'
    kicker = 'Bonne intuition'
  } else if (resolution.isOptimal) {
    tone = 'var(--dsg-color__signal__warning)'
    icon = '≈'
    kicker = 'Bonne stratégie, mauvais tirage'
  }
  feedback.style.setProperty('--feedback-color', tone)
  $('[data-feedback-icon]').textContent = icon
  $('[data-feedback-kicker]').textContent = kicker
  $('[data-feedback-title]').textContent = resolution.resultTitle
  $('[data-feedback-detail]').textContent = resolution.resultDetail
  $('[data-feedback-points]').textContent = points.total ? `+${points.total}` : '+0'
  feedback.hidden = false
  const progress = $('[data-feedback-progress]')
  progress.style.animation = 'none'
  void progress.offsetWidth
  progress.style.animation = ''
}

async function completeGame() {
  clearRoundTimers()
  const summary = summarizeDecisions(state.decisions)
  state.analysis = analyzeSession(state.decisions, state.comparisonHistory)
  const entry = {
    id: `local-${Date.now()}`,
    date: new Date().toISOString(),
    score: state.score,
    accuracy: summary.accuracy,
    optimalRate: summary.optimalRate,
    averageReactionTime: summary.averageReactionTime,
    longestStreak: state.longestStreak,
    profile: state.analysis.profile.name,
    decisions: state.decisions,
  }
  writeLocalHistory(entry)
  renderResults(summary)
  showScreen('results')

  try {
    const payload = await api('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(entry),
    })
    state.history = [...state.comparisonHistory, payload.session]
  } catch {
    state.history = [...state.comparisonHistory, entry]
    showToast('Session sauvegardée dans ce navigateur. Le stockage serveur est indisponible.')
  }
  updateUserInterface()
}

function renderResults(summary = summarizeDecisions(state.decisions)) {
  const previousBest = state.comparisonHistory.reduce((maximum, session) => Math.max(maximum, Number(session.score) || 0), 0)
  $('[data-result-kicker]').textContent = state.score > previousBest && previousBest > 0
    ? 'Nouveau record personnel'
    : 'Portrait de session prêt'
  $('[data-final-score]').textContent = state.score.toLocaleString('fr-FR')
  $('[data-result-accuracy]').textContent = `${Math.round(summary.accuracy * 100)}%`
  $('[data-result-optimal]').textContent = `${Math.round(summary.optimalRate * 100)}%`
  $('[data-result-speed]').textContent = summary.averageReactionTime
    ? `${summary.averageReactionTime.toLocaleString('fr-FR')} ms`
    : '—'
  $('[data-result-streak]').textContent = `×${state.longestStreak}`
}

function radarPoint(index, value) {
  const angle = (-90 + index * 72) * Math.PI / 180
  const radius = 168 * Math.max(0, Math.min(100, value)) / 100
  return {
    x: 210 + Math.cos(angle) * radius,
    y: 210 + Math.sin(angle) * radius,
  }
}

function renderAnalysis() {
  if (!state.analysis) {
    state.analysis = analyzeSession(state.decisions, state.comparisonHistory)
  }
  const analysis = state.analysis
  $('[data-profile-title]').textContent = analysis.profile.name
  $('[data-profile-strapline]').textContent = analysis.profile.strapline
  $('[data-profile-summary]').textContent = analysis.profile.summary
  $('[data-profile-optimal]').textContent = `${Math.round(analysis.optimalRate * 100)}%`
  $('[data-profile-history]').textContent = analysis.historySize
    ? `Comparé à ${analysis.historySize} session${analysis.historySize > 1 ? 's' : ''}`
    : 'Première session'

  const radarMetrics = ['intuition', 'estimation', 'uncertainty', 'adaptation', 'risk']
    .map((id) => analysis.categoryMetrics.find((metric) => metric.id === id))
  const radarPoints = radarMetrics.map((metric, index) => radarPoint(index, metric?.score || 0))
  $('[data-radar-polygon]').setAttribute('points', radarPoints.map((point) => `${point.x},${point.y}`).join(' '))
  $('[data-radar-points]').innerHTML = radarPoints.map((point) => (
    `<circle class="radar-point" cx="${point.x}" cy="${point.y}" r="5"></circle>`
  )).join('')

  $('[data-metric-list]').innerHTML = analysis.categoryMetrics.map((metric) => `
    <article class="metric-card" data-dsg-component="feature-card">
      <div>
        <span>${metric.label}</span>
        <div class="metric-track"><i style="--metric-value:${metric.score}%"></i></div>
        <small>${metric.sample} décision${metric.sample > 1 ? 's' : ''} observée${metric.sample > 1 ? 's' : ''}</small>
      </div>
      <strong>${metric.score}</strong>
    </article>
  `).join('')

  $('[data-insight-grid]').innerHTML = analysis.insights.map((insight) => `
    <article class="insight-card" data-tone="${insight.tone}" data-dsg-component="feature-card">
      <span>${insight.eyebrow}</span>
      <h3>${insight.title}</h3>
      <p>${insight.copy}</p>
    </article>
  `).join('')

  $('[data-breakdown]').innerHTML = `
    <div class="breakdown-row header"><span>Épreuve</span><span>Issue exacte</span><span>Choix rationnel</span><span>Réaction</span></div>
    ${analysis.gameBreakdown.map((game) => `
      <div class="breakdown-row">
        <span>${game.label}</span>
        <span>${game.accuracy}%</span>
        <span>${game.optimalRate}%</span>
        <span>${game.reactionTime ? `${game.reactionTime} ms` : '—'}</span>
      </div>
    `).join('')}
  `
  renderHistoryChart()
}

function renderHistoryChart() {
  const sessions = [
    ...state.comparisonHistory.map((session) => ({score: Number(session.score) || 0, current: false})),
    {score: state.score, current: true},
  ].slice(-12)
  const maximum = Math.max(100, ...sessions.map((session) => session.score))
  const chartMaximum = Math.ceil(maximum * 1.12 / 100) * 100
  const width = 916
  const height = 195
  const points = sessions.map((session, index) => ({
    ...session,
    x: sessions.length === 1 ? 512 : 54 + index / (sessions.length - 1) * width,
    y: 30 + (1 - session.score / chartMaximum) * height,
  }))
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const area = points.length ? `${line} L ${points.at(-1).x} 225 L ${points[0].x} 225 Z` : ''
  $('[data-history-line]').setAttribute('d', line)
  $('[data-history-area]').setAttribute('d', area)
  $('[data-history-points]').innerHTML = points.map((point) => (
    `<circle class="history-point${point.current ? ' is-current' : ''}" cx="${point.x}" cy="${point.y}" r="${point.current ? 7 : 5}"></circle>`
  )).join('')

  const pastScores = state.comparisonHistory.map((session) => Number(session.score) || 0)
  const pastAverage = pastScores.length
    ? Math.round(pastScores.reduce((sum, score) => sum + score, 0) / pastScores.length)
    : null
  const previousScore = pastScores.at(-1)
  const delta = previousScore === undefined ? null : state.score - previousScore
  $('[data-history-count]').textContent = state.comparisonHistory.length + 1
  $('[data-history-current]').textContent = state.score.toLocaleString('fr-FR')
  $('[data-history-average]').textContent = pastAverage === null ? '—' : pastAverage.toLocaleString('fr-FR')
  $('[data-history-delta]').textContent = delta === null
    ? 'Première'
    : `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('fr-FR')}`
  $('[data-history-caption]').textContent = pastScores.length
    ? `Cette session rejoint ${pastScores.length} repère${pastScores.length > 1 ? 's' : ''} personnel${pastScores.length > 1 ? 's' : ''}.`
    : 'Cette session pose ton premier repère.'
}

function handleAction(action) {
  if (action === 'play' || action === 'replay') startGame()
  if (action === 'home') {
    clearRoundTimers()
    showScreen('home')
  }
  if (action === 'open-info') openModal('info')
  if (action === 'close-modal') closeModals()
  if (action === 'analysis') {
    renderAnalysis()
    showScreen('analysis')
  }
  if (action === 'results') {
    renderResults()
    showScreen('results')
  }
  if (action === 'profile') {
    if (!state.user) {
      openModal('login')
      return
    }
    const menu = $('[data-profile-menu]')
    menu.hidden = !menu.hidden
    $('.profile-avatar').setAttribute('aria-expanded', String(!menu.hidden))
  }
  if (action === 'change-profile') {
    $('[data-profile-menu]').hidden = true
    openModal('login')
  }
  if (action === 'logout') logOut()
  if (action === 'toggle-sound') {
    state.muted = !state.muted
    const button = $('[data-action="toggle-sound"]')
    button.setAttribute('aria-pressed', String(state.muted))
    button.setAttribute('aria-label', state.muted ? 'Activer les sons' : 'Désactiver les sons')
  }
  if (action === 'exit-game') {
    if (window.confirm('Quitter cette session ? Les décisions déjà prises ne seront pas enregistrées.')) {
      clearRoundTimers()
      showScreen('home')
    }
  }
}

document.addEventListener('click', (event) => {
  const actionTarget = event.target.closest('[data-action]')
  if (actionTarget) {
    handleAction(actionTarget.dataset.action)
    return
  }
  const gameCard = event.target.closest('[data-game-card]')
  if (gameCard) {
    openGameDetails(gameCard.dataset.gameCard)
    return
  }
  const option = event.target.closest('[data-option]')
  if (option) {
    submitDecision(option.dataset.option)
    return
  }
  if (event.target.matches('[data-modal]')) closeModals()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if ($$('[data-modal]').some((modal) => !modal.hidden)) {
      closeModals()
      return
    }
    if (state.screen === 'game') handleAction('exit-game')
    return
  }
  if (state.screen !== 'game' || !state.acceptingAnswer || !state.currentRound) return
  const index = event.key === '0' ? 9 : Number(event.key) - 1
  if (!Number.isInteger(index) || index < 0) return
  const choice = state.currentRound.choices[index]
  if (choice) submitDecision(choice.id)
})

$('[data-login-form]').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const input = $('#username', form)
  const error = $('[data-login-error]')
  const submit = $('button[type="submit"]', form)
  submit.disabled = true
  submit.textContent = 'Connexion…'
  error.hidden = true
  try {
    await logIn(input.value)
    const startAfterLogin = form.dataset.startAfterLogin === 'true'
    delete form.dataset.startAfterLogin
    closeModals()
    input.value = ''
    if (startAfterLogin) startGame()
  } catch (caught) {
    error.textContent = caught.message
    error.hidden = false
    input.setAttribute('aria-invalid', 'true')
    input.focus()
  } finally {
    submit.disabled = false
    submit.innerHTML = 'Continuer <b>→</b>'
  }
})

async function initialize() {
  await loadGameCatalog()
  try {
    const payload = await api('/api/me')
    state.user = payload.user
    if (!state.user) {
      const remembered = readRememberedUser()
      if (remembered) {
        const restored = await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({username: remembered.username}),
        })
        state.user = restored.user
      }
    }
    rememberUser(state.user)
  } catch {
    state.user = readRememberedUser()
    showToast('Mode local : démarre server.py pour activer les profils et la sauvegarde.')
  }
  await loadHistory()
  updateUserInterface()
}

initialize()
